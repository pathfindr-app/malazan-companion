from pathlib import Path

from malazan_companion.db import add_source, connect, init_db, upsert_book, upsert_entity
from malazan_companion.guide import export_guide_json, load_guide


def test_export_guide_filters_entities_by_spoiler_boundary(tmp_path: Path):
    conn = connect(tmp_path / "guide.sqlite")
    init_db(conn)
    book_id = upsert_book(conn, slug="gotm", title="Gardens of the Moon", author="Steven Erikson")
    ch1 = add_source(conn, book_id=book_id, label="CHAPTER ONE", position=1, href="c1.xhtml")
    ch2 = add_source(conn, book_id=book_id, label="CHAPTER TWO", position=2, href="c2.xhtml")
    upsert_entity(conn, book_id=book_id, entity_type="character", canonical_name="Seen Character", first_seen_source_id=ch1, summary="Appears early.", confidence=0.8)
    upsert_entity(conn, book_id=book_id, entity_type="character", canonical_name="Future Character", first_seen_source_id=ch2, summary="Appears later.", confidence=0.8)
    upsert_entity(conn, book_id=book_id, entity_type="faction", canonical_name="Seen Faction", first_seen_source_id=ch1, summary="Known early.", confidence=0.8)
    conn.execute("insert into questions(book_id, source_id, question, current_theory) values (?, ?, ?, ?)", (book_id, ch1, "Open question?", "No answer yet."))
    conn.commit()

    out = tmp_path / "guide.json"
    export_guide_json(conn, out, book_slug="gotm", through_position=1)
    guide = load_guide(out)

    names = [c["name"] for c in guide["characters"]]
    assert names == ["Seen Character"]
    assert guide["factions"][0]["name"] == "Seen Faction"
    assert guide["mysteries"][0]["question"] == "Open question?"
    assert guide["boundary"]["through_position"] == 1
