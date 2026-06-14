# Audit: python_ai_service (read-only)

Auditor-Lauf, strikt read-only. Alle Befunde mit datei:zeile belegt. Zeilen sind aus dem
tatsächlich gelesenen Code; keine Modelle/Services gestartet.

## Coverage-Tabelle

| Datei | gelesen | Verantwortung | Auffällige Imports |
|---|---|---|---|
| pyproject.toml | ja | Deps + Build (setuptools/uv) | `torch`, `optimum-intel[openvino]`, `onnx`, `transformers`, `datamodel-code-generator` |
| Dockerfile | ja | Prod-Image (python:3.12-slim, uv sync) | `UV_EXTRA_INDEX_URL=…/whl/cpu` |
| README.md | ja | Doku Dev/Modelle/API | – (Doku widerspricht Code, s. Befunde) |
| example.env | ja | Env-Vorlage | DEVICES_LLM=NPU, OFFLINE=1 |
| run_dev.cmd | ja | Windows-Dev-Start (uvicorn --reload) | – |
| package.json | ja | npm-Scripts → service.py | – |
| project.json | ja | Nx-Targets | docker:build kontext `.` |
| app/__init__.py | ja | leer (0 bytes) | – |
| app/config.py | ja | Settings aus Env, Device-Routing | `from .ov_runtime import normalize_device` |
| app/main.py | ja | FastAPI-App, /health, /analyze-product, startup | `@app.on_event("startup")` (deprecated) |
| app/model_manager.py | ja | Modell-Asset-Check/Download/Convert | `import openvino as ov` (top-level), `huggingface_hub` lazy |
| app/ov_runtime.py | ja | Device-Normalisierung/Compile (strict) | `import openvino as ov` |
| app/openvino_tokenizers_ext.py | ja | Tokenizer-DLL laden (Windows) | `os.add_dll_directory` (nt-only) |
| app/contracts_models.py | ja | Pydantic-Modelle (Request/Response/Debug) | `pydantic` v2, `min_items` (v1-Alias) |
| app/services/__init__.py | ja | leer (0 bytes) | – |
| app/services/errors.py | ja | AiServiceError (dataclass+Exception) | – |
| app/services/jobs.py | ja | dünner analyze()-Wrapper | – |
| app/services/pipeline/__init__.py | ja | Docstring | – |
| app/services/pipeline/image_loader.py | ja | path/url/base64 → RGB | `requests.get(url)` (SSRF-Vektor) |
| app/services/pipeline/tagger_openvino.py | ja | CLIP-Tagging, HARTKODIERTE Kandidaten | `from transformers import CLIPProcessor` (Runtime) |
| app/services/pipeline/multi_image.py | ja | Tag-Merge/Stats, Caption-Clean/Consensus | – |
| app/services/pipeline/captioner_openvino.py | ja | BLIP greedy decode | `from transformers import BlipProcessor` (Runtime) |
| app/services/pipeline/llm_openvino_genai.py | ja | Qwen-LLM, JSON-Parse/Retry/Timeout/Cache | `import openvino_genai` (lazy in __init__) |
| app/services/pipeline/normalize.py | ja | Tag-Normalisierung | – |
| app/services/pipeline/orchestrator.py | ja | Pipeline-Orchestrierung, Response-Bau | – |
| app/services/pipeline/prompts.py | ja | LLM-Prompt (ENGLISCH!) | – |
| app/tools/__init__.py | ja | Docstring | – |
| app/tools/convert_blip_to_openvino.py | ja | BLIP→ONNX→OV (Dev/Build) | `import torch` |
| app/tools/convert_clip_to_openvino.py | ja | CLIP→ONNX→OV (Dev/Build) | `import torch` |
| scripts/service.py | ja | Dev-Runner (start/stop/status/build/test) | subprocess, taskkill/killpg |
| scripts/generate_contracts.py | ja | JSON-Schema → Pydantic via datamodel-codegen | subprocess |
| tests/test_llm_output.py | ja | parse_llm_json/parse_llm_output | – |
| tests/test_multi_image_pipeline.py | ja | merge/stats/captions | – |
| tests/test_normalize.py | ja | normalize_tags | – |
| tests/test_orchestrator_multi_image.py | ja | run_pipeline (gemockt) | monkeypatch |
| tests/test_request_validation.py | ja | Request-Validierung | – |
| (Quervergleich) backend/src/services/aiPythonClient.ts | ja | Backend-Aufruf | sendet `kind:'url'`, Timeout 150000ms |
| (Quervergleich) contracts/schema/*.json | ja | Vertrags-Schema | Drift gegen contracts_models.py |

---

## Befunde

### F: prompts.py erzeugt ENGLISCHE Texte, Entscheidung 2 verlangt DEUTSCH
- Kategorie: Korrektheit / Fehlende Funktion/Lücke
- Schweregrad: Hoch
- Konfidenz: Bestätigt
- Ort: prompts.py:8 ("Language: English."), prompts.py:22 ("Create an English product title…"), Modell `LanguageCode = Literal["en"]` contracts_models.py:7, request `lang` wird nirgends ausgewertet (orchestrator.py durchsucht, keine Nutzung von payload.lang)
- Auswirkung: Der Shop ist deutsch; KI liefert englische Titel/Beschreibungen. Widerspricht CLAUDE.md Entscheidung 2 ("KI-Output: Deutsch"). `lang` im Request ist totes Feld (nur "en" erlaubt, wird ohnehin ignoriert).
- Empfehlung: System-/User-Prompt auf Deutsch umstellen; `LanguageCode` um "de" erweitern und `payload.lang` an `build_copy_prompt` durchreichen oder fest "de". CLIP/BLIP-Tags dürfen englisch bleiben.
- Aufwand: S

### F: Device-Default ist NPU/GPU, nicht CPU – Prod ist CPU-only
- Kategorie: Konfiguration/Env
- Schweregrad: Hoch
- Konfidenz: Bestätigt
- Ort: config.py:142-144 (`DEVICES_CLIP=openvino:GPU`, `DEVICES_BLIP=openvino:GPU`, `DEVICES_LLM=openvino:NPU`), example.env:12-14 (CLIP=GPU/BLIP=GPU/LLM=NPU), README.md:47 ("OpenVINO GPU/NPU is required; there is no CPU fallback"), README.md:119 ("AI_DEVICE default openvino:GPU, only supported value")
- Auswirkung: Default-Routing zielt auf GPU/NPU. Auf dem CPU-only-Hetzner-Server (Entscheidung 4) schlägt `resolve_device` fehl (`DEVICE_NOT_AVAILABLE`, 503, ov_runtime.py:68-79), da "GPU"/"NPU" nicht in `core.available_devices`. Ohne explizit gesetzte `DEVICES_*=CPU` in `infra/`-Env startet die Pipeline in Prod gar nicht.
- Empfehlung: Code-Default für `DEVICES_*` auf `CPU` setzen (oder zumindest dokumentieren, dass Prod-Env zwingend `DEVICES_*=CPU` setzen muss). README-Aussagen "no CPU fallback / GPU required" sind für den vereinbarten Prod-Pfad falsch.
- Aufwand: S

### F: LLM nur GPU/NPU erlaubt, außer explizit CPU – fragiles CPU-Gating
- Kategorie: Korrektheit / Konfiguration
- Schweregrad: Mittel
- Konfidenz: Bestätigt
- Ort: llm_openvino_genai.py:248-272 (`allowed_devices = {"GPU","NPU"}`; CPU nur, wenn `normalized_requested == "CPU"`)
- Auswirkung: Logik ist verschachtelt: CPU ist nur erlaubt, wenn der angeforderte Wert schon CPU normalisiert wurde. Das funktioniert, aber die Default-Konfiguration (NPU) plus diese Whitelist führt dazu, dass ein Fehlkonfig (z.B. `AI_DEVICE=AUTO`) zu spät und unklar abgefangen wird. Kein CPU-Default → siehe vorheriger Befund.
- Empfehlung: CPU regulär in die erlaubten LLM-Devices aufnehmen und als Default routen.
- Aufwand: S

### F: NPU-only-IR-Risiko + OV_CACHE_DIR persistiert geräteabhängigen Compile-Cache
- Kategorie: Konfiguration / Performance
- Schweregrad: Mittel
- Konfidenz: Wahrscheinlich
- Ort: ov_runtime.py:37-44 (`CACHE_DIR` gesetzt), example.env:21-22 (`OV_CACHE_DIR=models/.ov_cache`); Modelle werden geräteneutral als IR gelesen (`core.read_model` + `compile_model`, tagger_openvino.py:81-94, captioner_openvino.py:62-72)
- Auswirkung: Die IR selbst ist geräteneutral (gut – kein hartes NPU-only-IR im Code). ABER: Lokal für NPU/GPU erzeugter OpenVINO-Compile-Cache (`models/.ov_cache`) darf NICHT mit ins Prod-Image/Volume wandern, sonst inkonsistent für CPU. Entscheidung 6 ("NPU-only-IR NICHT deployen") betrifft hier eher den Cache + die LLM-IR (INT4 für CPU bevorzugt).
- Empfehlung: `.ov_cache` aus Deploy ausschließen; sicherstellen, dass die ausgelieferte LLM-IR CPU-tauglich (INT4) ist. Dockerfile kopiert nur `app/` (keine Modelle) – Modellbereitstellung ist offener Detailpunkt (s.u.).
- Aufwand: M

### F: torch im Runtime-Image, obwohl nur für Konvertierung gebraucht
- Kategorie: Abhängigkeiten / Performance
- Schweregrad: Hoch
- Konfidenz: Bestätigt
- Ort: pyproject.toml:19 (`"torch"` ungruppiert = Runtime-Dep), Dockerfile:13 (`uv sync --no-dev` installiert alle Nicht-Dev-Deps inkl. torch); torch wird zur Laufzeit NICHT importiert – nur in app/tools/convert_blip_to_openvino.py:9 und app/tools/convert_clip_to_openvino.py:9 (Dev/Build). Runtime importiert `openvino`, `openvino_genai`, `transformers` (Processor), `numpy`, `PIL`, `requests` – kein torch.
- Auswirkung: torch (CPU-Wheel) ist mehrere hundert MB → unnötig großes Prod-Image und längere Builds. `UV_EXTRA_INDEX_URL=…/whl/cpu` (Dockerfile:7) mildert nur die CUDA-Variante, entfernt torch aber nicht.
- Empfehlung: `torch`, `onnx`, `onnxscript` (und ggf. `optimum-intel[openvino]`, `datamodel-code-generator`) in eine `dev`/`convert`-Dependency-Group verschieben; Runtime-Image ohne torch bauen. Verifizieren, dass `transformers`-Processor ohne torch läuft (CLIPProcessor/BlipProcessor mit `return_tensors="np"` – kein torch nötig).
- Aufwand: M

### F: optimum-intel/onnx/huggingface-hub als Runtime-Deps trotz OFFLINE/never-Default
- Kategorie: Abhängigkeiten
- Schweregrad: Mittel
- Konfidenz: Wahrscheinlich
- Ort: pyproject.toml:14-15,22-23 (`onnx`, `onnxscript`, `optimum-intel[openvino]`, `transformers`, `huggingface-hub`); `huggingface_hub` wird nur lazy bei Download importiert (model_manager.py:372), `optimum-cli` nur als Subprozess gesucht (model_manager.py:345-355). Default ist `MODEL_FETCH_MODE=never` + `OFFLINE=1` (config.py:65-66) → Download-Pfad in Prod nie aktiv.
- Auswirkung: Große, im Prod-Runtime ungenutzte Pakete. `transformers` bleibt nötig (Processor zur Laufzeit), die übrigen nicht.
- Empfehlung: Konvertierungs-/Download-Deps in optionale Gruppe; Prod-Image schlank. Deckt sich mit CLAUDE.md 10.2.
- Aufwand: M

### F: Kein Auth/Rate-Limit auf /analyze-product + SSRF über url-Bilder
- Kategorie: Sicherheit
- Schweregrad: Mittel
- Konfidenz: Bestätigt
- Ort: main.py:98-111 (Endpoint ohne Auth), image_loader.py:45-49 (`requests.get(url, timeout=…)` ohne Host-Allowlist/Redirect-/Scheme-Beschränkung), Backend sendet `kind:'url'` (aiPythonClient.ts:23-26)
- Auswirkung: Wer den Service-Port (8000) erreicht, kann beliebige URLs laden lassen → SSRF (interne Endpunkte, Cloud-Metadaten 169.254.169.254). Kein Token zwischen Backend und Service. Auch `kind:'path'` (image_loader.py:25-35) erlaubt Lesen beliebiger lokaler Pfade (Pfad-Traversal/Local-File-Read), wenn ein Angreifer den Endpoint erreicht – Backend nutzt zwar nur `url`, aber der Service akzeptiert `path` weiterhin.
- Empfehlung: Service nur intern erreichbar binden (Docker-Netz, nicht öffentlich), shared-secret/Header-Auth zwischen Backend↔Service, URL-Scheme/Host-Allowlist im Loader, `kind:'path'` für den Prod-Pfad deaktivieren/absichern. `requests.get` ohne `allow_redirects=False` folgt Redirects (SSRF-Bypass).
- Aufwand: M

### F: PipelineMeta.device meldet nur LLM-Device, nicht CLIP/BLIP
- Kategorie: Observability/Logging / Korrektheit
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: orchestrator.py:345 (`device=routing.llm`), DeviceRouting hat clip/blip/llm separat (contracts_models.py:70-76), Schema `meta.device` ist ein einzelner enum (analyze-product-response.schema.json:46-56)
- Auswirkung: Bei heterogenem Routing (z.B. CLIP=GPU, LLM=NPU) ist `meta.device` irreführend; nur das LLM-Device wird zurückgegeben.
- Empfehlung: Entweder dokumentieren, dass `device` = LLM-Device, oder Routing-Objekt (clip/blip/llm) in meta aufnehmen.
- Aufwand: S

### F: merge_tags_for_images meldet im Fallback-Pfad falsche strategy
- Kategorie: Korrektheit / Observability
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: multi_image.py:130-136 (Fallback-Return setzt `strategy="intersection_all"`, obwohl Schnittmenge leer war und auf highest-avg-score-Bild ausgewichen wurde; `fallback` ist korrekt gesetzt)
- Auswirkung: Debug/Logging (`tag_merge_strategy`, orchestrator.py:195/235) zeigt "intersection_all" auch wenn faktisch der Fallback griff. Nur kosmetisch/irreführend, kein funktionaler Bug.
- Empfehlung: `strategy="single_image_fallback"` o.ä. im Fallback-Zweig setzen. (Test test_multi_image_pipeline.py:39-40 prüft nur `fallback`, nicht `strategy`, würde also nicht brechen.)
- Aufwand: S

### F: LLM_TIMEOUT_SECONDS=20 / REQUEST_TIMEOUT_SEC=30 zu kurz für CPU-Prod
- Kategorie: Konfiguration / Korrektheit
- Schweregrad: Hoch
- Konfidenz: Wahrscheinlich
- Ort: example.env:69-70 (`REQUEST_TIMEOUT_SEC=30`, `LLM_TIMEOUT_SECONDS=20`), config.py:116-117 (gleiche Defaults), Nutzung: LLM-Timeout llm_openvino_genai.py:491-508, Bild-Download-Timeout image_loader.py:47
- Auswirkung: Qwen2.5-3B auf CPU braucht für 220 Tokens i.d.R. deutlich > 20s → `LLM_TIMEOUT` (502). Das Backend wartet bis 150000ms (aiPythonClient.ts:14), aber der Service bricht intern schon nach 20s ab → Jobs schlagen mit LLM_TIMEOUT fehl, obwohl das Backend-Timeout großzügig ist. Spiegelbild zu CLAUDE.md P1-4 (Backend wurde auf 150s gesetzt, der Python-seitige LLM-Timeout aber nicht angepasst).
- Empfehlung: `LLM_TIMEOUT_SECONDS` für CPU realistisch erhöhen (z.B. 120-150s) und mit dem Backend-Timeout (150s) konsistent halten. `REQUEST_TIMEOUT_SEC` (Bild-Download) ist separat und vermutlich ok.
- Aufwand: S

### F: generate_contracts.py überschreibt contracts_models.py beim 2. Lauf (kein Merge)
- Kategorie: DX/Tooling / Toter Code
- Schweregrad: Mittel
- Konfidenz: Wahrscheinlich
- Ort: generate_contracts.py:21-46 (zwei getrennte `datamodel-codegen`-Aufrufe auf dasselbe `--output` OUTPUT; der zweite `--reuse-model` ohne `extra_template`/append überschreibt die Datei)
- Auswirkung: Zwei aufeinanderfolgende Codegen-Calls auf dieselbe Output-Datei: der zweite (Response) ersetzt typischerweise den Inhalt → der generierte `AnalyzeProductRequest` ginge verloren. Das tatsächlich eingecheckte `contracts_models.py` ist offensichtlich hand-erweitert (viele Debug-/TagStat-/DeviceRouting-Modelle, AliasChoices, validate_by_name), die NICHT aus dem Schema kommen. Das Skript regeneriert also nicht verlustfrei → manuelle Edits gehen bei Re-Generierung verloren. Bestätigt CLAUDE.md P2-11 (Contract-Sync nicht automatisiert, Drift-Gefahr).
- Empfehlung: Generierung in EINE Schema-Datei (kombiniert) oder getrennte Output-Module; hand-erweiterte Modelle (Debug etc.) klar von generierten trennen. Bis dahin dokumentieren, dass contracts_models.py manuell gepflegt wird.
- Aufwand: M

### F: Drift zwischen contracts_models.py und contracts/schema – Debug-Felder & Money.currency
- Kategorie: Abhängigkeiten / Korrektheit
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort:
  - contracts_models.py:79-194 enthält viele Debug-Felder, die im Response-Schema FEHLEN: `ClipTagScore` ok, aber `TagStat`, `tagsStrict/tagsSoft/tagStats/tagMergeStrategy/tagMergeFallback/clipTagsImage1/2/clipTagsIntersection/captionsSentToLlm/captionConsensus/captionsPerImage/productFacts/brandCandidate/brandConfidence` sowie LlmDebug-Felder `parsedTitle/parsedDescription/titleLengthWarning/stopStringsUsed/stopTriggered/extractedJson` sind im Schema (analyze-product-response.schema.json:88-144) nicht vorhanden (Schema kennt nur eine Teilmenge).
  - Money.currency: Pydantic `Optional[str]` (contracts_models.py:28); Backend sendet price OHNE currency (aiPythonClient.ts:32-34) → orchestrator.py:331 defaultet hart auf "USD".
- Auswirkung: TS-Contract (und das Schema) decken die Debug-Antwort nicht vollständig ab; ein streng validierender TS-Consumer würde Debug-Felder verlieren/ignorieren. Währung defaultet auf USD, obwohl der Shop EUR ist (LLM-Prompt bekommt "USD").
- Empfehlung: Schema/contracts an die tatsächlichen Debug-Felder angleichen (oder Debug explizit als „lose/zusätzlich" deklarieren). Backend sollte `currency: 'EUR'` mitsenden bzw. Service-Default auf "EUR" setzen.
- Aufwand: M

### F: Pydantic v2 mit v1-Feldoption `min_items`
- Kategorie: Typsicherheit / DX
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: contracts_models.py:202 (`Field(..., min_items=1)`), Datei nutzt sonst v2-APIs (`ConfigDict`, `AliasChoices`, `model_config`)
- Auswirkung: In Pydantic v2 ist `min_items` deprecated (Alias für `min_length`); funktioniert noch, erzeugt aber Deprecation-Warnung und ist inkonsistent. Test test_request_validation.py:7-9 deckt die min-Validierung ab.
- Empfehlung: `min_items=1` → `min_length=1`.
- Aufwand: S

### F: @app.on_event("startup") deprecated (FastAPI/Starlette)
- Kategorie: DX/Tooling
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: main.py:49 (`@app.on_event("startup")`), main.py:93 (`@app.head`)
- Auswirkung: `on_event` ist zugunsten von `lifespan`-Handlern deprecated; künftige Starlette-Versionen entfernen es.
- Empfehlung: Auf `lifespan`-Contextmanager umstellen.
- Aufwand: S

### F: openvino_tokenizers-Extension nur für Windows (os.add_dll_directory)
- Kategorie: Konfiguration / Korrektheit
- Schweregrad: Mittel
- Konfidenz: Wahrscheinlich
- Ort: openvino_tokenizers_ext.py:13 (`DLL_NAME = "openvino_tokenizers.dll"`), :53-54 (`if os.name == "nt": os.add_dll_directory`), README.md:51-52 (Windows-Hinweis)
- Auswirkung: Auf Linux (Prod, Hetzner) heißt die Lib `libopenvino_tokenizers.so`, nicht `.dll`. `ensure_openvino_tokenizers_extension_loaded` sucht ausschließlich `openvino_tokenizers.dll` → findet auf Linux nichts → wirft `MODEL_NOT_AVAILABLE` (im Startup nur geloggt, main.py:57-61; in LlmCopywriter.__init__ llm_openvino_genai.py:239 aber aufgerufen). Auf Linux würde die Extension-Suche fehlschlagen, obwohl `openvino_genai` die Tokenizer evtl. selbst lädt – Verhalten in Prod unklar/ungetestet.
- Empfehlung: Plattformabhängigen DLL-/SO-Namen verwenden (`.so` auf Linux, `.dll` auf Windows, `.dylib` auf macOS) und `add_dll_directory` nur unter nt. Auf Linux ggf. ganz überspringen, wenn openvino_genai die Extension selbst registriert. MUSS auf dem CPU-Linux-Prod-Pfad getestet werden.
- Aufwand: M

### F: Hartkodierte, Fashion-spezifische CLIP-Kandidatenliste
- Kategorie: Architektur/Kopplung / Fehlende Funktion
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: tagger_openvino.py:28-57 (`CANDIDATES_EN` mit socks/t-shirt/hoodie/adidas/nike/puma …)
- Auswirkung: Tagging nur für Kleidung sinnvoll; für andere Vereinsartikel (Tassen, Bälle, Bücher) liefert CLIP irreführende Tags. Markennamen (adidas/nike/puma) sind fest verdrahtet. Nicht konfigurierbar. Bekanntes Problem (CLAUDE.md P3-14).
- Empfehlung: Kandidatenliste in Config/Env oder Datei auslagern; ggf. domänenspezifisch erweitern.
- Aufwand: M

### F: Pipeline ist synchron + lädt Modelle pro Request neu (ClipTagger/Captioner)
- Kategorie: Performance
- Schweregrad: Mittel
- Konfidenz: Bestätigt
- Ort: orchestrator.py:149 (`ClipTagger(routing.clip)` pro Request neu instanziiert → compile_model jedes Mal), :242 (`Captioner(routing.blip)` ebenso). Nur der LLM ist gecacht (llm_openvino_genai.py:511-543 `_LLM_CACHE`). jobs.py:7-8 ist synchroner Wrapper, keine Queue.
- Auswirkung: CLIP- und BLIP-Modelle werden bei JEDEM `/analyze-product` neu gelesen und kompiliert (teuer, v.a. CPU). OV-Compile-Cache (OV_CACHE_DIR) mildert, ersetzt aber nicht das Laden. Auf CPU-Prod deutlich spürbare Latenz pro Request.
- Empfehlung: ClipTagger/Captioner analog zum LLM cachen (Lazy-Singleton pro Device). Synchroner Ablauf ist ok (Job-Queue liegt im Backend), aber Modell-Reuse fehlt.
- Aufwand: M

### F: Bare openvino-Import in config.py-Importkette beim Startup nötig
- Kategorie: Architektur/Kopplung
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: config.py:10 importiert `ov_runtime.normalize_device`, ov_runtime.py:7 `import openvino as ov` (top-level); model_manager.py:15 ebenfalls top-level `import openvino as ov`
- Auswirkung: `get_settings()` (über config→ov_runtime) zieht openvino schon beim Import. Tests, die nur normalize/contracts brauchen, laden damit openvino. Kein Bug, aber harte Kopplung – erschwert leichtgewichtige Unit-Tests/CI ohne OV-Wheels.
- Empfehlung: `normalize_device` ist reine Stringlogik – in ein OV-freies Modul auslagern, openvino lazy importieren.
- Aufwand: S

### F: Tests decken Inferenzpfade nicht ab; Modell-/Device-/Loader-Pfade ungetestet
- Kategorie: Tests/QS
- Schweregrad: Mittel
- Konfidenz: Bestätigt
- Ort: tests/* (5 Dateien): nur LLM-JSON-Parsing (test_llm_output.py), Tag-Merge/Stats (test_multi_image_pipeline.py), normalize (test_normalize.py), orchestrator mit gemockten Modellen (test_orchestrator_multi_image.py), Request-Validierung (test_request_validation.py). Keine Tests für image_loader (path/url/base64), model_manager check_assets, ov_runtime device-resolve, captioner-Decode, SSRF, Linux-Tokenizer.
- Auswirkung: Riskante/komplexe Teile (Asset-Checks, Device-Routing, Bild-Laden, Plattform-DLL) sind ungetestet. Der „Standardfall" Mehrbild ist nur über DummyTagger gemockt (test_orchestrator_multi_image.py:54-87) – echte CLIP-Inferenz ungetestet.
- Empfehlung: Unit-Tests für image_loader (alle kinds + Fehlerfälle), check_assets (missing/fallback-dirs), normalize_device/resolve_device (CPU/GPU/AUTO/MULTI), clean_caption_text. KI-E2E bewusst optional (CLAUDE.md).
- Aufwand: M

### F: parse_llm_output Signatur-Drift – `tags`-Parameter ungenutzt
- Kategorie: Toter Code/Duplikate
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: llm_openvino_genai.py:150-155 (`parse_llm_output(..., tags=None)` – `tags` wird im Body nie verwendet), Aufruf :450-456 reicht `tags=tags` durch, generate(...) :308-327 schleppt `tags` mit
- Auswirkung: `tags` ist ein toter Parameter durch mehrere Funktionen. Verwirrend, suggeriert eine tag-basierte Validierung/Anreicherung die nicht existiert.
- Empfehlung: `tags`-Parameter entfernen oder tatsächlich nutzen.
- Aufwand: S

### F: README beschreibt veraltete/falsche Modell-Layouts und Defaults
- Kategorie: DX/Tooling / Konfiguration
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: README.md:75-83 listet CLIP-Layout `image_encoder/text_encoder/openvino_tokenizer.xml` und caption `model.xml/tokenizer.json`; Code erwartet bei caption `vision_encoder.xml/text_decoder.xml` (model_manager.py:159-164, captioner_openvino.py:32-33). README.md:119 nennt `AI_DEVICE` „only supported value openvino:GPU", während Code DEVICES_* nutzt (config.py:142-150) und `AI_DEVICE` legacy ist. README.md:1 nennt es „microservice" (vs. CLAUDE.md Entscheidung 1: Feature-Modul).
- Auswirkung: Wer dem README folgt, baut falsche Verzeichnisse (caption `model.xml` statt `vision_encoder.xml`) → MODEL_NOT_AVAILABLE.
- Empfehlung: README an den tatsächlichen Code angleichen (caption-Dateinamen, DEVICES_*-Routing, CPU-Prod).
- Aufwand: S

### F: Globaler Exception-Handler leakt str(exc) im Response-Body
- Kategorie: Sicherheit / Observability
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: main.py:31-41 (`details: {"error": str(exc), "path": …}`), main.py:120-130 (`"details": {"error": str(exc)}`)
- Auswirkung: Interne Fehlermeldungen/Pfade werden an den Aufrufer zurückgegeben. Da nur das Backend aufruft (intern), geringes Risiko – aber bei versehentlich exponiertem Port leakt es interne Details.
- Empfehlung: In Prod (DEBUG=0) generische Message zurückgeben, Details nur loggen.
- Aufwand: S

### F: pyproject.toml – irreführender Kommentar + ungepinnte Versionen
- Kategorie: DX/Tooling / Abhängigkeiten
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: pyproject.toml:21 (`# FEHLT für MODEL_FETCH_MODE=download:` direkt über bereits gelisteten optimum-intel/transformers/huggingface-hub – die NICHT fehlen), :6-12,19,23 (fastapi/uvicorn/torch/transformers ohne Pin); openvino-Stack ist gepinnt (:16-18), README.md:48-50 betont Pin-Notwendigkeit.
- Auswirkung: Kommentar ist faktisch falsch (CLAUDE.md P3-15). Ungepinnte transformers/torch können mit dem gepinnten openvino-Stack brechen (README warnt explizit). Reproduzierbarkeit hängt allein an uv.lock.
- Empfehlung: Kommentar korrigieren/entfernen; transformers (und torch in der convert-Gruppe) pinnen.
- Aufwand: S

---

## Fähigkeiten (Pipeline) – Status

| Schritt/Fähigkeit | Status | Beleg |
|---|---|---|
| image_loader: path | ⚠️ (funktioniert, aber Local-File-Read-Risiko) | image_loader.py:25-42 |
| image_loader: url | ⚠️ (funktioniert; SSRF, folgt Redirects) | image_loader.py:45-56 |
| image_loader: base64 (inkl. data:-URI) | ✅ | image_loader.py:59-73 |
| CLIP-Tagging (dual-encoder IR) | ✅ | tagger_openvino.py:79-94, 284-342 |
| CLIP-Kandidaten konfigurierbar | ❌ hartkodiert Fashion | tagger_openvino.py:28-57 |
| multi_image Tag-Merge (Schnittmenge) | ✅ | multi_image.py:93-121 |
| multi_image Fallback (highest avg score) | ⚠️ funktioniert, meldet falsche strategy | multi_image.py:123-136 |
| Tag-Stats / strict+soft Sets | ✅ | multi_image.py:139-240 |
| BLIP-Captioning (greedy decode) | ✅ | captioner_openvino.py:118-257 |
| Caption-Clean / Consensus | ✅ | multi_image.py:243-323 |
| Brand-Detection (BRAND_LIST) | ✅ (nur wenn BRAND_LIST gesetzt) | orchestrator.py:45-84, 271-277 |
| LLM JSON-Extraktion (depth-aware) | ✅ | llm_openvino_genai.py:94-148 |
| LLM JSON-Parse + Schema-Validierung (2-4 Sätze) | ✅ | llm_openvino_genai.py:48-68, 150-231 |
| LLM Retry bei ungültigem JSON | ✅ (genau 1 Retry) | llm_openvino_genai.py:457-468 |
| LLM Timeout-Guard | ⚠️ 20s-Default zu kurz für CPU | llm_openvino_genai.py:484-508, config.py:117 |
| LLM-Pipeline-Cache (pro Device) | ✅ | llm_openvino_genai.py:511-543 |
| CLIP/BLIP-Modell-Cache (Reuse) | ❌ pro Request neu kompiliert | orchestrator.py:149, 242 |
| Device-Routing CPU-Default | ❌ Default GPU/NPU | config.py:142-144 |
| Modell-Asset-Check (offline) | ✅ | model_manager.py:196-301, 478-541 |
| Modell-Download/Convert | ✅ (Dev; OFFLINE blockt) | model_manager.py:366-457, 487-493 |
| Tokenizer-Extension laden | ⚠️ nur .dll/Windows | openvino_tokenizers_ext.py:13,53-54 |
| Deutsch-Output (Entscheidung 2) | ❌ Prompt ist Englisch | prompts.py:8,22 |
| `lang`-Request-Feld genutzt | ❌ ignoriert | contracts_models.py:203 (kein Consumer) |
| Auth auf /analyze-product | ❌ keine | main.py:98-103 |
| normalize_tags | ✅ | normalize.py:4-13 |

Legende: ✅ vorhanden/korrekt · ⚠️ vorhanden mit Einschränkung/Risiko · ❌ fehlt/falsch · 🔲 nicht gebaut · ❓ unklar

---

## Workflow-relevante Notizen: Trace POST /analyze-product

Hop-für-Hop (Happy Path, Mehrbild = Standardfall):

1. **Backend → Service.** backend/src/services/aiPythonClient.ts:22-41 POSTet an `{AI_PY_SERVICE_URL}/analyze-product` ein JSON mit `jobId`, `price.amount` (OHNE `currency`!) und `images: [{kind:'url', value:<APP_URL+pfad>}]`. Backend-Timeout 150000ms (aiPythonClient.ts:14). → **Annahme bestätigt:** Der Service erwartet öffentliche Bild-URLs, die das Backend bereitstellt.

2. **FastAPI-Endpoint.** main.py:98-111 validiert Body gegen `AnalyzeProductRequest` (contracts_models.py:197-207; `images` min 1, `price.amount > 0`). Loggt job_id/price/anzahl. Ruft `analyze(payload)` (Zeile 111).

3. **jobs.analyze.** jobs.py:7-8 → reiner Wrapper → `run_pipeline(payload)`. **Keine eigene Job-Queue** (synchron, bestätigt CLAUDE.md 2.5).

4. **orchestrator.run_pipeline.** orchestrator.py:119-373.
   - Bricht ab, wenn `ENABLE_CPU_FALLBACK` (=true) gesetzt – paradox benannt: Flag „CPU fallback erlauben" führt zu HARTEM ABBRUCH (orchestrator.py:120-126). **Bruchstelle/Annahme:** In Prod muss `ENABLE_CPU_FALLBACK=0` bleiben (example.env:25), sonst 400.
   - `ensure_models(mode="never", offline=…)` (Zeile 128) prüft nur Vorhandensein, lädt nichts.
   - `routing = settings.device_routing()` (Zeile 129) → CLIP/BLIP/LLM-Devices. **Bruchstelle:** Default GPU/NPU; auf CPU-Prod ohne `DEVICES_*=CPU` → später DEVICE_NOT_AVAILABLE.

5. **image_loader.load_images.** orchestrator.py:145 → image_loader.py:76-102. Für jedes ImageRef: `kind=='url'` → `_load_from_url` (requests.get, RGB). **Bruchstelle:** Bilder müssen vom Service aus erreichbar sein (APP_URL muss aus Service-Sicht auflösbar sein – im Docker-Netz nicht automatisch der Browser-Host!). SSRF-Risiko hier.

6. **CLIP-Tagging pro Bild.** orchestrator.py:148-161. `ClipTagger(routing.clip)` (NEU pro Request, Zeile 149) → tagger.predict([image], …) je Bild → `tags_per_image`. Tags aus hartkodierter CANDIDATES_EN (tagger_openvino.py:292-309). CLIP-Output via Cosine-Similarity, Top-N (tagger_openvino.py:303-304).

7. **multi_image-Merge.** orchestrator.py:162-175. `merge_tags_for_images` (Schnittmenge; bei leerer Schnittmenge Fallback aufs Bild mit höchstem Avg-Score, multi_image.py:73-136). `build_tag_sets` → tags_strict (Schnittmenge), tags_soft (>= TAG_SHARED_MIN_RATIO Frequenz), tag_stats.

8. **BLIP-Captioning.** orchestrator.py:241-249. `Captioner(routing.blip)` (NEU pro Request) → greedy decode je Bild (captioner_openvino.py:240-257). `captions[]` mit imageIndex.

9. **Caption-Aufbereitung.** orchestrator.py:258-270. `captions_per_image` (ordnet nach Index, multi_image.py:326-338) → `clean_caption_text` (Dedup/Trunc) → `build_caption_consensus` (Top-Unigramme).

10. **Brand-Detection + product_facts.** orchestrator.py:271-286. `_detect_brand` (nur wenn BRAND_LIST gesetzt) → `build_product_facts` (Dict mit tags_per_image/strict/soft/stats/captions/consensus/brand).

11. **LLM.** orchestrator.py:251-339.
    - `get_llm_copywriter(routing.llm)` (gecacht, llm_openvino_genai.py:511-543). LlmCopywriter.__init__ lädt `openvino_genai`, prüft Device-Whitelist {GPU,NPU,(CPU)} (Zeile 248-272), kompiliert LLMPipeline.
    - `build_copy_prompt` (prompts.py:15-39, **ENGLISCH**) mit price_amount + currency (defaultet "USD", orchestrator.py:331) + product_facts-JSON.
    - `_generate_with_retry` → `_generate_with_timeout` (ThreadPool, LLM_TIMEOUT_SECONDS=20, **zu kurz für CPU**) → roher Output → `_extract_first_json_object_with_span` → `parse_llm_output` (JSON + 2-4-Sätze-Validierung). Bei Invalidität: 1 Retry mit „Return ONLY JSON…", sonst LLM_OUTPUT_INVALID (502) – oder bei debug_response: leere Strings (allow_debug_failure).

12. **Response-Bau.** orchestrator.py:343-368. `AnalyzeProductResponse` mit:
    - `jobId` (durchgereicht), `title`, `description` (aus LLM),
    - `tags` = `merged.merged_tags` (List[Tag]),
    - `captions` = List[Caption] (imageIndex/text/source),
    - `meta`: contractVersion="1.0", **device = routing.llm (nur LLM-Device!)**, models (Pfad-Strings), timings (ms je Stufe),
    - `debug` (nur wenn debug_response) = AnalyzeDebug.
    Serialisierung mit Alias (camelCase via ConfigDict validate_by_name + alias). → Zurück über jobs → main → JSON 200.

13. **Fehlerpfade.** AiServiceError → main.py:112-119 (status aus exc.http_status, contract-dict, optional debug). Unerwartet → main.py:120-130 (500, code INFERENCE_FAILED, str(exc) im Body). Globale Handler main.py:22-41.

**Zentrale Bruchstellen/Annahmen für Prod (CPU/Hetzner):**
- DEVICES_* müssen explizit auf CPU (Default ist GPU/NPU) – sonst startet die Pipeline nicht.
- LLM_TIMEOUT_SECONDS (20s) << Backend-Timeout (150s) → interner Timeout greift zuerst.
- Tokenizer-Extension-Suche ist `.dll`/Windows-only → Linux-Pfad ungetestet.
- prompts.py ist Englisch, Entscheidung 2 verlangt Deutsch; `lang` wird ignoriert.
- Bild-URLs müssen aus Service-Sicht (Docker-Netz) erreichbar sein (APP_URL-Auflösung).
- Währung „USD" hartkodiert als Fallback, obwohl Shop deutsch/EUR.
- CLIP/BLIP werden pro Request neu kompiliert (nur LLM gecacht) → CPU-Latenz.
