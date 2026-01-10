"""app/services/generator/brand_inference.py

Brand-Erkennung (ohne Fallbacks).

Was diese Datei tut
-------------------
- Lädt ein HF Image-Classification Modell (z.B. Logo-Classifier).
- Berechnet pro Bild (und optional pro Crop-Variante) die Brand-Probabilities.
- Filtert strikt über eine Allowlist (nur Brands, die du erlaubst).
- Gibt die Marke nur zurück, wenn die Confidence wirklich hoch ist.

Warum du oft "best=..." siehst, aber die Rückgabe leer ist
----------------------------------------------------------
In deinem Log kommt z.B.:

    [DEBUG] BRAND best='nike' conf=0.2370 margin=0.1820 min_conf=0.70 min_margin=0.12

Das bedeutet:
- Das Modell hat innerhalb der Allowlist "nike" als besten erlaubten Kandidaten gefunden,
  ABER die Wahrscheinlichkeit (conf=0.237) ist viel zu niedrig gegenüber deinem Minimum
  (min_conf=0.70). Dadurch wird die Brand absichtlich verworfen und "" zurückgegeben.
  => Genau so soll es sein, wenn du "nur bei hoher confidence" willst.

Warum "komische" Kandidaten auftauchen (IBM/Excel/Java/Gillette …)
-----------------------------------------------------------------
Viele Logo-Modelle sind auf gemischten Marken-Datensätzen trainiert (nicht nur Fashion).
Darum tauchen diese Labels als Kandidaten auf. Durch die Allowlist werden sie zuverlässig
ausgeschlossen ("allowed=False") und können nicht als Ergebnis zurückkommen.

Warum der Allowlist-Pfad manchmal "falsch" ist
----------------------------------------------
Wenn du in Windows in der .env schreibst:

    BRAND_ALLOWLIST_PATH=/models/brand_allowlist.txt

dann wird das zu:

    C:\\models\\brand_allowlist.txt

(= Root des Laufwerks). Das existiert meist nicht.
Richtig ist relativ zum Projekt-Root (dein cwd ist python_ai_service):

    BRAND_ALLOWLIST_PATH=models/brand_allowlist.txt
"""

from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from io import BytesIO
from typing import Dict, List, Optional, Tuple

import numpy as np
import requests
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForImageClassification

from app.config import get_settings

settings = get_settings()


def _is_url(path: str) -> bool:
    return path.startswith("http://") or path.startswith("https://")


def _load_image(path_or_url: str) -> Image.Image:
    if _is_url(path_or_url):
        r = requests.get(path_or_url, timeout=float(getattr(settings, "REQUEST_TIMEOUT_SEC", 8)))
        r.raise_for_status()
        return Image.open(BytesIO(r.content)).convert("RGB")
    return Image.open(path_or_url).convert("RGB")


def _norm_label(x: str) -> str:
    s = (x or "").strip().lower()
    s = s.replace("_", " ")
    s = re.sub(r"[^a-z0-9\s&'’-]+", " ", s)
    s = s.replace("’", "'")
    s = re.sub(r"\s+", " ", s).strip()
    return s


@lru_cache(maxsize=1)
def _local_only() -> bool:
    return bool(getattr(settings, "HF_HUB_OFFLINE", False) or getattr(settings, "TRANSFORMERS_OFFLINE", False))


@lru_cache(maxsize=1)
def _get_brand_model() -> Tuple[torch.nn.Module, object, torch.device]:
    model_name = str(getattr(settings, "BRAND_MODEL_NAME", "") or "").strip()
    if not model_name:
        raise RuntimeError("BRAND_MODEL_NAME is empty while BRAND_ENABLE=1")

    device_str = str(getattr(settings, "BRAND_DEVICE", "cpu") or "cpu").strip().lower()
    device = torch.device(device_str)

    processor = AutoImageProcessor.from_pretrained(model_name, local_files_only=_local_only())
    model = AutoModelForImageClassification.from_pretrained(model_name, local_files_only=_local_only())
    model.to(device)
    model.eval()
    return model, processor, device


