from __future__ import annotations

import csv
from io import StringIO

from fastapi import UploadFile


EXPECTED_HEADERS = {
    "full_name": "full_name",
    "fullname": "full_name",
    "name": "full_name",
    "email": "email",
    "phone": "phone",
    "department": "department",
    "graduation_year": "graduation_year",
    "graduationyear": "graduation_year",
}


async def parse_csv_upload(file: UploadFile) -> list[dict[str, str]]:
    content = await file.read()

    decoded: str
    try:
        decoded = content.decode("utf-8")
    except UnicodeDecodeError:
        decoded = content.decode("latin-1")

    reader = csv.DictReader(StringIO(decoded))
    rows: list[dict[str, str]] = []

    for raw_row in reader:
        normalized_row: dict[str, str] = {}
        for key, value in raw_row.items():
            if key is None:
                continue
            normalized_key = EXPECTED_HEADERS.get(key.strip().lower())
            if not normalized_key:
                continue
            normalized_row[normalized_key] = (value or "").strip()
        rows.append(normalized_row)

    return rows
