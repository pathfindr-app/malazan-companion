from pathlib import Path
import zipfile

from malazan_companion.epub_inspect import inspect_epub


def test_inspect_minimal_epub(tmp_path: Path):
    epub = tmp_path / "book.epub"
    with zipfile.ZipFile(epub, "w") as z:
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
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title><dc:creator>Author</dc:creator><dc:language>en</dc:language>
  </metadata>
  <manifest><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest>
  <spine toc="ncx"><itemref idref="c1"/></spine>
</package>''',
        )
        z.writestr(
            "OEBPS/toc.ncx",
            '''<?xml version="1.0"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><navMap><navPoint id="n1"><navLabel><text>Chapter 1</text></navLabel><content src="c1.xhtml"/></navPoint></navMap></ncx>''',
        )
        z.writestr("OEBPS/c1.xhtml", "<html><body>Do not read body in test.</body></html>")
    result = inspect_epub(epub)
    assert result.title == "Test Book"
    assert result.creator == "Author"
    assert result.spine_count == 1
    assert result.toc[0]["label"] == "Chapter 1"
