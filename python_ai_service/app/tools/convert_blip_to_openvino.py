from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import openvino as ov
import torch
from PIL import Image
from transformers import BlipForConditionalGeneration, BlipProcessor


def _flatten_past_key_values(past_key_values: tuple[tuple[torch.Tensor, torch.Tensor], ...]) -> tuple[torch.Tensor, ...]:
    flat: list[torch.Tensor] = []
    for layer in past_key_values:
        flat.extend(layer)
    return tuple(flat)


def _pair_past_key_values(flat: tuple[torch.Tensor, ...]) -> tuple[tuple[torch.Tensor, torch.Tensor], ...]:
    if len(flat) % 2 != 0:
        raise ValueError("Past key values must be an even-length tuple of tensors.")
    paired: list[tuple[torch.Tensor, torch.Tensor]] = []
    for idx in range(0, len(flat), 2):
        paired.append((flat[idx], flat[idx + 1]))
    return tuple(paired)


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
        encoder_attention_mask: torch.Tensor,
    ) -> tuple[torch.Tensor, ...]:
        outputs = self.decoder(
            input_ids=input_ids,
            attention_mask=attention_mask,
            encoder_hidden_states=encoder_hidden_states,
            encoder_attention_mask=encoder_attention_mask,
            use_cache=True,
            return_dict=True,
        )
        flat_past = _flatten_past_key_values(outputs.past_key_values)
        return (outputs.logits, *flat_past)


class TextDecoderWithPastWrapper(torch.nn.Module):
    def __init__(self, model: BlipForConditionalGeneration) -> None:
        super().__init__()
        self.decoder = model.text_decoder

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        encoder_hidden_states: torch.Tensor,
        encoder_attention_mask: torch.Tensor,
        *past_key_values: torch.Tensor,
    ) -> tuple[torch.Tensor, ...]:
        paired_past = _pair_past_key_values(tuple(past_key_values))
        outputs = self.decoder(
            input_ids=input_ids,
            attention_mask=attention_mask,
            encoder_hidden_states=encoder_hidden_states,
            encoder_attention_mask=encoder_attention_mask,
            past_key_values=paired_past,
            use_cache=True,
            return_dict=True,
        )
        flat_past = _flatten_past_key_values(outputs.past_key_values)
        return (outputs.logits, *flat_past)


def _build_dummy_inputs(processor: BlipProcessor) -> torch.Tensor:
    dummy_image = Image.fromarray(np.zeros((384, 384, 3), dtype=np.uint8))
    inputs = processor(images=dummy_image, return_tensors="pt")
    pixel_values = inputs["pixel_values"]
    return pixel_values


def _build_decoder_inputs(
    processor: BlipProcessor,
    encoder_hidden_states: torch.Tensor,
) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    tokenizer = processor.tokenizer
    bos_token_id = tokenizer.bos_token_id
    if bos_token_id is None:
        bos_token_id = tokenizer.cls_token_id or 0
    input_ids = torch.tensor([[bos_token_id]], dtype=torch.long)
    attention_mask = torch.ones_like(input_ids)
    encoder_attention_mask = torch.ones(
        encoder_hidden_states.shape[:2], dtype=torch.long
    )
    return input_ids, attention_mask, encoder_attention_mask


def convert(model_id: str, outdir: Path) -> None:
    outdir.mkdir(parents=True, exist_ok=True)
    print(f"Loading BLIP model '{model_id}'...")
    model = BlipForConditionalGeneration.from_pretrained(model_id)
    processor = BlipProcessor.from_pretrained(model_id)
    model.eval()

    pixel_values = _build_dummy_inputs(processor)
    with torch.no_grad():
        encoder_hidden_states = model.vision_model(
            pixel_values=pixel_values, return_dict=True
        ).last_hidden_state

    input_ids, attention_mask, encoder_attention_mask = _build_decoder_inputs(
        processor, encoder_hidden_states
    )

    print("Converting vision encoder...")
    vision_wrapper = VisionEncoderWrapper(model)
    ov_vision = ov.convert_model(vision_wrapper, example_input=pixel_values)
    vision_path = outdir / "vision_encoder.xml"
    ov.save_model(ov_vision, vision_path)

    print("Converting text decoder...")
    decoder_wrapper = TextDecoderWrapper(model)
    ov_decoder = ov.convert_model(
        decoder_wrapper,
        example_input=(
            input_ids,
            attention_mask,
            encoder_hidden_states,
            encoder_attention_mask,
        ),
    )
    decoder_path = outdir / "text_decoder.xml"
    ov.save_model(ov_decoder, decoder_path)

    print("Preparing decoder-with-past inputs...")
    with torch.no_grad():
        decoder_outputs = model.text_decoder(
            input_ids=input_ids,
            attention_mask=attention_mask,
            encoder_hidden_states=encoder_hidden_states,
            encoder_attention_mask=encoder_attention_mask,
            use_cache=True,
            return_dict=True,
        )
    flat_past = _flatten_past_key_values(decoder_outputs.past_key_values)

    print("Converting text decoder with past...")
    decoder_with_past_wrapper = TextDecoderWithPastWrapper(model)
    ov_decoder_with_past = ov.convert_model(
        decoder_with_past_wrapper,
        example_input=(
            input_ids,
            attention_mask,
            encoder_hidden_states,
            encoder_attention_mask,
            *flat_past,
        ),
    )
    decoder_with_past_path = outdir / "text_decoder_with_past.xml"
    ov.save_model(ov_decoder_with_past, decoder_with_past_path)

    print("Saving processor configuration...")
    processor.save_pretrained(outdir)

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
