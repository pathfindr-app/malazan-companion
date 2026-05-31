# Architecture

## Split model

This project deliberately separates private reading data from public-safe dashboard code.

### Private/local lane

- EPUB files live under `data/private_epubs/` and are ignored by git.
- Any raw extracted text/cache lives under `data/private_work/` and is ignored by git.
- SQLite databases live under `data/` and are ignored by git by default.
- Local importers derive structured metadata: characters, aliases, factions, locations, relationships, events, and open questions.

### Public/dashboard lane

- `site/` is a static dashboard shell suitable for GitHub Pages.
- The public repo must not include EPUBs, raw text extraction, or long copyrighted passages.
- Later, the dashboard can load a sanitized local JSON export selected by the user, or a tiny demo dataset written from original/non-copyright sample content.

## Hosting

GitHub Pages can host the dashboard UI. It cannot safely host Kyle's EPUB or private derived reading database unless Kyle explicitly chooses to publish sanitized data.

Recommended public repo posture:

- Public: app shell, docs, demo data, importer code.
- Private/local only: EPUBs, raw text, personal reading database.
