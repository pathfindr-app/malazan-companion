from pathlib import Path
import json

from malazan_companion.db import add_source, connect, init_db, upsert_book
from malazan_companion.import_extraction import import_extraction


def test_import_extraction_upserts_characters_at_source_position(tmp_path: Path):
    conn = connect(tmp_path / "guide.sqlite")
    init_db(conn)
    book_id = upsert_book(conn, slug="gotm", title="Gardens of the Moon", author="Steven Erikson")
    add_source(conn, book_id=book_id, label="CHAPTER ONE", position=16, href="chapter1.xhtml")
    extraction = {
        "book_slug": "gotm",
        "source_position": 16,
        "characters": [
            {
                "name": "Example Character",
                "summary": "A spoiler-safe derived summary.",
                "confidence": 0.75,
            }
        ],
    }

    result = import_extraction(conn, extraction)

    assert result["characters_imported"] == 1
    row = conn.execute("select canonical_name, summary from entities").fetchone()
    assert tuple(row) == ("Example Character", "A spoiler-safe derived summary.")
