from __future__ import annotations

import argparse
import importlib.util
import sys
from pathlib import Path

import openvino as ov
import torch
from transformers import BlipForConditionalGeneration, BlipProcessor


class VisionEncoderWrapper(torch.nn.Module):
    def __init__(self, model: BlipForConditionalGeneration) -> None:
        super().__init__()
        self.vision_model = model.vision_model

    def forward(self, pixel_values: torch.Tensor) -> torch.Tensor:
        outputs = self.vision_model(pixel_values=pixel_values, return_dict=True)
        return outputs.last_hidden_state


class TextDecoderWrapper(torch.nn.Module):
    def __init__(self, model: BlipForConditionalGeneration) -> None:
        super().__init__()
        self.decoder = model.text_decoder

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        encoder_hidden_states: torch.Tensor,
    ) -> torch.Tensor:
        outputs = self.decoder(
            input_ids=input_ids,
            attention_mask=attention_mask,
            encoder_hidden_states=encoder_hidden_states,
            use_cache=False,
            return_dict=True,
        )
        return outputs.logits


def _resolve_bos_token_id(processor: BlipProcessor) -> int:
    tokenizer = processor.tokenizer
    return tokenizer.bos_token_id or tokenizer.cls_token_id or 0


def _assert_ir_outputs(xml_path: Path) -> None:
    bin_path = xml_path.with_suffix(".bin")
    if not xml_path.exists() or not bin_path.exists():
        raise RuntimeError(
            f"Expected OpenVINO IR files not found: {xml_path.name}, {bin_path.name}"
        )


def _require_module(module_name: str) -> None:
    if importlib.util.find_spec(module_name) is None:
        print(
            "Conversion failed: missing dependency 'onnxscript'. Install: pip install onnx onnxscript",
            file=sys.stderr,
        )
        raise SystemExit(1)


def _export_vision_encoder(
    model: BlipForConditionalGeneration,
    pixel_values: torch.Tensor,
    onnx_path: Path,
) -> None:
    wrapper = VisionEncoderWrapper(model)
    torch.onnx.export(
        wrapper,
        (pixel_values,),
        str(onnx_path),
        opset_version=17,
        do_constant_folding=True,
        input_names=["pixel_values"],
        output_names=["image_embeds"],
    )


def _export_text_decoder(
    model: BlipForConditionalGeneration,
    input_ids: torch.Tensor,
    attention_mask: torch.Tensor,
    encoder_hidden_states: torch.Tensor,
    onnx_path: Path,
) -> None:
    wrapper = TextDecoderWrapper(model)
    torch.onnx.export(
        wrapper,
        (input_ids, attention_mask, encoder_hidden_states),
        str(onnx_path),
        opset_version=17,
        do_constant_folding=True,
        input_names=["input_ids", "attention_mask", "encoder_hidden_states"],
        output_names=["logits"],
    )


def convert(model_id: str, outdir: Path) -> None:
    _require_module("onnxscript")
    if importlib.util.find_spec("onnx") is None:
        print(
            "Conversion failed: missing dependency 'onnx'. Install: pip install onnx onnxscript",
            file=sys.stderr,
        )
        raise SystemExit(1)
    outdir.mkdir(parents=True, exist_ok=True)
    print(f"Loading BLIP model '{model_id}'...")
    processor = BlipProcessor.from_pretrained(model_id)
    model = BlipForConditionalGeneration.from_pretrained(model_id)
    model.eval()
    model.config.use_cache = False

    print("Saving processor configuration...")
    processor.save_pretrained(outdir)

    pixel_values = torch.zeros((1, 3, 224, 224), dtype=torch.float32)
    with torch.no_grad():
        encoder_hidden_states = model.vision_model(
            pixel_values=pixel_values, return_dict=True
        ).last_hidden_state

    bos_token_id = _resolve_bos_token_id(processor)
    input_ids = torch.tensor([[bos_token_id]], dtype=torch.long)
    attention_mask = torch.ones_like(input_ids)

    vision_onnx = outdir / "vision_encoder.onnx"
    text_onnx = outdir / "text_decoder.onnx"

    print("Exporting vision encoder to ONNX...")
    _export_vision_encoder(model, pixel_values, vision_onnx)

    print("Exporting text decoder to ONNX...")
    _export_text_decoder(model, input_ids, attention_mask, encoder_hidden_states, text_onnx)

    print("Converting ONNX to OpenVINO IR...")
    vision_ir = outdir / "vision_encoder.xml"
    text_ir = outdir / "text_decoder.xml"

    vision_ov = ov.convert_model(str(vision_onnx))
    ov.save_model(vision_ov, str(vision_ir))

    text_ov = ov.convert_model(str(text_onnx))
    ov.save_model(text_ov, str(text_ir))

    _assert_ir_outputs(vision_ir)
    _assert_ir_outputs(text_ir)

    print("Conversion completed. Generated files:")
    for path in sorted(outdir.iterdir()):
        if path.is_file():
            print(f"- {path.name}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert BLIP to OpenVINO IR.")
    parser.add_argument("--model-id", required=True, help="Hugging Face model ID.")
    parser.add_argument("--outdir", required=True, help="Output directory.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    outdir = Path(args.outdir)
    try:
        convert(args.model_id, outdir)
    except Exception as exc:
        print(f"Conversion failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
