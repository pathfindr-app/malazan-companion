# Malazan Reading Database Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build Kyle a personal spoiler-safe reading companion for *Malazan: Gardens of the Moon* that can ingest photos of book pages, extract character/location/event notes, and save them into an accessible database.

**Architecture:** A small local-first project with a SQLite database, an ingestion pipeline for uploaded page photos, OCR/photo text extraction, LLM-assisted entity/event extraction, and a lightweight web/CLI interface for browsing and querying notes. The system stores structured facts and short citations/page references, not full copyrighted page text.

**Tech Stack:** Python, SQLite, SQLModel or sqlite-utils, FastAPI optional, Typer CLI, OCR via Tesseract/EasyOCR or vision LLM, Obsidian Markdown export, Telegram/Hermes manual intake first.

---

## Product Principles

1. **Spoiler-safe by design.** Never use web summaries or external Malazan wiki data unless Kyle explicitly asks. Only use pages/chapters Kyle has read.
2. **Personal reading notes, not book reproduction.** Store extracted facts, summaries, short quoted snippets only when necessary, page/chapter references, and Kyle's notes. Do not store long OCR dumps from the book.
3. **Uncertainty is allowed.** Malazan is intentionally confusing. Use confidence levels and `unknown/unclear` relationships instead of pretending the system knows everything.
4. **Names can collide.** Track aliases, titles, factions, races/species, roles, and uncertainty.
5. **Every fact should have provenance.** Link facts back to book, chapter, page/photo, and extracted passage context.
6. **Fast capture first, polish later.** Start with a Telegram/Hermes-assisted workflow, then automate ingestion once the schema proves useful.

---

## Desired User Workflow

### First version: photo-assisted intake

1. Kyle sends Hermes one or more photos of pages he just read.
2. Hermes extracts the visible text or enough text context from the images.
3. Hermes proposes structured updates:
   - New characters
   - Updated character aliases/roles/factions
   - New locations
   - New factions/groups
   - Events/scenes
   - Open mysteries/questions
4. Kyle can say:
   - `save all`
   - `save characters only`
   - `ignore spoilers/theory wording`
   - `edit X to Y`
5. Hermes writes the updates into SQLite and exports readable Obsidian notes.
6. Kyle can ask questions like:
   - `Who is Paran again?`
   - `What do we know about Anomander Rake so far? No spoilers.`
   - `What happened in Darujhistan?`
   - `Show all Bridgeburners mentioned so far.`

### Preferred version if Kyle provides an EPUB

Kyle can provide a legally owned EPUB for personal reading-assistant use. The system should parse the EPUB locally into chapter/section chunks, then create spoiler-safe derived metadata rather than storing or reproducing the full book text.

1. Import EPUB metadata, table of contents, chapter boundaries, and approximate location/page markers.
2. Process chunks in reading order and extract derived records:
   - character/entity first appearances
   - aliases, titles, factions, and relationships
   - scene/event summaries
   - short observations with chapter/location provenance
   - open mysteries/questions
3. Store only structured facts, summaries, and very short evidence snippets; keep any raw extracted text either out of the repo or in an optional private cache that can be deleted.
4. Add a reading-position selector: book/chapter/EPUB CFI/location/percentage.
5. Generate a spoiler-safe guide from database rows whose source position is <= Kyle's current reading position.
6. Provide commands/UI such as:
   - `malazan import-epub /path/to/book.epub --book gardens-of-the-moon`
   - `malazan set-position --book gardens-of-the-moon --chapter 4`
   - `malazan guide --through chapter:4`
   - `malazan cast --through chapter:4`
   - `malazan show-character "Ganoes Paran" --through chapter:4`
   - `malazan image-prompt "Ganoes Paran" --through chapter:4`

### Character guide and images

The guide should reveal characters only when they have appeared at or before Kyle's saved reading position. Character pages should support:

- spoiler-safe known-so-far summary
- first seen chapter/location
- aliases/titles known so far
- associated factions/relationships known so far
- last mentioned/recent scene references
- uncertainty flags for ambiguous identities
- optional image prompt generated only from descriptions available through the spoiler boundary
- optional generated portrait, clearly marked as AI interpretation and not canonical art

### Later version

A lightweight local web app with:

- Characters index
- Locations index
- Factions/groups index
- Timeline/events view
- Open mysteries/questions
- Search
- Spoiler boundary selector: book/chapter/page read through
- Manual correction UI

---

## Initial Data Model

### `books`

- `id`
- `title`
- `series`
- `author`
- `edition_notes`

### `reading_positions`

