"""Normalize official ÖSYM/YÖK medicine rows for the 2026 lineage audit.

This is a research helper, not a build dependency. It expects the official
files to be downloaded separately so large source documents are not committed:

* 2026 ÖSYM guide PDF
* 2025, 2024 and 2023 ÖSYM Table-4 guide workbooks
* 2025 ÖSYM placement-results Table-4 workbook
* 2026 and historical YÖK Atlas medicine API snapshots

Example:
    python scripts/yks/audit_official_sources.py \
      --source-dir C:/tmp/yks-audit \
      --output C:/tmp/yks-audit/normalized-medicine.json
"""

from __future__ import annotations

import argparse
import json
import math
import re
import unicodedata
from pathlib import Path
from typing import Any

import pandas as pd


YEARS = (2025, 2024, 2023)
SCHOLARSHIP_LABELS = {
    "Burslu": "full",
    "%50 İndirimli": "half",
    "%25 İndirimli": "quarter",
    "Ücretli": "paid",
}


def clean_text(value: Any) -> str | None:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    return re.sub(r"\s+", " ", str(value)).strip()


def as_int(value: Any) -> int | None:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    text = str(value).strip().replace(",", ".")
    if not text or text in {"...", "----", "-", "nan"}:
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def as_float(value: Any) -> float | None:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    text = str(value).strip().replace(",", ".")
    if not text or text in {"...", "----", "--", "-", "nan"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def normalize(value: str | None) -> str:
    if not value:
        return ""
    value = value.replace("İ", "I").replace("ı", "i")
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def scholarship(program_name: str) -> str | None:
    for label, key in SCHOLARSHIP_LABELS.items():
        if f"({label})" in program_name:
            return key
    return None


def language(program_name: str) -> str:
    return "en" if "(İngilizce)" in program_name else "tr"


def is_university_heading(text: str) -> bool:
    return "Üniversitesi)" in text or text.endswith("(Vakıf Üniversitesi)")


def read_guide_rows(path: Path, year: int) -> list[dict[str, Any]]:
    frame = pd.read_excel(path, header=None)
    rows: list[dict[str, Any]] = []
    university: str | None = None
    faculty: str | None = None

    for values in frame.itertuples(index=False, name=None):
        code = as_int(values[0])
        label = clean_text(values[1])
        if not label:
            continue

        if code is None:
            if is_university_heading(label):
                university = re.sub(
                    r"\s+\((?:[^()]|\([^)]*\))*Üniversitesi\)\s*$", "", label
                ).strip()
                faculty = None
            elif university and not any(
                marker in label
                for marker in (
                    "PROGRAM ADI",
                    "Merkezi Yerleştirme",
                    "TABLO-4",
                    "YÜKSEKÖĞRETİM PROGRAMLARI",
                )
            ):
                faculty = label
            continue

        if not university or not label.startswith("Tıp"):
            continue
        duration = as_int(values[2])
        score_type = clean_text(values[3])
        if duration != 6 or score_type != "SAY":
            continue

        rows.append(
            {
                "year": year,
                "code": str(code),
                "university": university,
                "faculty": faculty,
                "programName": label,
                "language": language(label),
                "scholarshipType": scholarship(label),
                "quota": as_int(values[4]),
                "previousYearClosingRank": as_int(values[11]),
            }
        )

    return rows


def read_2025_results(path: Path) -> dict[str, dict[str, Any]]:
    frame = pd.read_excel(path, header=2)
    results: dict[str, dict[str, Any]] = {}
    for values in frame.itertuples(index=False, name=None):
        code = as_int(values[0])
        name = clean_text(values[4])
        if code is None or not name or not name.startswith("Tıp"):
            continue
        results[str(code)] = {
            "code": str(code),
            "university": clean_text(values[2]),
            "faculty": clean_text(values[3]),
            "programName": name,
            "quota": as_int(values[6]),
            "placed": as_int(values[7]),
            "minScore": as_float(values[8]),
            "filled": (
                as_int(values[6]) is not None
                and as_int(values[7]) is not None
                and as_int(values[7]) >= as_int(values[6])
            ),
        }
    return results


def compact_current(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "year": 2026,
        "code": str(row["kilavuzKodu"]),
        "university": clean_text(row.get("universiteAdi")),
        "universityType": clean_text(row.get("universiteTuru")),
        "faculty": clean_text(row.get("fymkAdi")),
        "programName": clean_text(row.get("birimAdi")),
        "city": clean_text(row.get("ilAdi")),
        "language": "en" if row.get("ogrenimDiliAdi") == "İngilizce" else "tr",
        "scholarshipType": {
            "Burslu": "full",
            "%50 İndirimli": "half",
            "%25 İndirimli": "quarter",
            "Ücretli": "paid",
        }.get(row.get("bursOraniAdi")),
        "quota": as_int(row.get("kontenjan")),
        "specialConditions": sorted(
            int(item)
            for item in re.findall(r"\d+", clean_text(row.get("kosul")) or "")
        ),
        "closingRank2025": as_int(row.get("basariSirasi")),
        "minScore2025": row.get("minPuan"),
        "olderExactCode": [
            {
                "year": year,
                "quota": as_int(row.get(f"gk{index}")),
                "placed": as_int(row.get(f"gkY{index}")),
                "minScore": row.get(f"minPuan{index}"),
                "closingRank": as_int(row.get(f"basariSirasi{index}")),
            }
            for index, year in enumerate((2024, 2023, 2022), start=1)
            if row.get(f"gk{index}") is not None
            or row.get(f"minPuan{index}") is not None
            or row.get(f"basariSirasi{index}") is not None
        ],
    }


def current_match_score(current: dict[str, Any], prior: dict[str, Any]) -> int:
    """Rank plausible predecessors; review remains mandatory."""
    score = 0
    if normalize(current["university"]) == normalize(prior["university"]):
        score += 100
    if normalize(current["faculty"]) == normalize(prior["faculty"]):
        score += 30
    if current["language"] == prior["language"]:
        score += 30
    if current["scholarshipType"] == prior["scholarshipType"]:
        score += 20
    if current["code"] == prior["code"]:
        score += 1000
    if current["quota"] and prior["quota"]:
        score += max(0, 20 - abs(current["quota"] - prior["quota"]))
    return score


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    guide_rows = {
        year: read_guide_rows(
            args.source_dir / f"{year}-guide-table4.xls", year
        )
        for year in YEARS
    }
    results_2025 = read_2025_results(
        args.source_dir / "2025-results-table4.xlsx"
    )

    current_raw = json.loads(
        (args.source_dir / "yok-atlas-2026-medicine.json").read_text(
            encoding="utf-8-sig"
        )
    )
    current = [compact_current(row) for row in current_raw["content"]]
    prior_2025 = guide_rows[2025]

    for row in prior_2025:
        row["placement"] = results_2025.get(row["code"])

    candidates: dict[str, list[dict[str, Any]]] = {}
    for row in current:
        ranked = sorted(
            (
                {
                    **prior,
                    "matchScore": current_match_score(row, prior),
                }
                for prior in prior_2025
                if normalize(row["university"]) == normalize(prior["university"])
                and row["language"] == prior["language"]
            ),
            key=lambda item: (-item["matchScore"], item["code"]),
        )
        candidates[row["code"]] = ranked[:6]

    payload = {
        "sourceFiles": {
            "guide2026": "kontkilavuz_yktd21072026.pdf",
            "guideTables": {
                str(year): f"{year}-guide-table4.xls" for year in YEARS
            },
            "placementResults2025": "2025-results-table4.xlsx",
            "yokAtlas2026": "yok-atlas-2026-medicine.json",
        },
        "counts": {
            "currentApiMedicineRows": len(current),
            "guideMedicineRows": {
                str(year): len(rows) for year, rows in guide_rows.items()
            },
            "placementMedicineRows2025": len(results_2025),
        },
        "current2026": current,
        "guides": {str(year): rows for year, rows in guide_rows.items()},
        "predecessorCandidates": candidates,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(json.dumps(payload["counts"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
