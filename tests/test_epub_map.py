from pathlib import Path
import zipfile

from malazan_companion.epub_map import build_section_map


def test_build_section_map_keeps_order_without_body_text(tmp_path: Path):
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
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Test Book</dc:title></metadata>
  <manifest><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/></manifest>
  <spine toc="ncx"><itemref idref="c1"/><itemref idref="c2"/></spine>
</package>''',
        )
        z.writestr(
            "OEBPS/toc.ncx",
            '''<?xml version="1.0"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><navMap>
<navPoint id="n1"><navLabel><text>CHAPTER ONE</text></navLabel><content src="c1.xhtml#one"/></navPoint>
<navPoint id="n2"><navLabel><text>CHAPTER TWO</text></navLabel><content src="c2.xhtml#two"/></navPoint>
</navMap></ncx>''',
        )
        z.writestr("OEBPS/c1.xhtml", "<html><body>body text must not appear</body></html>")
        z.writestr("OEBPS/c2.xhtml", "<html><body>more body text</body></html>")
    sections = build_section_map(epub)
    assert [s.position for s in sections] == [1, 2]
    assert sections[0].label == "CHAPTER ONE"
    assert sections[0].href == "c1.xhtml#one"
    assert "body text" not in repr(sections)
