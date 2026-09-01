# Autonomous Implementation Plan

The coding agent should execute the phases below in order and continue automatically after a phase passes its checks.

Use checkboxes as project status. Do not mark a phase complete until its acceptance criteria pass.

## Phase 0 — Repository assessment

- [x] Inspect current repository.
- [x] Preserve useful existing work.
- [x] Confirm or establish TypeScript web app structure.
- [x] Add/update basic README development commands.
- [x] Add schema validation foundation.
- [x] Add `content/books` and `content/characters` structure without deleting existing assets.

Acceptance:
- app runs locally;
- typecheck/build baseline is known;
- no existing useful content is lost.

## Phase 1 — Canonical content loader

- [x] Define TypeScript/Zod schemas for Book v1 and Character v1.
- [x] Implement filesystem loader.
- [x] Implement generated library manifest.
- [x] Add graceful diagnostics for invalid books.
- [x] Add tests.

Acceptance:
- adding a valid book folder makes it appear in runtime data without manually editing app code;
- malformed content produces a useful parent/developer diagnostic rather than crashing the app.

## Phase 2 — Lightweight library

- [x] Build library home.
- [x] Book cover cards.
- [x] Responsive tablet/mobile layout.
- [x] Empty/loading/error states.
- [x] Keep visual design calm and child-friendly.

Acceptance:
- two sample/real books render from canonical content only;
- no AI setup is required.

## Phase 3 — Reader

- [x] One-page-at-a-time book reader.
- [x] Swipe/tap/keyboard page navigation.
- [x] Large illustration + short text.
- [x] Page indicator.
- [x] Full-screen-friendly layout.
- [x] Preserve position while book is open.
- [x] Add basic accessibility labels.

Acceptance:
- comfortable on common phone/tablet dimensions;
- child mode contains no prompt/AI/editor controls;
- missing image uses a safe placeholder.

## Phase 4 — PWA / offline reading

- [x] Add installable PWA behavior.
- [x] Cache app shell.
- [x] Cache canonical book assets needed for reading.
- [x] Define clear online/offline behavior.

Acceptance:
- previously loaded books can be reopened without network;
- AI/provider features may be unavailable offline without harming the reader.

## Phase 5 — Parent mode

- [x] Add deliberate parent-mode entry.
- [x] Book detail/editor view.
- [x] Inspect/edit page text.
- [x] Inspect/copy prompt.
- [x] Replace/upload page illustration.
- [x] Character library UI.
- [x] Basic draft creation.

Acceptance:
- parent can maintain a book without touching source code;
- child mode remains visually isolated.

## Phase 6 — Story skill integration

- [x] Load/reflect rules from `skills/childrens-story-creator`.
- [x] Implement story template/pattern selection.
- [x] Produce structured outline/pages.
- [x] Create prompt files from structured story data.
- [x] Reuse canonical characters.

Acceptance:
- a story can be created as a valid draft using deterministic/manual logic even with no AI configured;
- age group and goal are saved explicitly.

## Phase 7 — Provider abstractions

- [x] Define `TextProvider`.
- [x] Define `ImageProvider`.
- [x] Implement `ManualImageProvider`.
- [x] Add server-only provider configuration.
- [x] Add mocked provider tests.
- [x] Ensure secrets never reach client bundle.

Acceptance:
- provider can be swapped without changing book format or reader;
- manual mode works completely without API credentials.

## Phase 8 — Parent AI Studio chat

- [x] Add parent-only chat UI.
- [x] Add server-side chat orchestration.
- [x] Give the AI explicit project tools/actions instead of raw filesystem freedom.
- [x] Tools should include:
  - list books;
  - get book;
  - create outline;
  - create book;
  - update page;
  - create/revise prompt;
  - list/get characters.
- [x] Persist results to canonical files.

Acceptance:
- chat can create or revise a draft book;
- reloading the page preserves the result because canonical files changed;
- no important story state exists only in chat transcript.

## Phase 9 — API text provider

- [x] Implement one OpenAI-compatible text adapter, preferably usable with OpenRouter.
- [x] Structured output / schema validation.
- [x] Retries and safe failure messages.
- [x] No live API dependency in tests.

Acceptance:
- configured provider can generate structured pages;
- invalid model output is rejected/repaired without corrupting book files.

## Phase 10 — Image generation

- [x] Keep manual mode as default-safe fallback.
- [x] Implement first real image provider adapter.
- [x] Support reference images.
- [x] Generate one page independently.
- [x] Retry/replace one page independently.
- [x] Store generation metadata in prompt/provenance file.
- [x] Never regenerate all pages when only one page needs replacement.

Acceptance:
- one page can move `prompt_ready -> generating -> ready`;
- failure returns to a recoverable state;
- existing book remains readable throughout.

## Phase 11 — Quality and consistency

- [x] Character identity/reference selection.
- [x] Per-book visual consistency rules.
- [x] Prompt composition rules.
- [x] Basic image dimensions/type checks.
- [x] Optional generation comparison workflow.

