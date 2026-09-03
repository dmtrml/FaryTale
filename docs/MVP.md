# FaryTale MVP

## What the MVP is

FaryTale is a private, file-based family storybook shelf with two deliberately separated experiences:

- **Child / Reader mode** — open a ready book and read it page by page. It has no AI, prompt, generation or editing controls.
- **Parent mode** — maintain canonical books/characters, prepare story structure/prompts, optionally use provider-backed Studio/generation, print and archive books.

Reading is the core product. AI providers are optional authoring tools and are never required to open an existing ready book.

## Canonical data

The source of truth is ordinary files:

```text
content/
  books/<book-id>/
    book.json
    cover.*                 # optional
    refs/*                  # optional book-level room/environment references
    pages/*                 # page illustrations
    prompts/*.md            # illustration prompt + provenance
    pages/history/*         # previous generated versions when available
  characters/<character-id>/
    character.json
    refs/*                  # optional canonical identity references
```

The application can rebuild the library from these files. A database, login or AI conversation is not the only copy of story state.

## Reader and offline behavior

- `/` shows only books whose canonical status is `ready`.
- `/books/<book-id>` is the child reader.
- The reader supports previous/next buttons, left/right taps, horizontal swipe and keyboard arrows.
- Missing images use a safe placeholder instead of breaking the book.
- The PWA service worker caches previously visited reader pages and their safe book assets. Provider/editor APIs are intentionally excluded from the reader cache.

Offline reading is best-effort for books/pages that were previously loaded on the device. Authoring/provider calls require a running server and may require network access.

## Parent mode

Open `/parent` and deliberately press-and-hold to enter parent mode.

The current gate is **child-accident protection, not account authentication**. Do not expose this local MVP as a hostile/public multi-user service and assume the hold gesture is security.

Parent mode can:

- inspect all canonical books including drafts;
- edit book title, language, goal, age range, lifecycle status, cover and referenced characters;
- create books up to 200 pages and maintain 80+ page books;
- jump directly to one selected page instead of rendering a huge all-pages editor;
- insert, duplicate, delete and reorder pages;
- edit one page's text and page-level character membership;
- upload/replace one page image;
- inspect/copy illustration prompts and provenance;
- keep one canonical book-level environment/props reference alongside character identity references;
- copy one flattened ChatGPT Image prompt for the selected page without manually assembling Scene/Characters/Environment/Composition sections;
- copy one whole-book ChatGPT Image request that asks for one separate image per page and explains the attached canonical references once for the full series;
- select story pattern, character and visual-style lock;
- generate deterministic outline/prompts without AI;
- create and edit canonical characters;
- edit visual identity, palette, fixed traits and do-not-change rules;
- upload/remove character reference images, edit reference roles and choose the canonical identity reference;
- use a simplified character card that shows the main identity reference plus one ready-to-copy ChatGPT Image prompt assembled automatically from the structured character fields; palette/fixed/do-not-change fields remain available under advanced settings rather than requiring manual prompt assembly;
- delete an unused character while blocking deletion when a book still references it;
- create a draft book;
- use the tool-driven Studio;
- optionally generate/regenerate one illustration through a configured image provider;
- compare the current generated page with the most recently archived previous version;
- print/save a book as PDF through the browser;
- export and restore a portable FaryTale ZIP package.

The intended everyday creation flow is now **agent-first**, not form-first. After a story is approved in chat, the agent can materialize the full approved story in one structured operation: technical metadata, complete page set, canonical character reuse/creation and one illustration prompt per scene. Parent forms remain useful for inspection/recovery and occasional manual corrections.

Approved-story materialization never generates images. It leaves every unillustrated page `prompt_ready` so illustrations can be generated separately in chat and uploaded manually. See `docs/AGENT_AUTHORING.md`.
- switch between light and dark appearance; the choice is stored only in the local browser and is reused by reader mode.

When no appearance has been chosen yet, FaryTale follows the operating-system light/dark preference. Print/PDF output intentionally remains white regardless of the on-screen theme.

## AI Studio

`/parent/studio` is conversational UI over an explicit project-tool allowlist. The chat does not receive raw filesystem freedom.

Without a text provider, deterministic commands remain available (`/books`, `/book`, `/characters`, `/outline`, `/prompt`, `/page`, `/create`, etc.). If an OpenAI-compatible text provider is configured, free text is first converted into one allowlisted Studio command and then executed through the same validated tool layer.

