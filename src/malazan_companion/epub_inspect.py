"""Safe EPUB inspection utilities.

Reads EPUB metadata/table-of-contents structure without exporting full copyrighted text.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
import json
import re
import zipfile
import xml.etree.ElementTree as ET

NS = {
    "container": "urn:oasis:names:tc:opendocument:xmlns:container",
    "opf": "http://www.idpf.org/2007/opf",
    "dc": "http://purl.org/dc/elements/1.1/",
    "ncx": "http://www.daisy.org/z3986/2005/ncx/",
}


@dataclass
class EpubInspection:
    title: str | None
    creator: str | None
    language: str | None
    spine_count: int
    toc: list[dict]
    manifest_items: list[dict]


def _read_xml(zf: zipfile.ZipFile, name: str) -> ET.Element:
    return ET.fromstring(zf.read(name))


def inspect_epub(path: str | Path) -> EpubInspection:
    path = Path(path)
    with zipfile.ZipFile(path) as zf:
        container = _read_xml(zf, "META-INF/container.xml")
        rootfile = container.find(".//container:rootfile", NS)
        if rootfile is None:
            raise ValueError("EPUB container missing rootfile")
        opf_path = rootfile.attrib["full-path"]
        opf_dir = str(Path(opf_path).parent)
        package = _read_xml(zf, opf_path)

        def text_or_none(query: str) -> str | None:
            el = package.find(query, NS)
            return el.text.strip() if el is not None and el.text else None

        title = text_or_none(".//dc:title")
        creator = text_or_none(".//dc:creator")
        language = text_or_none(".//dc:language")

        manifest = {}
        manifest_items = []
        for item in package.findall(".//opf:manifest/opf:item", NS):
            item_id = item.attrib.get("id")
            href = item.attrib.get("href")
            media_type = item.attrib.get("media-type")
            manifest[item_id] = item.attrib
            manifest_items.append({"id": item_id, "href": href, "media_type": media_type})

        spine_items = package.findall(".//opf:spine/opf:itemref", NS)
        toc = []
        ncx_item = next(
            (it for it in manifest.values() if it.get("media-type") == "application/x-dtbncx+xml"),
            None,
        )
        if ncx_item and ncx_item.get("href"):
            ncx_path = str(Path(opf_dir) / ncx_item["href"]) if opf_dir != "." else ncx_item["href"]
            ncx = _read_xml(zf, ncx_path)
            for nav in ncx.findall(".//ncx:navPoint", NS):
                label = nav.find(".//ncx:text", NS)
                content = nav.find("ncx:content", NS)
                toc.append(
                    {
                        "label": re.sub(r"\s+", " ", label.text).strip()
                        if label is not None and label.text
                        else None,
                        "src": content.attrib.get("src") if content is not None else None,
                    }
                )
        return EpubInspection(title, creator, language, len(spine_items), toc, manifest_items)


def main(argv: list[str] | None = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Safely inspect EPUB metadata/TOC")
    parser.add_argument("epub")
    parser.add_argument("--json-out")
    args = parser.parse_args(argv)
    result = asdict(inspect_epub(args.epub))
    text = json.dumps(result, indent=2, ensure_ascii=False)
    if args.json_out:
        Path(args.json_out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.json_out).write_text(text + "\n", encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