Acceptance:
- recurring character metadata is reused across pages/books;
- prompts do not duplicate/contradict canonical character identity.

## Phase 12 — Export and polish

- [x] Printable/PDF export or browser-print layout.
- [x] Book ZIP export preserving JSON/prompts/assets.
- [x] Import validation.
- [x] Performance pass.
- [x] Accessibility pass.
- [x] Final MVP documentation.

Acceptance:
- a family can archive/export a complete book independently of the app;
- the project can be restored from canonical content.

## Phase 13 — Complete Authoring Editor

- [x] Remove the artificial short-story page-count limit and support at least 100 pages per book.
- [x] Edit book metadata from Parent mode: title, language, goal, age range, lifecycle status and cover.
- [x] Add pages from Parent mode, including insertion at a chosen position.
- [x] Duplicate pages without overwriting neighboring assets/prompts.
- [x] Delete pages safely and renumber remaining pages deterministically.
- [x] Reorder pages and keep page numbers, prompts and image paths coherent.
- [x] Make long-book editing practical with compact page navigation rather than one giant editor column.
- [x] Create new canonical characters from Parent mode.
- [x] Edit canonical character narrative/visual identity, fixed traits and do-not-change rules.
- [x] Upload/remove character reference images, edit their roles and choose the canonical identity reference.
- [x] Delete characters only when that cannot leave existing books with broken character references.
- [x] Manage a book's referenced character IDs from Parent mode.
- [x] Extend AI Studio typed tools where needed so authoring capabilities are not UI-only.
- [x] Add tests for 80+ page books, page insertion/duplication/deletion/reordering, character CRUD/reference safety and lifecycle transitions.
- [x] Update README/MVP documentation and rerun typecheck, lint, tests, build and runtime smoke checks.

Acceptance:
- an existing 80-page canonical book can be maintained from Parent mode without hand-editing JSON;
- a parent can add, remove, duplicate and reorder pages while canonical numbering/assets remain valid;
- a parent can create and maintain reusable characters and their reference images without hand-editing JSON;
- no artificial 12-page creation limit remains;
- child/reader mode remains isolated from authoring controls;
- the MVP may be called complete only after this phase passes its checks.

## Deferred

Do not implement unless core MVP is complete:
- public social sharing;
- marketplace;
- payments/subscriptions;
- multi-family SaaS;
- native mobile wrappers;
- video generation.

## Phase 14 — Dark theme

- [x] Add a parent-visible light/dark theme toggle.
- [x] Persist the selected theme locally in the browser.
- [x] Respect the operating-system dark preference when no explicit choice exists.
- [x] Apply the dark palette across reader and parent surfaces without exposing editor controls to child mode.
- [x] Keep print output light/white.
- [x] Add theme initialization regression tests and run full verification.

Acceptance:
- parent can switch the app to a comfortable dark palette without reloading;
- the choice survives reloads;
- first visit follows the OS preference;
- print remains white and readable.

## Phase 15 — Agent-first approved-story authoring

- [x] Define a versioned structured `ApprovedStoryPackage` for complete approved stories, characters and page scenes.
- [x] Add one high-level materialization service that creates/replaces a canonical draft without one tool call per page.
- [x] Treat approved page text as immutable input during materialization; do not silently rewrite it.
- [x] Infer age band, story pattern and safe technical metadata when the package omits them.
- [x] Reuse existing canonical characters and create complete textual definitions for new characters.
- [x] Save explicit page-character membership for every page.
- [x] Generate and persist one final illustration prompt per scene/page using canonical identity, continuity and available reference paths.
- [x] Leave all non-illustrated pages in `prompt_ready`; do not generate images in this phase.
- [x] Support 80+ page structured story packages without the old Studio 2500-character bottleneck.
- [x] Add a high-level Studio/tool entry point for structured materialization.
- [x] Add a local agent/CLI handoff path so an external coding agent can materialize a JSON package without manual form entry.
- [x] Validate the completed book/prompts and return a concise report with warnings such as missing character reference images.
- [x] Document the phrase-level external-agent workflow in `AGENTS.md` and a dedicated authoring guide.
- [x] Add regression tests for exact-text preservation, 80-page materialization, prompt-per-scene coverage, character reuse/new-character creation and safe replacement/archive behavior.
- [x] Run typecheck, lint, tests, build and production/runtime smoke verification.

Acceptance:
- after the parent approves a story, an agent can materialize the complete book without asking the parent to fill technical UI fields;
- every approved page text is stored exactly as approved;
- every page has a saved illustration prompt and `prompt_ready` state unless a manual image already exists in a later workflow;
- existing recurring characters are reused rather than silently redesigned;
- new textual character definitions are saved automatically, while missing binary reference images are reported as warnings rather than blocking book creation;
- no image-generation provider call is made by approved-story materialization;
- an 80-page approved story completes through one high-level workflow and validates successfully.