@lru_cache(maxsize=1)
def _load_alias_map() -> Dict[str, str]:
    # Kleine Defaults (einige Logo-Datasets enthalten Tippfehler in Labels)
    out: Dict[str, str] = {
        "addidas": "adidas",
        "calvinklein": "calvin klein",
    }

    path = str(getattr(settings, "BRAND_ALIAS_MAP_PATH", "") or "").strip()
    if not path:
        path = os.getenv("BRAND_ALIAS_MAP_PATH", "").strip()

    if not path or not os.path.exists(path):
        return out

    try:
        raw = json.loads(open(path, "r", encoding="utf-8").read())
        for k, v in (raw or {}).items():
            nk, nv = _norm_label(k), _norm_label(v)
            if nk and nv:
                out[nk] = nv
        return out
    except Exception:
        return out


@lru_cache(maxsize=1)
def _load_allowlist() -> Optional[set[str]]:
    """
    Lädt erlaubte Brands aus:
      - BRAND_ALLOWLIST_PATH (Datei, eine Brand pro Zeile)
      - BRAND_ALLOWLIST (CSV in ENV, optional)
    """
    path = str(getattr(settings, "BRAND_ALLOWLIST_PATH", "") or "").strip()
    if not path:
        path = os.getenv("BRAND_ALLOWLIST_PATH", "").strip()

    allow: set[str] = set()

    abs_path = os.path.abspath(path) if path else ""
    file_ok = bool(abs_path and os.path.exists(abs_path))

    if file_ok:
        with open(abs_path, "r", encoding="utf-8") as f:
            for line in f:
                t = _norm_label(line)
                if not t or t.startswith("#"):
                    continue
                allow.add(t)

    csv_val = os.getenv("BRAND_ALLOWLIST", "").strip()
    if csv_val:
        for part in csv_val.split(","):
            t = _norm_label(part)
            if t:
                allow.add(t)

    # Minimaler Debug (nur 1 Zeile, wegen lru_cache genau 1x pro Prozess)
    if getattr(settings, "DEBUG", False):
        print(
            f"[DEBUG] BRAND allowlist: path='{path}' abs='{abs_path}' exists={file_ok} "
            f"file_count={len(allow) if file_ok else 0} csv_present={bool(csv_val)} total={len(allow)}"
        )

    return allow or None


def _canonical(raw: str, alias: Dict[str, str]) -> str:
    n = _norm_label(raw)
    return alias.get(n, n)


