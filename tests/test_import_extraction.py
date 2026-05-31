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
        "factions": [
            {"name": "Example Faction", "summary": "Known so far faction note.", "confidence": 0.7}
        ],
        "questions": [
            {"question": "What is unresolved?", "current_theory": "Still unclear."}
        ],
    }

    result = import_extraction(conn, extraction)

    assert result["characters_imported"] == 1
    assert result["factions_imported"] == 1
    assert result["questions_imported"] == 1
    character = conn.execute("select canonical_name, summary from entities where type='character'").fetchone()
    faction = conn.execute("select canonical_name, summary from entities where type='faction'").fetchone()
    question = conn.execute("select question, current_theory from questions").fetchone()
    assert tuple(character) == ("Example Character", "A spoiler-safe derived summary.")
    assert tuple(faction) == ("Example Faction", "Known so far faction note.")
    assert tuple(question) == ("What is unresolved?", "Still unclear.")
