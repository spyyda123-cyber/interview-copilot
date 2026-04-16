import re
from typing import Dict, List

import tiktoken

SECTION_MAP = {
    "skills": ["skills", "technical skills", "core skills"],
    "projects": ["projects", "project experience"],
    "experience": ["experience", "work experience", "professional experience"],
    "education": ["education", "academics"],
}


def normalize_heading(line: str) -> str | None:
    cleaned = re.sub(r"[^a-zA-Z\s]", "", line).strip().lower()
    for section, aliases in SECTION_MAP.items():
        if cleaned in aliases:
            return section
    return None


def extract_sections(text: str) -> Dict[str, str]:
    sections: Dict[str, List[str]] = {key: [] for key in SECTION_MAP.keys()}
    current = None

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        heading = normalize_heading(line)
        if heading:
            current = heading
            continue
        if current:
            sections[current].append(line)

    return {key: "\n".join(value).strip() for key, value in sections.items() if value}


def chunk_text(text: str, max_tokens: int = 400) -> List[str]:
    encoding = tiktoken.get_encoding("cl100k_base")
    tokens = encoding.encode(text)
    chunks: List[str] = []
    start = 0
    while start < len(tokens):
        end = min(start + max_tokens, len(tokens))
        chunk_tokens = tokens[start:end]
        chunks.append(encoding.decode(chunk_tokens))
        start = end
    return chunks
