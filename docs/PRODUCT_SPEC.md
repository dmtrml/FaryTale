# FaryTale Product Specification

## 1. Product concept

FaryTale is a small, pleasant application for reading personalized illustrated children's books.

It combines two separate products in one shell:

1. **Library / Reader** — the primary product. Existing books are always available without AI.
2. **Parent Authoring Studio** — optional tools for creating and maintaining books, including an AI chat.

The product should feel like a private family storybook shelf, not like a generic AI chatbot.

## 2. Primary goals

### Goal A — easy reading

A parent should be able to open the app, choose a book, and start reading to a child in seconds.

### Goal B — reusable family story universe

Recurring characters, places, props, and visual references should persist across books.

### Goal C — portable content

Every book must remain understandable outside the application:
- text is stored in JSON/Markdown;
- images are ordinary files;
- prompts are preserved;
- references are explicit.

### Goal D — replaceable AI

The application may use AI to create stories and illustrations, but no particular vendor is the product.

### Goal E — age-aware educational stories

The project should support stories for different developmental stages and goals:
- habits;
- emotions;
- routines;
- independence;
- fears;
- safety;
- everyday explanations;
- curiosity/learning;
- family memories.

## 3. Non-goals for MVP

Do not prioritize:
- payments;
- subscriptions;
- public social feeds;
- publishing marketplace;
- user-generated public communities;
- native App Store / Play Store releases;
- video generation;
- complex telemetry.

## 4. Target experience

### Library

A grid/list of covers.

Each card may show:
- cover;
- title;
- age label;
- optional theme/goal.

Filtering can be added after the basic library works.

### Reader

The reader is optimized for a parent holding a phone/tablet near a child.

Required:
- one page at a time;
- large illustration;
- short text area;
- tap or swipe navigation;
- previous/next;
- current page indicator;
- full-screen-friendly layout;
- no AI controls;
- no editor chrome;
- no prompt metadata.

Optional later:
- read-aloud;
- autoplay;
- bilingual text;
- page transition animation.

### Parent mode

Accessible deliberately, not by an easy accidental child tap.

For the local/private MVP, the parent entry may use an explicit interaction gate
(for example, press-and-hold) plus a short-lived session cookie. This is an
**accidental-child-use boundary, not security authentication**. If FaryTale is
later exposed as a public/multi-user service, replace this with real parent
authentication/authorization before treating the parent routes as secure.

Contains:
- book metadata;
- page list;
- edit text;
- add, duplicate, delete and reorder pages;
- support long books (at least 100 pages) without artificial short-story limits;
- inspect/copy prompt;
- replace image;
- regenerate image if a provider is configured;
- character library with create/edit/delete and reference-image management;
- AI Studio;
- export.

For the MVP, canonical book and character content must be maintainable from Parent mode without hand-editing JSON files. A parent must be able to take an existing long book (for example, an 80-page book), add or remove pages, change metadata, reorder pages, maintain recurring characters and their visual references, and move the book through its lifecycle from draft to ready.

## 5. Book lifecycle

Recommended lifecycle:

`draft -> text_ready -> prompt_ready -> illustrating -> ready -> archived`

A book may remain fully usable if some pages are manually illustrated.

Each page independently tracks its image workflow.

## 6. Story creation workflow

The primary authoring workflow is **agent-first**. Parent forms are a fallback/inspection path, not the expected way to fill technical fields.

Default authoring flow:

1. Parent discusses a story with an agent and approves the final story/scenario.
2. Parent says, in natural language, to save/materialize the approved story in FaryTale.
3. The agent must infer technical metadata from the approved story and project rules instead of asking the parent to fill implementation fields such as age band, story pattern, slug, lifecycle status or page-character checkboxes.
4. The approved read-aloud text is treated as source-of-truth and is not silently rewritten during materialization.
5. The agent resolves existing canonical characters and creates complete textual canonical definitions for genuinely new characters.
6. The agent creates/updates the canonical book, all pages and per-page character membership in one high-level workflow.
7. The agent creates one final illustration prompt for every scene/page, including canonical identity/continuity constraints and any available reference-image paths.
8. In the current default workflow, images are **not generated automatically**. Every page is left in `prompt_ready` state for manual image generation/upload by the parent.
9. The workflow validates the saved book, page count, prompts and character references and returns a concise completion report with warnings such as a missing character reference image.
10. Manual Parent-mode forms remain available for inspection, recovery and occasional corrections.

