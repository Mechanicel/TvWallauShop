from __future__ import annotations

import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTRACTS_SCHEMA = ROOT.parent / "contracts" / "schema"
OUTPUT = ROOT / "app" / "contracts_models.py"


def main() -> None:
    request_schema = CONTRACTS_SCHEMA / "analyze-product-request.schema.json"
    response_schema = CONTRACTS_SCHEMA / "analyze-product-response.schema.json"

    if not request_schema.exists() or not response_schema.exists():
        raise SystemExit(
            "Contracts schema files not found. Run `npm run gen:schema` in contracts."
        )

    command = [
        "datamodel-codegen",
        "--input",
        str(request_schema),
        "--input-file-type",
        "jsonschema",
        "--output",
        str(OUTPUT),
        "--class-name",
        "AnalyzeProductRequest",
    ]
    subprocess.run(command, check=True)

    command = [
        "datamodel-codegen",
        "--input",
        str(response_schema),
        "--input-file-type",
        "jsonschema",
        "--output",
        str(OUTPUT),
        "--class-name",
        "AnalyzeProductResponse",
        "--reuse-model",
    ]
    subprocess.run(command, check=True)


if __name__ == "__main__":
    main()