Important mutations are persisted to canonical files immediately; chat history is not the source of truth.

For complete approved stories, Studio also accepts the high-level `/materialize-json <ApprovedStoryPackage JSON>` workflow. This bypasses the one-command-per-page pattern and supports long packages well beyond the old 2500-character message limit.

## Image generation

`manual` is the default image provider and requires no key. It stores/uses prompts and keeps pages recoverable for manual generation/upload.

For the everyday manual workflow, the Parent book screen separates canonical visual
references from technical prompt structure. Character identity references come from
the character library; the book may additionally store one `environment` reference
for the room/location, recurring props and visual context. The UI derives one
ready-to-copy prompt for a selected page and one whole-book prompt for batch creation
of separate page images. The structured Markdown prompt remains available only under
technical details for inspection/provenance.

When `openai-image` is explicitly configured, one parent-triggered page request:

1. reads only that page prompt;
2. selects at most one canonical identity reference per character;
3. moves only that page to `generating`;
4. uses prompt-only generation or reference-image edit as appropriate;
5. validates returned image type/dimensions;
6. archives the previous page image when regenerating;
7. stores the new asset and provenance, then marks that page `ready`;
8. on failure marks only that page `failed`, leaving other pages/assets intact.

No live provider call is made by the automated test suite.

## Backup and restore

From a parent book detail page choose **Экспорт ZIP**. The package contains:

- an export manifest;
- the full canonical book folder (JSON, prompts, images/history and other files);
- every character folder referenced by the book, including available reference images.

Use **Восстановить книгу из FaryTale ZIP** on the parent books page to restore a package.

Before writing anything, import validates:

- ZIP structure, entry count/expanded size, CRC and safe paths;
- Book/Character schemas and matching folder IDs;
- declared page/cover/reference files;
- image signatures and dimensions;
- canonical character conflicts with the target library.

An existing book with the same ID is never overwritten by import.

## Printable/PDF archive

Parent book detail → **Печать / PDF** opens a print-friendly all-pages layout. Use the browser's Print dialog and choose “Save as PDF” when available. This avoids making PDF rendering a runtime dependency of the reader.

## Provider configuration

All provider configuration is server-only. Never use `NEXT_PUBLIC_*` for secrets.

Optional text interpreter example:

```text
FARYTALE_TEXT_PROVIDER=openai-compatible
FARYTALE_TEXT_BASE_URL=https://openrouter.ai/api/v1
FARYTALE_TEXT_MODEL=<provider/model>
FARYTALE_TEXT_API_KEY=<secret>
```

`OPENROUTER_API_KEY` may be used as a server-only fallback key.

Optional image generation:

```text
FARYTALE_IMAGE_PROVIDER=openai-image
FARYTALE_IMAGE_BASE_URL=https://api.openai.com/v1
FARYTALE_IMAGE_MODEL=gpt-image-2
FARYTALE_IMAGE_API_KEY=<secret>
```

`OPENAI_API_KEY` may be used as a server-only fallback key.

## Privacy and security boundaries

- Do not commit API keys.
- Do not use `NEXT_PUBLIC_*` for provider secrets.
- Child/family reference images are private data. Add them intentionally and send only references needed for the current page/provider request.
- Reader mode never needs provider credentials.
- The history asset route is parent-gated; ordinary reader assets remain limited to assets declared by canonical ready/non-archived books.
- Import rejects traversal paths and validates packages before canonical writes.
- This MVP intentionally does not include accounts, payments, social sharing, marketplace or multi-family SaaS isolation.

## Development and verification

```bash
npm install
npm run dev
```

Full local verification:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The test suite uses temporary content roots and mocked providers; it does not require paid API credentials.

## Known MVP limitations

- Parent gate is UX isolation, not authentication/authorization for an internet-facing service.
- Offline behavior is cache-based and does not provide a full offline authoring workspace.
- ZIP export uses a portable stored-file writer (no compression); import also accepts standard deflate entries.
- Browser print quality depends on browser/OS PDF print support.
- The Parent editor intentionally caps a single book at 200 pages to keep local authoring operations bounded; this is not a short-story-only 12-page limit.
- The included Miau content is a structural sample; canonical family-approved character reference images can be added later without changing the format.