- `id`
- `book_id`
- `chapter`
- `page_start`
- `page_end`
- `read_at`
- `source_note`

### `sources`

One source per photo/OCR batch.

- `id`
- `book_id`
- `chapter`
- `page_start`
- `page_end`
- `image_paths_json`
- `ocr_text_path` — optional internal text cache
- `created_at`
- `processed_status`
- `notes`

### `entities`

Generic table for characters, locations, factions, gods/ascendants, races/species, magic concepts, objects/artifacts.

- `id`
- `type` — `character`, `location`, `faction`, `concept`, `artifact`, `species`, `deity_or_ascendant`, `unknown`
- `canonical_name`
- `sort_name`
- `first_seen_source_id`
- `first_seen_chapter`
- `first_seen_page`
- `spoiler_level_book`
- `spoiler_level_chapter`
- `summary_so_far`
- `status` — `active`, `dead`, `unknown`, `rumored`, etc.
- `confidence` — 0.0-1.0
- `created_at`
- `updated_at`

### `aliases`

- `id`
- `entity_id`
- `alias`
- `alias_type` — `name`, `title`, `nickname`, `epithet`, `translation`, `uncertain`
- `source_id`
- `confidence`

### `relationships`

- `id`
- `source_entity_id`
- `target_entity_id`
- `relationship_type` — `member_of`, `commands`, `serves`, `travels_with`, `enemy_of`, `located_in`, `associated_with`, etc.
- `description`
- `source_id`
- `confidence`
- `valid_from_chapter`
- `valid_to_chapter`

### `events`

- `id`
- `title`
- `event_type` — `scene`, `battle`, `conversation`, `reveal`, `travel`, `death`, `mystery`, `magic`, `political`
- `book_id`
- `chapter`
- `page_start`
- `page_end`
- `summary`
- `source_id`
- `confidence`

### `event_entities`

- `event_id`
- `entity_id`
- `role_in_event` — `participant`, `speaker`, `mentioned`, `victim`, `observer`, `location`, etc.

### `questions`

For Malazan mysteries.

- `id`
- `question`
- `status` — `open`, `partially_answered`, `answered`, `probably_red_herring`
- `book_id`
- `chapter_opened`
- `page_opened`
- `current_theory`
- `source_id`

### `observations`

Small factual claims with provenance.

- `id`
- `entity_id` nullable
- `claim`
- `source_id`
- `chapter`
- `page`
- `confidence`
- `quote_short` nullable — keep very short only

---

## Folder Structure

```text
/root/kyle/projects/malazan-companion/
  README.md
  pyproject.toml
  data/
    malazan.sqlite
    raw_photos/
      gardens-of-the-moon/
    ocr_text/
    exports/
      obsidian/
      html/
  src/malazan_companion/
    __init__.py
    db.py
    models.py
    ingest.py
    extract.py
    export_obsidian.py
    query.py
    cli.py
  tests/
    test_models.py
    test_extract_schema.py
    test_spoiler_boundary.py
  docs/
    plans/
    schema.md
    extraction-rubric.md
```

---

## Extraction Schema

Each photo batch should produce JSON like:

```json
{
  "book": "Gardens of the Moon",
  "chapter": null,
  "page_start": null,
  "page_end": null,
  "spoiler_boundary": {
    "book": "Gardens of the Moon",
    "chapter": null,
    "page_end": null
  },
  "entities": [
    {
      "type": "character",
      "canonical_name": "Example Name",
      "aliases": ["Example Title"],
      "summary_so_far": "Only what is evident from this source.",
      "observations": [
        {
          "claim": "Short factual claim from the passage.",
          "confidence": 0.74
        }
      ],
      "confidence": 0.8
    }
  ],
  "events": [
    {
      "title": "Short event title",
      "event_type": "conversation",
      "summary": "Brief spoiler-safe summary of this scene only.",
      "participants": ["Example Name"],
      "confidence": 0.8
    }
  ],
  "relationships": [
    {
      "source": "Example Name",
      "relationship_type": "member_of",
      "target": "Example Faction",
      "description": "Why this relationship is believed.",
      "confidence": 0.65
    }
  ],
  "questions": [
    {
      "question": "What is unclear after this passage?",
      "current_theory": "Optional cautious theory from read pages only."
    }
  ]
}
```

---

## Task Plan

### Task 1: Create project skeleton

**Objective:** Create the repo directory, docs, and Python package structure.