def _multi_crops(img: Image.Image) -> List[Image.Image]:
    multi = os.getenv("BRAND_MULTI_CROP", str(getattr(settings, "BRAND_MULTI_CROP", "1"))).strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )
    if not multi:
        return [img]

    w, h = img.size
    if w < 8 or h < 8:
        return [img]

    frac = float(os.getenv("BRAND_CROP_FRACTION", str(getattr(settings, "BRAND_CROP_FRACTION", 0.78))))
    frac = max(0.55, min(0.95, frac))
    cw, ch = int(w * frac), int(h * frac)

    def crop_at(cx: int, cy: int) -> Image.Image:
        x0 = max(0, min(w - cw, cx - cw // 2))
        y0 = max(0, min(h - ch, cy - ch // 2))
        return img.crop((x0, y0, x0 + cw, y0 + ch)).resize((w, h))

    return [
        img,
        crop_at(w // 2, h // 2),
        crop_at(w // 2, int(h * 0.30)),
        crop_at(w // 2, int(h * 0.70)),
        crop_at(int(w * 0.30), h // 2),
        crop_at(int(w * 0.70), h // 2),
    ]


@torch.inference_mode()
def predict_brand(image_paths: List[str]) -> str:
    """
    Brand-Erkennung über mehrere Bilder:
    - Für jedes Bild: bestes Allowlist-Brand + Confidence + Margin bestimmen
    - Danach: Voting/Konsens über alle Bilder
    - Brand wird nur zurückgegeben, wenn sie insgesamt stark genug ist

    Keine Fallbacks, nur Modelloutputs.
    """
    if not bool(getattr(settings, "BRAND_ENABLE", False)):
        return ""

    paths = [p for p in (image_paths or []) if p]
    if not paths:
        return ""

    allow = _load_allowlist()
    if not allow:
        if getattr(settings, "DEBUG", False):
            print("[DEBUG] BRAND: allowlist empty -> returning ''")
        return ""

    alias = _load_alias_map()
    model, processor, device = _get_brand_model()

    # Du willst "nur wenn confidence hoch ist":
    # -> wir erzwingen mindestens 0.65, egal was in env steht.
    base_min_conf = float(getattr(settings, "BRAND_MIN_CONF"))
    base_min_margin = float(getattr(settings, "BRAND_MIN_MARGIN", 0.10))

    topk = int(getattr(settings, "BRAND_TOPK", 5))
    topk = max(2, min(topk, 50))

    # pro Bild: (top1_brand, conf1, margin, path)
    per_image_best: List[Tuple[str, float, float, str]] = []

    for path in paths:
        try:
            img = _load_image(path)
        except Exception:
            continue

        # Sammle pro Brand die beste Confidence innerhalb dieses Bildes (über alle Crops)
        best_for_img: Dict[str, float] = {}

        for view in _multi_crops(img):
            inputs = processor(images=view, return_tensors="pt").to(device)
            probs = torch.softmax(model(**inputs).logits, dim=-1).squeeze(0)
            probs_np = probs.detach().float().cpu().numpy()

            idxs = np.argsort(probs_np)[::-1][:topk]
            for i in idxs:
                raw = model.config.id2label.get(int(i), str(i))
                canon = _canonical(raw, alias)
                if not canon or canon not in allow:
                    continue
                conf = float(probs_np[int(i)])
                if conf > best_for_img.get(canon, 0.0):
                    best_for_img[canon] = conf

        if not best_for_img:
            continue

        ranked = sorted(best_for_img.items(), key=lambda kv: kv[1], reverse=True)
        top1_brand, conf1 = ranked[0]
        conf2 = ranked[1][1] if len(ranked) > 1 else 0.0
        margin = conf1 - conf2

        per_image_best.append((top1_brand, float(conf1), float(margin), path))

    if not per_image_best:
        if getattr(settings, "DEBUG", False):
            print("[DEBUG] BRAND: no allowed candidates in any image -> returning ''")
        return ""

    # ---- Voting / Konsens über Bilder ----
    votes: Dict[str, int] = {}
    conf_sum: Dict[str, float] = {}
    margin_sum: Dict[str, float] = {}
    max_conf: Dict[str, float] = {}

    for b, c, m, _p in per_image_best:
        votes[b] = votes.get(b, 0) + 1
        conf_sum[b] = conf_sum.get(b, 0.0) + c
        margin_sum[b] = margin_sum.get(b, 0.0) + m
        max_conf[b] = max(max_conf.get(b, 0.0), c)

    # Auswahl: zuerst nach Stimmen, dann nach durchschnittlicher Confidence, dann max_conf
    def _rank_key(brand: str):
        v = votes.get(brand, 0)
        mean_c = conf_sum[brand] / max(1, v)
        mx = max_conf.get(brand, 0.0)
        return (v, mean_c, mx)

    best_brand = sorted(votes.keys(), key=_rank_key, reverse=True)[0]
    v = votes[best_brand]
    mean_conf = conf_sum[best_brand] / v
    mean_margin = margin_sum[best_brand] / v
    mx = max_conf.get(best_brand, 0.0)

    # Wenn mehrere Bilder sich einig sind, dürfen wir minimal “weniger streng” sein,
    # ABER es bleibt "hoch" (kein Fallback, nur strengere Aggregation).
    conf_req = base_min_conf
    margin_req = base_min_margin
    if v >= 2:
        conf_req = base_min_conf * 0.85
        margin_req = base_min_margin * 0.90
    if v >= 3:
        conf_req = base_min_conf * 0.80
        margin_req = base_min_margin * 0.85

    accepted = ((mx >= base_min_conf) or (mean_conf >= conf_req)) and (mean_margin >= margin_req)

    if getattr(settings, "DEBUG", False):
        # kompakter Debug: 1 Zeile (keine Candidate-Flut)
        short = ", ".join([f"{b}:{c:.2f}" for (b, c, _m, _p) in per_image_best[:8]])
        if len(per_image_best) > 8:
            short += f", +{len(per_image_best) - 8} more"
        print(
            f"[DEBUG] BRAND vote: images={len(per_image_best)} top1=[{short}] "
            f"-> pick='{best_brand}' votes={v} mean_conf={mean_conf:.3f} max_conf={mx:.3f} "
            f"mean_margin={mean_margin:.3f} conf_req={conf_req:.2f} margin_req={margin_req:.2f} "
            f"-> {'accepted' if accepted else 'rejected'}"
        )

    return best_brand if accepted else ""
