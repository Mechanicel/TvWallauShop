from __future__ import annotations

import argparse
import importlib.util
import sys
from pathlib import Path

import openvino as ov
import torch
from transformers import CLIPModel, CLIPProcessor

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


class ImageEncoderWrapper(torch.nn.Module):
    def __init__(self, model: CLIPModel) -> None:
        super().__init__()
        self.model = model

    def forward(self, pixel_values: torch.Tensor) -> torch.Tensor:
        return self.model.get_image_features(pixel_values=pixel_values)


class TextEncoderWrapper(torch.nn.Module):
    def __init__(self, model: CLIPModel) -> None:
        super().__init__()
        self.model = model

    def forward(self, input_ids: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
        return self.model.get_text_features(
            input_ids=input_ids, attention_mask=attention_mask
        )


def _assert_ir_outputs(xml_path: Path) -> None:
    bin_path = xml_path.with_suffix(".bin")
    if not xml_path.exists() or not bin_path.exists():
        raise RuntimeError(
            f"Expected OpenVINO IR files not found: {xml_path.name}, {bin_path.name}"
        )


def _require_module(module_name: str) -> None:
    if importlib.util.find_spec(module_name) is None:
        print(
            "[ERROR] Conversion failed: missing dependency 'onnxscript'. Install: pip install onnx onnxscript",
            file=sys.stderr,
        )
        raise SystemExit(1)


def _export_image_encoder(
    model: CLIPModel, pixel_values: torch.Tensor, onnx_path: Path
) -> None:
    wrapper = ImageEncoderWrapper(model)
    torch.onnx.export(
        wrapper,
        (pixel_values,),
        str(onnx_path),
        opset_version=18,
        do_constant_folding=True,
        input_names=["pixel_values"],
        output_names=["image_embeds"],
    )


def _export_text_encoder(
    model: CLIPModel,
    input_ids: torch.Tensor,
    attention_mask: torch.Tensor,
    onnx_path: Path,
) -> None:
    wrapper = TextEncoderWrapper(model)
    torch.onnx.export(
        wrapper,
        (input_ids, attention_mask),
        str(onnx_path),
        opset_version=18,
        do_constant_folding=True,
        input_names=["input_ids", "attention_mask"],
        output_names=["text_embeds"],
    )


def convert(model_id: str, outdir: Path) -> None:
    _require_module("onnxscript")
    if importlib.util.find_spec("onnx") is None:
        print(
            "[ERROR] Conversion failed: missing dependency 'onnx'. Install: pip install onnx onnxscript",
            file=sys.stderr,
        )
        raise SystemExit(1)
    outdir.mkdir(parents=True, exist_ok=True)
    print(f"[INFO] Loading CLIP model '{model_id}'...")
    processor = CLIPProcessor.from_pretrained(model_id)
    model = CLIPModel.from_pretrained(model_id)
    model.eval()

    print("[INFO] Saving processor configuration...")
    processor.save_pretrained(outdir)

    pixel_values = torch.zeros((1, 3, 224, 224), dtype=torch.float32)
    input_ids = torch.zeros((1, 16), dtype=torch.int64)
    attention_mask = torch.ones((1, 16), dtype=torch.int64)

    image_onnx = outdir / "image_encoder.onnx"
    text_onnx = outdir / "text_encoder.onnx"

    print("[INFO] Exporting image encoder to ONNX...")
    _export_image_encoder(model, pixel_values, image_onnx)

    print("[INFO] Exporting text encoder to ONNX...")
    _export_text_encoder(model, input_ids, attention_mask, text_onnx)

    print("[INFO] Converting ONNX to OpenVINO IR...")
    image_ir = outdir / "image_encoder.xml"
    text_ir = outdir / "text_encoder.xml"

    image_ov = ov.convert_model(str(image_onnx))
    ov.save_model(image_ov, str(image_ir))

    text_ov = ov.convert_model(str(text_onnx))
    ov.save_model(text_ov, str(text_ir))

    _assert_ir_outputs(image_ir)
    _assert_ir_outputs(text_ir)

    print("[OK] Conversion completed. Generated files:")
    for path in sorted(outdir.iterdir()):
        if path.is_file():
            print(f"[INFO] - {path.name}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert CLIP to OpenVINO IR.")
    parser.add_argument("--model-id", required=True, help="Hugging Face model ID.")
    parser.add_argument("--outdir", required=True, help="Output directory.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    outdir = Path(args.outdir)
    try:
        convert(args.model_id, outdir)
    except Exception as exc:
        print(f"[ERROR] Conversion failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
