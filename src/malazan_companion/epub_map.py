from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .epub_inspect import inspect_epub


@dataclass(frozen=True)
class EpubSection:
    position: int
    label: str
    href: str | None


def build_section_map(epub_path: str | Path) -> list[EpubSection]:
    """Return ordered TOC sections without reading/exporting body text."""
    inspection = inspect_epub(epub_path)
    sections: list[EpubSection] = []
    for idx, item in enumerate(inspection.toc, start=1):
        label = item.get("label") or f"Section {idx}"
        sections.append(EpubSection(position=idx, label=label, href=item.get("src")))
    return sections
