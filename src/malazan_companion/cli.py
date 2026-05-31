from __future__ import annotations

import argparse
import json
from pathlib import Path

from .db import add_source, connect, init_db, upsert_book
from .epub_inspect import inspect_epub, main as inspect_main
from .epub_map import build_section_map
from .guide import export_guide_json
from .import_extraction import import_extraction

DEFAULT_DB = Path("data/malazan.sqlite")


def import_epub(epub: str | Path, *, db_path: str | Path, slug: str) -> int:
    inspection = inspect_epub(epub)
    conn = connect(db_path)
    init_db(conn)
    book_id = upsert_book(
        conn,
        slug=slug,
        title=inspection.title or slug,
        author=inspection.creator,
    )
    for section in build_section_map(epub):
        add_source(
            conn,
            book_id=book_id,
            label=section.label,
            position=section.position,
            href=section.href,
        )
    print(f"Imported EPUB map for {inspection.title or slug}: {len(inspection.toc)} sections")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="malazan")
    sub = parser.add_subparsers(dest="command", required=True)

    inspect_p = sub.add_parser("inspect-epub", help="Safely inspect EPUB metadata and TOC only")
    inspect_p.add_argument("epub")
    inspect_p.add_argument("--json-out")

    import_p = sub.add_parser("import-epub", help="Import EPUB metadata and TOC into SQLite")
    import_p.add_argument("epub")
    import_p.add_argument("--db", default=str(DEFAULT_DB))
    import_p.add_argument("--slug", required=True)

    export_p = sub.add_parser("export-guide", help="Export spoiler-bound guide JSON")
    export_p.add_argument("--db", default=str(DEFAULT_DB))
    export_p.add_argument("--book", required=True)
    export_p.add_argument("--through", type=int, required=True)
    export_p.add_argument("--out", required=True)

    import_json_p = sub.add_parser("import-json", help="Import approved derived extraction JSON")
    import_json_p.add_argument("json_path")
    import_json_p.add_argument("--db", default=str(DEFAULT_DB))

    args = parser.parse_args(argv)
    if args.command == "inspect-epub":
        inspect_argv = [args.epub]
        if args.json_out:
            inspect_argv += ["--json-out", args.json_out]
        return inspect_main(inspect_argv)
    if args.command == "import-epub":
        return import_epub(args.epub, db_path=args.db, slug=args.slug)
    if args.command == "import-json":
        conn = connect(args.db)
        init_db(conn)
        payload = json.loads(Path(args.json_path).read_text(encoding="utf-8"))
        result = import_extraction(conn, payload)
        print(f"Imported extraction: {result}")
        return 0
    if args.command == "export-guide":
        conn = connect(args.db)
        init_db(conn)
        export_guide_json(conn, args.out, book_slug=args.book, through_position=args.through)
        print(f"Exported guide to {args.out}")
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
