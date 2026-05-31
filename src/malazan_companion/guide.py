from __future__ import annotations

from pathlib import Path
import json
import sqlite3
from typing import Any


def export_guide_json(
    conn: sqlite3.Connection,
    out_path: str | Path,
    *,
    book_slug: str,
    through_position: int,
) -> dict[str, Any]:
    book = conn.execute("select * from books where slug=?", (book_slug,)).fetchone()
    if book is None:
        raise ValueError(f"Unknown book slug: {book_slug}")
    rows = conn.execute(
        """
        select e.*, s.position as first_seen_position, s.label as first_seen_label
        from entities e
        left join sources s on s.id = e.first_seen_source_id
        where e.book_id = ?
          and e.type = 'character'
          and coalesce(s.position, 0) <= ?
        order by e.sort_name
        """,
        (book["id"], through_position),
    ).fetchall()
    characters = [
        {
            "name": row["canonical_name"],
            "type": row["type"],
            "summary": row["summary"],
            "confidence": row["confidence"],
            "firstSeen": row["first_seen_label"],
            "firstSeenPosition": row["first_seen_position"],
        }
        for row in rows
    ]
    guide = {
        "book": {"slug": book["slug"], "title": book["title"], "author": book["author"]},
        "boundary": {"through_position": through_position},
        "characters": characters,
        "factions": [],
        "mysteries": [],
    }
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(guide, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return guide


def load_guide(path: str | Path) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))
