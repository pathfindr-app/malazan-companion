from pathlib import Path
import json
import zipfile

from malazan_companion.cli import main
from malazan_companion.db import connect


def make_epub(path: Path):
    with zipfile.ZipFile(path, "w") as z:
        z.writestr(
            "META-INF/container.xml",
            '''<?xml version="1.0"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>''',
        )
        z.writestr(
            "OEBPS/content.opf",
            '''<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Test Book</dc:title><dc:creator>Author</dc:creator></metadata>
  <manifest><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest>
  <spine toc="ncx"><itemref idref="c1"/></spine>
</package>''',
        )
        z.writestr(
            "OEBPS/toc.ncx",
            '''<?xml version="1.0"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><navMap><navPoint id="n1"><navLabel><text>CHAPTER ONE</text></navLabel><content src="c1.xhtml"/></navPoint></navMap></ncx>''',
        )
        z.writestr("OEBPS/c1.xhtml", "<html><body>private text</body></html>")


def test_cli_import_epub_stores_book_and_sources(tmp_path: Path):
    epub = tmp_path / "book.epub"
    db = tmp_path / "guide.sqlite"
    make_epub(epub)

    assert main(["import-epub", str(epub), "--db", str(db), "--slug", "test-book"]) == 0

    conn = connect(db)
    book = conn.execute("select title, author from books where slug='test-book'").fetchone()
    source = conn.execute("select label, position from sources").fetchone()
    assert tuple(book) == ("Test Book", "Author")
    assert tuple(source) == ("CHAPTER ONE", 1)


def test_cli_import_json_then_export_guide(tmp_path: Path):
    epub = tmp_path / "book.epub"
    db = tmp_path / "guide.sqlite"
    extraction = tmp_path / "extraction.json"
    out = tmp_path / "guide.json"
    make_epub(epub)
    main(["import-epub", str(epub), "--db", str(db), "--slug", "test-book"])
    extraction.write_text(json.dumps({
        "book_slug": "test-book",
        "source_position": 1,
        "characters": [{"name": "Example Character", "summary": "Known so far.", "confidence": 0.8}],
    }))

    assert main(["import-json", str(extraction), "--db", str(db)]) == 0
    assert main(["export-guide", "--db", str(db), "--book", "test-book", "--through", "1", "--out", str(out)]) == 0
    data = json.loads(out.read_text())
    assert data["book"]["title"] == "Test Book"
    assert data["characters"][0]["name"] == "Example Character"
