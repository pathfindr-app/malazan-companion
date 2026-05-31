from __future__ import annotations

import argparse
from .epub_inspect import main as inspect_main


def main() -> int:
    parser = argparse.ArgumentParser(prog="malazan")
    sub = parser.add_subparsers(dest="command", required=True)
    inspect_p = sub.add_parser("inspect-epub", help="Safely inspect EPUB metadata and TOC only")
    inspect_p.add_argument("epub")
    inspect_p.add_argument("--json-out")
    args = parser.parse_args()
    if args.command == "inspect-epub":
        argv = [args.epub]
        if args.json_out:
            argv += ["--json-out", args.json_out]
        return inspect_main(argv)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
