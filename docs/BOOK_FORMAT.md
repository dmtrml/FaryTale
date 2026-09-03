# Canonical Book and Character Format

## 1. Directory layout

```text
content/
├── books/
│   └── miau-washes-paws/
│       ├── book.json
│       ├── cover.webp
│       ├── pages/
│       │   ├── 001.webp
│       │   ├── 002.webp
│       │   └── ...
│       ├── prompts/
│       │   ├── 001.md
│       │   ├── 002.md
│       │   └── ...
│       └── refs/
│           └── README.md
│
└── characters/
    └── miau/
        ├── character.json
        └── refs/
            ├── canonical.webp
            └── optional-extra.webp
```

## 2. `book.json`

Suggested v1 shape:

```json
{
  "schemaVersion": 1,
  "id": "miau-washes-paws",
  "title": "Котёнок Мяу моет лапки",
  "language": "ru",
  "age": {
    "minMonths": 18,
    "maxMonths": 24,
    "label": "18–24 месяца"
  },
  "goal": {
    "type": "habit",
    "slug": "wash-hands-before-eating",
    "description": "Показать последовательность: поиграл → помыл лапки → вытер → можно кушать."
  },
  "characters": ["miau"],
  "references": [
    {
      "id": "environment",
      "path": "refs/room.webp",
      "role": "environment"
    }
  ],
  "status": "ready",
  "cover": "cover.webp",
  "createdAt": "2026-08-29",
  "updatedAt": "2026-08-29",
  "authoring": {
    "skill": "childrens-story-creator-v1",
    "ageBand": "18-24m",
    "storyPattern": "habit-routine",
    "outline": [
      {
        "pageNumber": 1,
        "beat": "Показать знакомое занятие до перехода к рутине."
      }
    ]
  },
  "pages": [
    {
      "number": 1,
      "text": "Мяу играл с мячиком.",
      "image": "pages/001.webp",
      "prompt": "prompts/001.md",
      "characters": ["miau"],
      "imageStatus": "ready"
    }
  ]
}
```

`authoring` is optional parent-side metadata. It records the deterministic
story-skill interpretation used to prepare a draft. It is not shown in child
mode and does not make the skill Markdown files a runtime dependency.

`references` is an optional/default-empty list of book-level visual references.
The current Parent workflow uses one canonical `environment` reference for the
room/location, recurring props and overall visual context of the book. Character
identity references remain canonical under `content/characters/<id>/refs/` and
are not duplicated into each book.

Allowed `ageBand` values in v1:
- `12-18m`
- `18-24m`
- `2-3y`
- `4-5y`
- `6-8y`

Allowed `storyPattern` values in v1:
- `habit-routine`
- `independence-trying`
- `emotion-regulation`
- `fear-new-situation`
- `safety-rule`
- `social-skill`
- `curiosity-explanation`
- `family-memory`

## 3. Page image status

Allowed v1 values:

- `missing`
- `prompt_ready`
- `generating`
- `ready`
- `failed`

Image state is per page.

## 4. Prompt file

Store one prompt file per page.

Recommended Markdown structure:

```md
# Illustration prompt

## Scene
...

## Characters
- miau

## Composition
...

## Continuity
...

## Negative constraints
...

## Generation metadata
- provider: manual
- model:
- generated_at:
- seed:
- reference_images:
  - ../../../characters/miau/refs/canonical.webp

## Notes
...
```

Prompt files are authoring/provenance assets and are not shown in child mode.
The Parent UI may derive a flattened ready-to-copy ChatGPT Image prompt from
these structured sections. The Markdown remains the technical source for scene,
environment, composition, style and continuity details, while the parent-facing
copy prompt describes which attached character/environment image references to
use without exposing filesystem paths or generation metadata.

## 5. `character.json`

Suggested v1 shape:

```json
{
  "schemaVersion": 1,
  "id": "miau",
  "name": "Котёнок Мяу",
  "type": "animal",
  "species": "kitten",
  "narrativeDescription": "Добрый любопытный маленький котёнок.",
  "visual": {
    "identity": "Stable canonical description goes here.",
    "palette": [],
    "fixedTraits": [],
    "doNotChange": []
  },
  "references": [
    {
      "id": "canonical",
      "path": "refs/canonical.webp",
      "role": "identity"
    }
  ]
}
```

## 6. Generated manifest

For runtime performance, the app may generate:

`content/generated/library-manifest.json`

This file is a cache/build artifact.

It must be reproducible from canonical `book.json` files and must not become the only source of metadata.

## 7. Validation

Every book load should validate:
- unique id;
- supported schema version;
- ordered page numbers;
- referenced files exist where required;
- no path traversal;
- character references resolve where practical.

The library should degrade gracefully:
- broken book -> hidden or shown with diagnostic in parent mode;
- one missing illustration -> placeholder, book still opens;
- missing prompt -> reader still works.

### Structural page editing

`book.json` page references are authoritative. Numbered filenames such as `pages/001.webp`
and `prompts/001.md` are the preferred initial layout, but an asset remains attached to its
page when that page is reordered. Structural editing must not rename or overwrite an unrelated
page file merely to make its filename match the new page number.

When a numbered target is already owned by another page, new or replaced assets may use stable
collision-free paths such as `pages/assets/<uuid>.*` or `prompts/assets/<uuid>.md`. A duplicated
page receives independent copied assets under `pages/copies/` and `prompts/copies/`. Assets from
a deleted page are moved under `archive/deleted-pages/` instead of being silently destroyed.

The v1 Parent editor supports up to 200 pages per book; the reader/file schema itself does not
assume a five- or twelve-page story.

## 8. Portable book export

The MVP archive format is a ZIP containing canonical files rather than a proprietary database dump:

```text
export.json
books/<book-id>/...
characters/<referenced-character-id>/...
```

`export.json` v1:

```json
{
  "format": "farytale-book-export",
  "version": 1,
  "bookId": "miau-washes-paws"
}
```

An export includes the complete canonical book directory plus the complete directories of characters referenced by the book. This includes declared book-level visual references such as `refs/room.webp`. Import validates the ZIP, Book/Character schemas, declared assets, image signatures/dimensions and target conflicts before writing canonical content.

## 9. Agent authoring provenance

Books created through the approved-story materializer additionally keep non-reader provenance under:

```text
authoring/
  approved-story.json
  materialization-report.json
```

`approved-story.json` is the validated `ApprovedStoryPackage` that was materialized. `materialization-report.json` records counts/status/warnings from the completed validation pass. These are parent/agent provenance files; child reader behavior continues to depend only on canonical `book.json` plus declared assets.

See `docs/AGENT_AUTHORING.md` for the package contract and agent-first workflow.