**Files:**
- Create: `/root/kyle/projects/malazan-companion/README.md`
- Create: `/root/kyle/projects/malazan-companion/pyproject.toml`
- Create: `/root/kyle/projects/malazan-companion/src/malazan_companion/__init__.py`
- Create: `/root/kyle/projects/malazan-companion/tests/`

**Verification:** `python -m compileall src` should pass.

### Task 2: Implement SQLite schema

**Objective:** Define database tables for books, sources, entities, aliases, relationships, events, questions, and observations.

**Files:**
- Create: `src/malazan_companion/db.py`
- Create: `src/malazan_companion/models.py`
- Test: `tests/test_models.py`

**Verification:** Test creates an empty database and verifies all tables exist.

### Task 3: Add import/upsert logic

**Objective:** Convert extraction JSON into safe database updates with deduping by canonical name and alias.

**Files:**
- Create: `src/malazan_companion/import_extraction.py`
- Test: `tests/test_import_extraction.py`

**Verification:** Importing the same extraction twice should not duplicate characters/events.

### Task 4: Add source/photo registration

**Objective:** Copy page photos into stable source folders and create source records.

**Files:**
- Create: `src/malazan_companion/ingest.py`
- Test: `tests/test_ingest.py`

**Verification:** Given sample image paths, creates `data/raw_photos/gardens-of-the-moon/<source_id>/` and a DB source row.

### Task 5: Add OCR/vision extraction adapter

**Objective:** Create a pluggable adapter that can accept image paths and produce text/extraction JSON.

**Files:**
- Create: `src/malazan_companion/extract.py`
- Create: `docs/extraction-rubric.md`
- Test: `tests/test_extract_schema.py`

**Implementation note:** For v1, Hermes can perform the vision/OCR in chat and pass JSON into the importer. Do not overbuild fully automated OCR before the schema is proven.

### Task 6: Add CLI commands

**Objective:** Provide commands Kyle/Hermes can run.

**Files:**
- Create: `src/malazan_companion/cli.py`

**Commands:**

```bash
malazan init-db
malazan ingest-photo --book gardens-of-the-moon --chapter 1 /path/to/photo.jpg
malazan import-json /path/to/extraction.json
malazan search paran
malazan show-character "Ganoes Paran"
malazan export-obsidian
```

### Task 7: Add Obsidian export

**Objective:** Export readable notes to Kyle's Obsidian vault.

**Files:**
- Create: `src/malazan_companion/export_obsidian.py`

**Output:**

```text
/root/kyle/obsidian-vault/Reading/Malazan/
  Gardens of the Moon.md
  Characters/<Name>.md
  Locations/<Name>.md
  Factions/<Name>.md
  Events/<Chapter or Date>.md
  Open Questions.md
```

### Task 8: Add spoiler-safe query behavior

**Objective:** Ensure queries only answer from saved database facts, not external memory/web knowledge.

**Files:**
- Create: `src/malazan_companion/query.py`
- Test: `tests/test_spoiler_boundary.py`

**Verification:** Query functions require a book/chapter/page boundary and filter sources beyond it.

### Task 9: Add lightweight HTML browser

**Objective:** Create a static or FastAPI browser for characters, locations, events, and search.

**Files:**
- Create: `src/malazan_companion/web.py` or `src/malazan_companion/export_html.py`

**Verification:** Generates a local browsable index under `data/exports/html/`.

---

## MVP Scope

Build only this first:

1. SQLite schema.
2. Manual JSON import.
3. Obsidian export.
4. Simple search/show CLI.
5. Hermes-assisted image-to-JSON workflow.

Defer:

- Full automatic Telegram image watcher.
- Full web UI.
- Complex OCR installation.
- External wiki/imports.

---

## First Live Reading Workflow Prompt

When Kyle sends page photos, Hermes should use this instruction:

```text
You are updating Kyle's spoiler-safe Malazan reading database. Use only the attached page photos and Kyle's stated reading position. Do not use outside knowledge of Malazan. Extract structured updates: characters, aliases, locations, factions, events, relationships, open questions, and short observations. If uncertain, mark confidence low. Do not store long copyrighted passages; summarize facts and keep only very short quote snippets when needed for provenance. Return JSON matching the Malazan extraction schema.
```

---

## Acceptance Criteria

- Kyle can send a page photo and get proposed structured updates.
- `malazan import-json extraction.json` saves the updates.
- `malazan search <name>` finds characters/locations/factions.
- `malazan show-character <name>` returns spoiler-safe known-so-far notes.
- Obsidian export creates readable notes with backlinks.
- The system never looks up external Malazan data unless Kyle explicitly asks.
- The system avoids storing long OCR text from copyrighted book pages.
