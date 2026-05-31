from pathlib import Path

from malazan_companion.db import connect, init_db, upsert_book, upsert_entity, add_source


def test_init_db_creates_core_tables(tmp_path: Path):
    db_path = tmp_path / "guide.sqlite"
    conn = connect(db_path)
    init_db(conn)
    names = {
        row[0]
        for row in conn.execute("select name from sqlite_master where type='table'").fetchall()
    }
    assert {
        "books",
        "sources",
        "entities",
        "aliases",
        "relationships",
        "events",
        "observations",
        "questions",
    } <= names


def test_entity_upsert_dedupes_by_book_name_and_type(tmp_path: Path):
    conn = connect(tmp_path / "guide.sqlite")
    init_db(conn)
    book_id = upsert_book(conn, slug="gotm", title="Gardens of the Moon", author="Steven Erikson")
    source_id = add_source(conn, book_id=book_id, label="CHAPTER ONE", position=10, href="chapter1.xhtml")
    first = upsert_entity(
        conn,
        book_id=book_id,
        entity_type="character",
        canonical_name="Example Character",
        first_seen_source_id=source_id,
        summary="Known so far.",
        confidence=0.8,
    )
    second = upsert_entity(
        conn,
        book_id=book_id,
        entity_type="character",
        canonical_name="Example Character",
        first_seen_source_id=source_id,
        summary="Updated known so far.",
        confidence=0.9,
    )
    assert first == second
    row = conn.execute("select summary, confidence from entities where id=?", (first,)).fetchone()
    assert row[0] == "Updated known so far."
    assert row[1] == 0.9
