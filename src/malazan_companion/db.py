from __future__ import annotations

from pathlib import Path
import sqlite3

SCHEMA = """
create table if not exists books (
    id integer primary key,
    slug text not null unique,
    title text not null,
    author text,
    created_at text not null default current_timestamp
);

create table if not exists sources (
    id integer primary key,
    book_id integer not null references books(id),
    label text not null,
    position integer not null,
    href text,
    source_type text not null default 'epub_section',
    created_at text not null default current_timestamp,
    unique(book_id, position)
);

create table if not exists entities (
    id integer primary key,
    book_id integer not null references books(id),
    type text not null,
    canonical_name text not null,
    sort_name text not null,
    first_seen_source_id integer references sources(id),
    summary text not null default '',
    confidence real not null default 0.5,
    created_at text not null default current_timestamp,
    updated_at text not null default current_timestamp,
    unique(book_id, type, canonical_name)
);

create table if not exists aliases (
    id integer primary key,
    entity_id integer not null references entities(id),
    alias text not null,
    alias_type text not null default 'name',
    source_id integer references sources(id),
    confidence real not null default 0.5,
    unique(entity_id, alias)
);

create table if not exists relationships (
    id integer primary key,
    source_entity_id integer not null references entities(id),
    target_entity_id integer not null references entities(id),
    relationship_type text not null,
    description text not null default '',
    source_id integer references sources(id),
    confidence real not null default 0.5
);

create table if not exists events (
    id integer primary key,
    book_id integer not null references books(id),
    source_id integer references sources(id),
    title text not null,
    event_type text not null default 'scene',
    summary text not null default '',
    confidence real not null default 0.5
);

create table if not exists observations (
    id integer primary key,
    entity_id integer references entities(id),
    source_id integer references sources(id),
    claim text not null,
    quote_short text,
    confidence real not null default 0.5
);

create table if not exists questions (
    id integer primary key,
    book_id integer not null references books(id),
    source_id integer references sources(id),
    question text not null,
    status text not null default 'open',
    current_theory text not null default ''
);
"""


def connect(path: str | Path) -> sqlite3.Connection:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("pragma foreign_keys=on")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    conn.commit()


def upsert_book(conn: sqlite3.Connection, *, slug: str, title: str, author: str | None = None) -> int:
    conn.execute(
        """
        insert into books(slug, title, author) values (?, ?, ?)
        on conflict(slug) do update set title=excluded.title, author=excluded.author
        """,
        (slug, title, author),
    )
    conn.commit()
    return int(conn.execute("select id from books where slug=?", (slug,)).fetchone()[0])


def add_source(
    conn: sqlite3.Connection,
    *,
    book_id: int,
    label: str,
    position: int,
    href: str | None = None,
    source_type: str = "epub_section",
) -> int:
    conn.execute(
        """
        insert into sources(book_id, label, position, href, source_type) values (?, ?, ?, ?, ?)
        on conflict(book_id, position) do update set
          label=excluded.label,
          href=excluded.href,
          source_type=excluded.source_type
        """,
        (book_id, label, position, href, source_type),
    )
    conn.commit()
    return int(
        conn.execute("select id from sources where book_id=? and position=?", (book_id, position)).fetchone()[0]
    )


def _sort_name(name: str) -> str:
    return name.casefold().strip()


def upsert_entity(
    conn: sqlite3.Connection,
    *,
    book_id: int,
    entity_type: str,
    canonical_name: str,
    first_seen_source_id: int | None = None,
    summary: str = "",
    confidence: float = 0.5,
) -> int:
    conn.execute(
        """
        insert into entities(book_id, type, canonical_name, sort_name, first_seen_source_id, summary, confidence)
        values (?, ?, ?, ?, ?, ?, ?)
        on conflict(book_id, type, canonical_name) do update set
          first_seen_source_id=coalesce(entities.first_seen_source_id, excluded.first_seen_source_id),
          summary=excluded.summary,
          confidence=excluded.confidence,
          updated_at=current_timestamp
        """,
        (book_id, entity_type, canonical_name, _sort_name(canonical_name), first_seen_source_id, summary, confidence),
    )
    conn.commit()
    return int(
        conn.execute(
            "select id from entities where book_id=? and type=? and canonical_name=?",
            (book_id, entity_type, canonical_name),
        ).fetchone()[0]
    )