## 7. File-based content model

Canonical content root:

```text
content/
  books/
  characters/
```

See `docs/BOOK_FORMAT.md`.

The app may generate an index/cache for speed, but the source files remain canonical.

## 8. Characters

Recurring characters are first-class assets.

A character may contain:
- id;
- name;
- species/role;
- short narrative description;
- visual identity description;
- fixed colors/proportions/features;
- optional outfit variants;
- negative/do-not-change rules;
- reference images.

A book references character IDs rather than copying the whole character definition into every page.

Book-specific visual overrides are allowed when explicitly stored.

## 9. AI Studio

The AI Studio is parent-only.

It should look conversational, but work through explicit tools/actions.

Example user intent:

> Make a six-page story with Miau about washing paws before eating for a 20-month-old.

The studio should:
- load the age rules;
- load the Miau character definition and references;
- choose the suitable story pattern;
- produce structured pages;
- save the canonical book files;
- create illustration prompts;
- optionally generate images.

For agent-first authoring, the Studio/tool layer must also support one structured high-level operation that materializes an **approved complete story** instead of requiring one command per page. It must support long structured inputs (including 80+ page books), bulk-save exact approved page text, create every page prompt, and report validation results.

Image generation is intentionally not part of the current agent-first materialization operation. Prompts are mandatory; images remain manual until explicitly enabled in a later workflow.

The conversation is not the source of truth; saved project files are.

## 10. Provider model

### Text provider

Interface responsibility:
- structured story generation;
- story revision;
- page revision;
- prompt generation.

Initial practical provider:
- OpenRouter or another OpenAI-compatible API.

Configuration must be server-side/environment-based.

### Image provider

Interface responsibility:
- accept prompt;
- accept zero or more reference images;
- return generated image and metadata.

Required provider:
- `manual`

`manual` is implemented behind the same `ImageProvider` contract as future network providers. It never calls an API, returns `prompt_ready`, and lets the canonical story workflow store the prompt for later manual generation.

Provider configuration is server-only. Client/reader code must depend only on canonical book data and must never import provider environment configuration or secrets.

Optional providers:
- OpenAI image generation;
- Gemini image generation;
- others later.

## 11. CLI / external agent workflow

A coding agent such as Codex may operate directly on:
- `content/`
- character files;
- book files;
- prompt files;
- the story skill.

This is an authoring workflow, not an application runtime dependency.

The same canonical file format must work for:
- in-app AI Studio;
- manual editing;
- CLI agents.

When an external coding/chat agent receives an instruction equivalent to “save this approved story in FaryTale”, it should use the documented approved-story package/materialization workflow rather than asking the parent to enter technical fields in the web UI. The agent is responsible for deriving safe defaults, validating the result and reporting only unresolved choices or warnings.

## 12. Offline behavior

Already available books should remain readable offline.

At minimum cache:
- app shell;
- library manifest;
- book JSON;
- local book images used by installed/cached books.

AI generation, provider calls, and remote synchronization may require connectivity.

## 13. Privacy

Default stance:
- library is private;
- family references are local/private;
- no public sharing by default;
- no child analytics required for MVP.

When a generation request requires external image references, send only the references needed by that page.

## 14. Success criteria for MVP

The MVP is successful when:

1. At least two real books can live as folders under `content/books`.
2. The library discovers them automatically.
3. A parent can read them comfortably on desktop and mobile/tablet.
4. Reader works without AI configured.
5. Prompts can be inspected in parent mode.
6. A character definition can be reused by multiple books.
7. Parent mode can create a new draft book in the canonical format.
8. Manual image mode works end-to-end.
9. An API-backed text provider can create a structured draft without exposing keys to the client.
10. Provider failures never break existing reading.
11. An existing long book (at least 80 pages) can be maintained from Parent mode without hand-editing JSON.
12. Parent mode can insert, duplicate, delete and reorder pages while keeping canonical page content/assets valid.
13. Parent mode can create/edit reusable characters, manage their reference images and select the canonical identity reference.
14. Parent mode can edit book metadata, lifecycle status and book/page character membership.
