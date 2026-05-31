from __future__ import annotations

import sqlite3
from typing import Any

from .db import upsert_entity


def import_extraction(conn: sqlite3.Connection, extraction: dict[str, Any]) -> dict[str, int]:
    """Import approved derived guide metadata.

    Expects short summaries/facts only; never raw chapter text.
    """
    book_slug = extraction["book_slug"]
    source_position = int(extraction["source_position"])
    book = conn.execute("select id from books where slug=?", (book_slug,)).fetchone()
    if book is None:
        raise ValueError(f"Unknown book slug: {book_slug}")
    source = conn.execute(
        "select id from sources where book_id=? and position=?",
        (book["id"], source_position),
    ).fetchone()
    if source is None:
        raise ValueError(f"Unknown source position for {book_slug}: {source_position}")

    count = 0
    for character in extraction.get("characters", []):
        upsert_entity(
            conn,
            book_id=book["id"],
            entity_type="character",
            canonical_name=character["name"],
            first_seen_source_id=source["id"],
            summary=character.get("summary", ""),
            confidence=float(character.get("confidence", 0.5)),
        )
        count += 1

    faction_count = 0
    for faction in extraction.get("factions", []):
        upsert_entity(
            conn,
            book_id=book["id"],
            entity_type="faction",
            canonical_name=faction["name"],
            first_seen_source_id=source["id"],
            summary=faction.get("summary", ""),
            confidence=float(faction.get("confidence", 0.5)),
        )
        faction_count += 1

    question_count = 0
    for question in extraction.get("questions", []):
        conn.execute(
            """
            insert into questions(book_id, source_id, question, current_theory)
            values (?, ?, ?, ?)
            """,
            (book["id"], source["id"], question["question"], question.get("current_theory", "")),
        )
        question_count += 1
    conn.commit()
    return {
        "characters_imported": count,
        "factions_imported": faction_count,
        "questions_imported": question_count,
    }
