"""Extract Table 3/4 condition text and cross-check medicine codes in the 2026 guide.

Requires pypdf. The generated file is consumed by the XLS extractor, so the
browser bundle never needs a PDF parser.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "2026-yuksekogretim-kurumlari-sinavi-yks-yuksekogretim-programlari-ve-kontenjanlari-kilavuzu-h5q8kv-30170002.pdf"
OUTPUT = ROOT / "src/data/yks/pdf-crosscheck-2026.json"


def clean(value: str) -> str:
    value = re.sub(r"<<<PAGE:\d+>>>", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def main() -> None:
    if not PDF.exists():
        raise SystemExit(f"Missing official PDF: {PDF.name}")

    reader = PdfReader(str(PDF))

    # Printed pages 542-566 correspond to physical PDF pages 544-568.
    condition_chunks: list[str] = []
    for index in range(543, min(569, len(reader.pages))):
        text = reader.pages[index].extract_text() or ""
        condition_chunks.append(f"<<<PAGE:{index + 1}>>>\n{text}")
    condition_blob = "\n".join(condition_chunks)
    markers = list(re.finditer(r"\bBk\.\s*(\d+)\b", condition_blob))
    conditions: dict[str, dict[str, object]] = {}
    for position, marker in enumerate(markers):
        code = marker.group(1)
        end = markers[position + 1].start() if position + 1 < len(markers) else len(condition_blob)
        preceding = condition_blob[: marker.start()]
        page_matches = list(re.finditer(r"<<<PAGE:(\d+)>>>", preceding))
        page = int(page_matches[-1].group(1)) if page_matches else None
        conditions[code] = {
            "code": int(code),
            "text": clean(condition_blob[marker.end() : end]),
            "pdfPage": page,
        }

    # Cross-check Table 4 only. A single bounded pass maps each program code to
    # its physical PDF page and proves that generated XLS rows occur in the PDF.
    program_pages: dict[str, int] = {}
    for index in range(141, min(543, len(reader.pages))):
        text = reader.pages[index].extract_text() or ""
        for code in re.findall(r"(?<!\d)(\d{9})(?!\d)", text):
            program_pages.setdefault(code, index + 1)

    payload = {
        "schemaVersion": 1,
        "source": PDF.name,
        "sha256": hashlib.sha256(PDF.read_bytes()).hexdigest(),
        "pdfPages": len(reader.pages),
        "conditionSectionPhysicalPages": [544, 568],
        "conditions": conditions,
        "programPages": program_pages,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)}: {len(conditions)} conditions, {len(program_pages)} Table 4 codes")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # fail loudly in generation/CI jobs
        print(f"PDF extraction failed: {error}", file=sys.stderr)
        raise
