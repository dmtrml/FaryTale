# PROJECT-STATE.md — FaryTale

> Persistent handoff state for coding agents.
>
> Every agent must read this file after `AGENTS.md` and update it before ending a work session.
> Repository state, tests, and implementation files are the source of truth; correct this file whenever it becomes stale.

## Current status

**Current phase:** MVP complete — Phases 0–15 finished

**Overall state:** Phases 0–15 are complete and verified. FaryTale's primary authoring workflow is now agent-first: after the parent approves a story in chat, an agent can materialize the complete canonical book in one structured workflow, deriving technical metadata, reusing/creating characters, preserving exact approved text, assigning page characters and saving one illustration prompt per scene. Image generation is intentionally excluded from this workflow; pages remain `prompt_ready` for manual image generation/upload.

## Completed

- Product direction defined:
  - lightweight children's book library and reader first;
  - parent-only authoring mode;
  - optional AI Studio;
  - file-based canonical books and characters;
  - replaceable text/image providers;
  - manual prompt-only image workflow;
  - Codex/CLI agents are authoring tools, not runtime dependencies.
- Product specification created in `docs/PRODUCT_SPEC.md`.
- Canonical book/character format created in `docs/BOOK_FORMAT.md`.
- Autonomous phased implementation plan created in `docs/IMPLEMENTATION_PLAN.md`.
- Children's story creation skill created under `skills/childrens-story-creator/`.
- Agent autonomy and handoff rules defined in `AGENTS.md`.
- Phase 0 repository assessment completed:
  - the starting folder contained documentation/skills only, with no application implementation or Git metadata to preserve;
  - Next.js 16.3.3 App Router + React 19.2.8 + TypeScript 5.9.3 + Tailwind CSS 4.3.3 established;
  - Zod 4.5.4 schema foundation added in `src/lib/content/schemas.ts`;
  - canonical `content/books/` and `content/characters/` directories added;
  - README now documents install/dev/verification commands;
  - minimal calm reader-shell page added as a runtime smoke-test target.
- Phase 1 canonical content loader completed:
  - Book v1 / Character v1 schemas tightened with stable IDs, dates, age-range validation, lifecycle/image statuses;
  - filesystem discovery implemented in `src/lib/content/loader.ts`;
  - safe portable relative paths are enforced and traversal/absolute paths reject the affected content item;
  - malformed JSON/schema, folder/id mismatch, bad page ordering and filesystem failures produce diagnostics rather than crashing discovery;
  - missing page/cover/reference assets and unresolved characters produce warnings so readable content can still load;
  - deterministic `content/generated/library-manifest.json` generation implemented from canonical book files only.
- Phase 2 lightweight library completed:
  - responsive library home renders directly from `loadLibrary()` with no hardcoded book registry;
  - two canonical toddler books added: `miau-washes-paws` and `miau-tidies-ball`;
  - reusable `miau` character added without inventing unavailable visual-reference details;
  - loading skeleton, empty state and global friendly error state added;
  - Next.js 16 `connection()` is used so library filesystem content is read at request time instead of being frozen at build time;
  - child/default library exposes no AI, prompt or editor controls.
- Phase 3 reader completed:
  - library cards navigate with Next `<Link>` to `/books/<book-id>`;
  - one-page-at-a-time client reader keeps current page state while the book remains open;
  - navigation supports previous/next buttons, left/right tap zones, horizontal swipe, ArrowLeft/ArrowRight and Space;
  - large illustration area falls back to a calm placeholder when image metadata/file is absent;
  - canonical raster image assets are served through a restricted route that allows only the current book's declared cover/page image paths and rejects traversal/unsupported types;
  - reader includes page count/dots, accessible labels and a deliberate return-to-library control;
  - no prompt, AI, generation or editor controls appear in reader mode.
- Phase 4 PWA/offline reading completed:
  - generated Next manifest at `/manifest.webmanifest` with standalone display metadata and local SVG icon;
  - production-only service-worker registration added as progressive enhancement;
  - versioned service worker pre-caches the app shell/manifest/icon and network-first caches successful same-origin reader requests;
  - canonical `/api/content/books/...` image GETs are cacheable for offline reading;
  - future non-reader `/api/...` requests are deliberately not intercepted/cached, preserving clean authoring/provider semantics;
  - cached navigation falls back to the previously cached request or app shell when the network is unavailable.
- Phase 5 parent mode completed:
  - `/parent` uses a press-and-hold gate before setting an HTTP-only, SameSite=Strict, eight-hour parent-mode cookie;
  - all parent studio routes enforce the cookie server-side, and every mutation re-checks it inside the Server Action;
  - the current gate is explicitly documented as accidental-child-use protection for a local/private MVP, not authentication for a public service;
  - parent book list/detail views render canonical files and diagnostics separately from child mode;
  - parent can update one page text without affecting neighboring pages;
  - parent can replace one page illustration with validated PNG/JPEG/WebP/AVIF/GIF up to 5 MB, while Next's multipart transport limit is 6 MB;
  - parent can inspect and copy a declared prompt when present;
  - parent character library shows canonical narrative/visual identity and reference count;
  - parent can create a valid canonical draft book (title, goal, age range, page count) without AI;
  - child library exposes only a small “Для родителей” route entry and contains no editor controls.
- Phase 6 story skill integration completed:
  - typed age bands and story patterns mirror the project story skill without making Markdown skill files a runtime dependency;
  - deterministic pattern recommendation and age-band selection are implemented in `src/lib/story/rules.ts`;
  - parent mode can prepare a draft with explicit `authoring.ageBand`, `authoring.storyPattern`, a page-by-page outline and optional visual-style lock;
  - deterministic prompt composition creates one `prompts/NNN.md` file per page and moves missing pages to `prompt_ready`;
  - canonical character IDs and visual identity/do-not-change rules are reused in prompts rather than copied into ad-hoc chat state;
  - child library and reader now expose only `ready` books so authoring drafts do not leak into child mode.
- Phase 7 provider abstractions completed:
  - vendor-neutral `TextProvider` and `ImageProvider` contracts live in `src/lib/providers/contracts.ts`;
  - `ManualImageProvider` implements the same image contract as future network adapters and returns `prompt_ready` without bytes/network calls;
  - deterministic story preparation now calls `ManualImageProvider`, proving manual mode uses the provider abstraction rather than a special UI-only branch;
  - `ProviderRegistry` supports replaceable text/image factories while the default registry exposes manual image mode only;
  - provider environment selection is isolated in `src/lib/providers/server-config.ts` with `server-only` and currently defaults to `manual` image / disabled text;
  - client-boundary tests reject imports of server provider config and provider/API-key environment variables from client components.
- Phase 8 parent AI Studio completed:
  - `/parent/studio` is inside the existing parent cookie gate and is linked from the parent navigation;
  - Studio uses a client chat surface backed by a Server Action, while canonical state remains outside chat state;
  - explicit typed tools cover list/get books, create book, update page, create outline, create/revise one page prompt, and list/get characters;
  - Studio input never receives raw filesystem primitives or a generic file-read/write tool;
  - the initial interpreter is deterministic/local (`/books`, `/book`, `/outline`, `/prompt`, `/page`, `/create`, etc.) so the Studio works without any model/API configuration;
  - outline and prompt generation were split so one page prompt can be revised independently rather than rewriting every prompt;
  - mutations revalidate parent/reader routes and reload from canonical files, so important book state does not depend on chat history.
- Phase 9 API text provider completed:
  - OpenAI-compatible chat-completions adapter implemented with configurable server-only base URL/model/API key and OpenRouter-friendly defaults;
  - structured requests use `response_format.type = json_schema` and are additionally parsed/validated with Zod before application code consumes them;
  - bounded provider retries cover retryable HTTP failures and structured-output repair attempts are capped at three;
  - provider error messages expose safe HTTP status information rather than raw provider bodies/credentials;
  - optional Studio free-text interpretation uses the text provider only to select an allowlisted local Studio command, then executes the existing typed tool layer;
  - slash commands and all reader/manual workflows remain functional with the text provider disabled and zero credentials.
- Phase 10 image generation completed:
  - server-only OpenAI Image API adapter added with `gpt-image-2` default and configurable base URL/model/key;
  - prompt-only requests use `/images/generations`; requests with canonical references use multipart `/images/edits` and `image[]`;
  - `manual` remains the default provider and no image API call occurs unless a parent configures a network provider and explicitly generates one page;
  - page-generation service loads only the selected page prompt plus one canonical identity reference per referenced character, then supplies bytes to the provider instead of granting filesystem access;
  - generation transitions only the target page through `generating` to `ready`, saves the returned raster asset, and appends provider/model/request/reference provenance to that page prompt;
  - provider failures set only the target page to `failed`, append safe failure provenance and preserve all other page states/assets;
  - parent book detail exposes one-page generate/regenerate controls only when a network image provider is configured.
- Phase 11 quality and consistency completed:
  - canonical identity reference selection is centralized and shared by prompt composition and image-generation reference loading;
  - per-book style lock and character continuity are derived in one consistency layer while canonical character identity remains stored only in character data;
  - prompt composition runs a structural quality gate before writing, requiring key sections and exactly one occurrence of each canonical identity description;
  - uploaded/generated PNG, JPEG, GIF, WebP and AVIF content now undergoes declared-type/signature and dimension validation before a page can become `ready`;
  - parent book detail shows validated image dimensions and prompt-quality status;
  - successful regeneration archives the previous page image under `pages/history/`, records that previous path in prompt provenance and exposes a parent-only current/previous comparison view.
- Phase 12 export and polish completed:
  - parent-only printable route renders the whole book with page breaks and a browser Print/Save-as-PDF control, keeping PDF rendering out of reader runtime dependencies;
  - portable FaryTale ZIP export contains an export manifest, the complete canonical book directory and complete directories for characters referenced by the book;
  - the ZIP writer uses a small server-side stored-entry implementation with CRC32; importer accepts stored/deflated entries and enforces safe paths, entry/expanded-size limits and checksums;
  - export self-validates before download, including Book/Character schemas, declared assets, image signatures/dimensions and character reference presence;
  - import fully validates the package before canonical book writes, refuses an existing book id and refuses conflicting canonical character definitions;
  - parent book list exposes validated ZIP restore; book detail exposes ZIP export and print/PDF controls while child mode remains unchanged;
  - focused performance pass kept ZIP/import/provider logic server-side, added no browser ZIP/PDF library, and kept the child reader independent of export/AI code paths;
  - focused accessibility pass preserved explicit reader button/link labels, associated import/upload form labels, meaningful print illustration alt text and keyboard reader navigation;
  - `docs/MVP.md`, README and `docs/BOOK_FORMAT.md` document implemented flows, offline/manual behavior, provider setup, backup/restore and privacy/security boundaries.
- Phase 13 complete authoring editor completed:
  - removed the artificial 12-page limit; draft creation is bounded at 200 pages and regression tests exercise an 80-page book growing beyond 80 pages;
  - parent book detail now edits title, language, goal, age range, lifecycle status, referenced characters and cover without JSON editing;
  - long books use one selected-page editor with direct page jump and previous/next navigation rather than rendering every page editor at once;
  - parent can insert before/after, duplicate, delete and move pages; structural edits deterministically renumber pages and corresponding outline beats;
  - duplicated image/prompt assets are copied to independent collision-free paths; deleted page assets are archived under `archive/deleted-pages/` rather than silently destroyed;
  - image replacement and prompt regeneration detect post-reorder path collisions so one page cannot overwrite another page's existing numbered asset;
  - parent can assign canonical characters globally to a book and independently to the selected page;
  - character library now supports create/edit/delete, narrative/visual identity fields, palette/fixed/do-not-change rules, reference upload/removal, editable reference roles and explicit identity-reference selection;
  - character deletion is blocked while any canonical book/page still references that character;
  - Studio typed tools/allowlist now include long-book page operations, metadata updates and character create/update in addition to the original story tools;
  - public book asset route now serves only `ready` books; draft/archived editor and print assets use a separate parent-gated private route;
  - PRODUCT_SPEC, BOOK_FORMAT, MVP docs and README now state the complete long-book/character authoring behavior.
- Phase 14 dark theme completed:
  - parent navigation exposes an accessible light/dark theme toggle;
  - the selected preference is stored locally in browser `localStorage` as `farytale-theme`;
  - an early initialization script applies the saved preference before hydration and falls back to `prefers-color-scheme` when no preference exists;
  - the same dark palette applies across child reader/library and parent authoring surfaces without adding child-side editor controls;
  - the established warm Tailwind color palette is mapped to dark surfaces, muted text and borders while preserving the existing light palette;
  - printable/PDF book output uses `print-root` overrides so it remains white/readable even when the app UI is dark;
  - README and `docs/MVP.md` document theme persistence, OS fallback and print behavior.
- Phase 15 agent-first approved-story authoring completed:
  - `src/lib/agent/story-package.ts` defines validated `ApprovedStoryPackage` v1 for 1–200 page approved stories, page scenes and textual character definitions;
  - `src/lib/agent/materialize.ts` materializes the whole approved story through one high-level operation rather than one page/tool call at a time;
  - approved page text is persisted exactly and rechecked after canonical reload so materialization cannot silently rewrite an already-approved story;
  - language defaults safely, age band is derived from the age range, story pattern is inferred from the goal when omitted, and goal type/slug/page numbering/prompt paths/statuses are generated as technical metadata;
  - existing canonical characters are always reused and cannot be silently redesigned by conflicting package fields; genuinely new characters require and receive complete textual canonical definitions;
  - every page stores explicit character membership and receives `prompts/NNN.md` with scene-specific action, approved text alignment context, canonical identity, available reference paths, optional environment/composition/continuity notes, style lock and negative constraints;
  - materialization makes no image-provider call and writes no generated image path; the book and every page finish `prompt_ready` for the user's manual chat-generation/upload workflow;
  - the validated source package and completion report are persisted under `authoring/approved-story.json` and `authoring/materialization-report.json`;
  - `mode: create` refuses overwrite; explicit `mode: replace` archives the entire old book under `content/archive/agent-replaced-books/` and includes rollback if installing the replacement fails;
  - Studio exposes `/materialize-json <ApprovedStoryPackage JSON>` and the message ceiling was raised to 120000 characters for structured long-book handoff;
  - parent-gated `/api/parent/agent/materialize` plus `npm run agent:materialize -- <package.json>` provide a local external-agent handoff path without manual form entry;
  - `AGENTS.md` now treats phrases such as “занеси эту сказку в FaryTale” as an instruction to materialize autonomously rather than ask for technical UI fields;
  - `docs/AGENT_AUTHORING.md` is the dedicated contract/workflow guide; README, MVP, product spec and book-format docs link/reflect it.

## Verification completed

Phase 0 verification on 2026-08-29:

- `npm run typecheck` passed.
- `npm run lint` passed after correcting the PostCSS config export style.
- `npm test` passed: 1 file, 2 schema tests.
- `npm run build` passed with Next.js 16.3.3.
- `npm run dev` started successfully; port 3000 was already occupied, Next selected port 3001, and `HEAD /` returned HTTP 200.
- Dependency install reported 0 vulnerabilities.

Phase 1 verification on 2026-08-29:

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed: 2 files, 10 tests.
- `npm run build` passed.
- Tests cover direct book discovery, malformed JSON, ordered pages, missing assets, unresolved characters, unsafe paths and deterministic manifest output.

Phase 2 verification on 2026-08-29:

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed: 2 files, 10 tests.
- `npm run build` passed with no Turbopack filesystem-tracing warnings; `/` is dynamic/server-rendered on demand.
- Production server smoke-tested on port 3010; HTML contained both canonical Miau book titles.

Phase 3 verification on 2026-08-29:

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed: 3 files, 13 tests.
- `npm run build` passed; `/books/[bookId]` and `/api/content/books/[bookId]/asset` are dynamic routes.
- Production runtime smoke test: `miau-washes-paws` returned HTTP 200 and contained title + first-page text.
- Unknown book returned HTTP 404.
- Asset traversal attempt (`../../AGENTS.md`) returned HTTP 404.

Phase 4 verification on 2026-08-29:

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed: 4 files, 15 tests.
- Service-worker behavior test simulated an online book response being cached and then served successfully after a forced network failure.
- A separate service-worker test verified that future non-reader API requests are not intercepted.
- `npm run build` passed and generated `/manifest.webmanifest`.
- Production smoke test: manifest, `/sw.js` and `/icon.svg` returned HTTP 200; manifest reports `display: standalone`; versioned reader cache/service-worker reader API rule present.

Phase 5 verification on 2026-08-29:

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed: 6 files, 21 tests.
- Mutation tests cover one-page text editing, one-page image replacement, declared prompt reads, valid draft creation/discovery, and unsafe book-id rejection.
- `npm run build` passed with all parent routes dynamic and Server Actions enabled with a 6 MB request limit.
- Production runtime smoke test: child `/` returned 200 and did not contain editor controls; unauthenticated `/parent/books` returned 307 to `/parent`; the same route with the parent-mode cookie returned 200 and listed canonical books; parent book detail returned 200 with text-save, image-upload and prompt UI.

Phase 6 verification on 2026-08-29:

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed: 7 files, 23 tests.
- Story tests cover toddler age-band selection, habit-pattern recommendation, outline persistence, canonical character reuse, per-page prompt generation and manual generation metadata.
- `npm run build` passed with Next.js 16.3.3.
- Production runtime smoke test with the parent-mode cookie returned the Phase 6 “Story pattern” authoring controls for `miau-washes-paws`.

Phase 7 verification on 2026-08-29:

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed: 9 files, 29 tests.
- Provider tests cover manual deferred generation, empty-prompt rejection, default manual registration and swapping fake text/image adapters behind stable contracts.
- Server-boundary tests confirm provider environment config is marked `server-only` and not imported/read by client components.
- `npm run build` passed with Next.js 16.3.3.

Phase 8 verification on 2026-08-29:

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed: 10 files, 31 tests.
- Studio tests create a draft through the orchestrator, update one page, save an outline, save one page prompt and then re-read the persisted canonical book/prompt files.
- A negative orchestration test confirms an attempted arbitrary path command (`/read ../../AGENTS.md`) is not recognized/executed.
- `npm run build` passed and added dynamic `/parent/studio`.
- Production runtime smoke test: unauthenticated `/parent/studio` returned HTTP 307 to `/parent`; with the parent cookie the route returned normal HTML containing AI Studio, `/help` and project-tool UI.

Phase 9 verification on 2026-08-29:

- `npm run typecheck` passed.
- `npm run lint` passed with no warnings.
- `npm test` passed: 11 files, 35 tests.
- Mocked adapter tests verify chat-completions URL/body, Bearer auth, JSON Schema response format, response parsing and bounded retry on HTTP 503 without a live request.
- Structured-output tests verify an invalid first model result is rejected and repaired on a bounded retry before being accepted by Zod.
- Studio tests verify a fake text provider can translate free text into an allowlisted command while actual mutation still runs through the same project tools.
- `npm run build` passed with Next.js 16.3.3 and no API credentials configured.

Phase 10 verification on 2026-08-29:

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed: 13 files, 41 tests.
- Mocked image-adapter tests verify `/images/generations`, multipart `/images/edits`, Bearer auth, supplied reference bytes, base64 decoding and safe HTTP errors without live API calls.
- Page-generation service test observes page 1 in `generating` while the fake provider runs, verifies page 2 remains `prompt_ready`, then verifies only page 1 becomes `ready` with `pages/001.png` and provenance.
- Failure test verifies page 1 becomes `failed` after a fake provider error while page 2 remains `prompt_ready`.
- Manual-provider service test verifies the same workflow returns the page to `prompt_ready` without creating image bytes.
- `npm run build` passed with Next.js 16.3.3 and no image API credentials configured.

Phase 11 verification on 2026-08-29:

- `npm run typecheck` passed.
- `npm run lint` passed with no warnings.
- `npm test` passed: 15 files, 49 tests.
- Prompt-quality tests verify explicit identity-reference preference, canonical identity appearing exactly once, fixed continuity traits and duplicate-identity detection.
- Image-inspection tests verify real PNG dimensions, declared-type rejection and maximum-dimension enforcement; parent mutation tests reject fake image bytes before `ready`.
- Regeneration-history test verifies the prior ready asset is copied to a deterministic `pages/history/...` path and referenced in provenance before replacement.
- `npm run build` passed and includes the parent-gated history asset route.

Phase 12 verification on 2026-08-29:

- `npm run typecheck` passed.
- `npm run lint` passed with no warnings.
- `npm test` passed: 16 files, 52 tests.
- Export/import tests perform a full round trip: create a canonical book with prompt/image/referenced character, export it, validate the ZIP, import into an empty content root and rediscover the restored book/character/assets.
- Negative export/import tests reject a missing declared image and unsafe ZIP traversal path before canonical writes.
- `npm run build` passed with Next.js 16.3.3 and includes `/parent/books/[bookId]/print`, parent-gated ZIP export/import and prior-image history routes.
- Production smoke on port 3010: unauthenticated print returned 307 to `/parent`; parent print returned 200; unauthenticated export returned 404; parent export returned 200 with ZIP signature `504b0304`; intentionally invalid ZIP import returned HTTP 400 without a canonical write.
- Smoke production server was stopped after verification and temporary smoke artifacts were removed.

Phase 13 verification on 2026-08-29:

- `npm run typecheck` passed.
- `npm run lint` passed with no warnings.
- `npm test` passed: 17 files, 62 tests.
- Long-book tests create an 80-page draft, grow it beyond 80 pages, insert/move/duplicate/delete pages, verify deterministic renumbering and preserve/independently copy/archive image and prompt assets as appropriate.
- Collision-safety tests reorder pages and then replace/regenerate assets, confirming one page cannot overwrite another page's previously numbered image or prompt.
- Book-authoring tests cover metadata/lifecycle/character membership and validated cover replacement; character tests cover create/edit, reference upload/removal, editable roles, identity selection and deletion safety when referenced.
- Studio tests cover explicit long-book commands for 80-page creation, insertion, duplication, moving, page-character assignment, metadata updates and character create/update while retaining the tool allowlist boundary.
- `npm run build` passed with Next.js 16.3.3 and includes separate parent-gated book-asset and character-reference routes alongside the ready-only public book asset route.
- Production smoke on port 3010: unauthenticated parent book detail returned 307; parent book/character/new-book views returned 200 and exposed language/cover/page-management/character-reference controls; new-book UI exposes the 200-page bound; child reader returned 200 without those authoring controls.
- Page deletion requires explicit confirmation both in the form and inside the Server Action.
- Final smoke production server was stopped after verification; no runtime smoke artifacts remain.

Phase 14 verification on 2026-08-29:

- `npm run typecheck` passed.
- `npm run lint` passed with no warnings.
- `npm test` passed: 18 files, 64 tests.
- Theme regression tests verify that an explicit saved light/dark choice wins over the OS preference and that first-use initialization falls back to the OS preference.
- `npm run build` passed with Next.js 16.3.3.
- Production smoke on port 3010 confirmed the root HTML contains the early `farytale-theme` initializer, Parent mode renders `theme-toggle`, and the printable book route renders `print-root` for forced-light print styling.
- Final smoke production server was stopped after verification.

Phase 15 verification on 2026-08-29:

- `npm run typecheck` passed.
- `npm run lint` passed with no warnings.
- `npm test` passed: 19 files, 71 tests.
- Agent materialization tests verify exact approved-text preservation, distinct prompt-per-scene output, canonical Miau reuse despite conflicting package fields, complete textual creation of a new character, safe replace/archive behavior and rejection of incomplete unknown characters before book creation.
- A dedicated regression test materializes an 80-page approved story in one call and verifies all 80 canonical pages plus `prompts/080.md`.
- Studio orchestration tests verify `/materialize-json` materializes a complete approved story and returns prompt/page counts through the high-level tool.
- `npm run build` passed with Next.js 16.3.3 and includes the new dynamic `/api/parent/agent/materialize` route.
- Production runtime smoke on port 3010: unauthenticated agent materialize returned 404; parent-cookie invalid package returned 400; `npm run agent:materialize` reached the production materializer and safely rejected a normal canonical `book.json` as the wrong package schema without writing content.
- The production smoke server was stopped after verification; no smoke book/content was created.

## Important decisions

1. **Reader-first architecture**  
   Existing books must remain readable without AI, login, database, or internet.

2. **Canonical file-based content**  
   Books live under `content/books/<book-id>/`.  
   Characters live under `content/characters/<character-id>/`.  
   Generated indexes/caches may exist but are not the sole source of truth.

3. **Two product modes**  
   - Child/Reader Mode: simple, calm, no AI/editor controls.  
   - Parent Mode: editing, prompts, characters, AI Studio, export.

4. **AI is optional and provider-agnostic**  
   Text/image vendors must sit behind interfaces. Manual image mode must work without credentials.

5. **Codex CLI is not an app runtime dependency**  
   External coding agents may edit the same canonical project files using `AGENTS.md` and the story skill.

6. **Persistent handoff is mandatory**  
   Every coding session must update this file before ending.

7. **Current frontend baseline**  
   Use the established Next.js App Router stack rather than replacing it. Keep content loading server-side/file-based and keep reader runtime independent from AI providers.

8. **Agent-first is the primary creation workflow**  
   Parent forms remain available, but after a story is approved the preferred path is a versioned `ApprovedStoryPackage` materialized by the agent. The parent should not be asked to fill technical metadata that can be derived safely.

9. **Approved text is not regenerated during persistence**  
   Materialization saves the approved text exactly. Creative revision happens before materialization or through an explicit later replacement.

10. **Images remain manual in the current agent workflow**  
   Agent materialization must create prompts but must not invoke image generation. Existing/manual character references are reused when present; missing binary reference art is a warning, not a blocker.

## Real agent-first acceptance pass — 2026-09-01

- Materialized the approved real story `emi-and-her-potty` ("Эми и её горшок") through the documented external-agent flow.
- Created and canonically saved the new reusable character `emi` with a complete textual identity definition; no binary reference image exists yet.
- Created 6 canonical pages and exactly 6 illustration prompts; all pages remain `prompt_ready` and no image generation was triggered.
- Verified the canonical book is `prompt_ready`, uses age band `18-24m`, pattern `habit-routine`, goal type `habit`, has 6 pages, 6 prompt files and 0 page images.
- Parent book route returned HTTP 200 on the dedicated FaryTale dev server at port 3010.
- Concrete usability finding: when `storyPattern`/goal type were omitted for the Russian potty-training goal, deterministic inference selected `emotion-regulation`. The accepted package was corrected to explicit `habit-routine` / `habit`; future agent-authored routine stories should set an explicit pattern when inference is ambiguous.

## Character card UX simplification — 2026-09-03

- Parent character cards now prioritize the user's manual ChatGPT Image workflow instead of exposing structured metadata as the primary UI.
- Each character card shows the canonical identity reference first and one deterministic, ready-to-copy character-generation prompt assembled from visual identity, palette, fixed traits and do-not-change rules.
- Structured character fields remain canonical and editable but are collapsed under `Расширенные настройки персонажа`; full reference-role management is likewise collapsed under `Управлять референсами`.
- This is a presentation/derivation change only: Character v1 storage is unchanged, so existing books, agent materialization and page-prompt composition remain compatible.
- Follow-up refinement removed narrative/story description from the visual character prompt so story-specific text such as potty-training context cannot accidentally leak into a reusable character reference image.
- The main-reference block now includes a direct `Загрузить главный референс` flow; uploading there automatically makes the new image the identity reference while preserving older references as ordinary references.
- Verification: `npm run typecheck`, `npm run lint`, `npm test` (20 files / 72 tests) and `npm run build` all passed on 2026-09-03.
- Production smoke on port 3010 returned the Parent characters page with `Готовый промпт персонажа`, `Главный референс`, `Скопировать промпт`, `Загрузить главный референс` and collapsed `Расширенные настройки персонажа`; the smoke server was stopped after verification.

## Book illustration UX simplification — 2026-09-03

- Parent book detail now prioritizes the manual ChatGPT Image workflow instead of exposing structured prompt Markdown as the primary copy surface.
- Book v1 now has a default-empty `references` list. Parent mode currently uses one canonical `environment` reference stored under the book folder for room/location, recurring props and visual context; character identity references remain canonical in the character library.
- The book screen shows the canonical character identity reference(s) and the book environment/props reference together in `Иллюстрации всей книги`; the environment reference can be uploaded/replaced directly there.
- `src/lib/story/chat-image-prompt.ts` deterministically derives a flattened ready-to-copy prompt for one selected page from the saved technical prompt plus canonical references. The user no longer needs to manually combine `Scene`, `Characters`, `Environment`, `Composition`, `Style lock`, `Continuity` and negative sections.
- The same helper derives one whole-book ChatGPT Image request that asks for one separate image per page, explicitly rejects collage/storyboard output, explains the attached references once and then lists every page scene in order.
- The original Markdown prompt remains unchanged as technical/provenance source and is collapsed under `Техническая структура промпта` for inspection. Book metadata and cover controls are likewise collapsed under `Настройки книги и обложка` so the everyday illustration workflow is visually primary.
- Book-level references are path-validated by the loader, served only through the parent-gated book asset route, validated in ZIP export/import, and added after canonical character references when an explicitly configured network image provider generates a page.
- Runtime smoke against the real `emi-and-her-potty` book on port 3010 returned HTTP 200 and rendered `Иллюстрации всей книги`, `Скопировать всю книгу`, the character/environment reference areas, `Готовый промпт страницы`, `Скопировать эту страницу`, collapsed `Техническая структура промпта` and collapsed `Настройки книги и обложка`. No test reference image was written into the real book; the smoke server was stopped afterward.
- Verification after the final implementation: `npm run typecheck`, `npm run lint`, `npm test` (21 files / 77 tests) and `npm run build` all passed on 2026-09-03.
## Known issues / blockers

- No blocker remains for the planned local/private MVP.
- Provider API credentials are optional; reader/manual workflows remain usable with none configured.
- A single book is intentionally bounded at 200 pages in Parent authoring operations; this replaces the accidental 12-page limit and is sufficient for the current 80-page real-book use case.
- Port 3000 was occupied during the Phase 0 smoke test; Next automatically used 3001. This is an environment condition, not an application blocker.
- The project folder did not contain `.git` at Phase 0 assessment time.
- Parent hold-to-enter mode is deliberate UX isolation from a child, not authentication for a hostile/public multi-user deployment.
- Browser-level end-to-end mutation/theme-click tests are not yet automated; Phases 13–14 use unit/integration coverage plus production runtime smoke tests.
- Agent-first materialization currently handles textual book/character data and prompts. Binary cover/page/reference images are intentionally still uploaded manually by the parent; this matches the current workflow and is not a Phase 15 blocker.

## Files that define the project

Read in this order:

1. `AGENTS.md`
2. `PROJECT-STATE.md`
3. `docs/PRODUCT_SPEC.md`
4. `docs/BOOK_FORMAT.md`
5. `docs/IMPLEMENTATION_PLAN.md`
6. `skills/childrens-story-creator/SKILL.md`
7. Companion files under the same skill directory as needed.

## Exact next action

The Phase 0–15 local/private MVP, first real agent-first materialization, character-card UX simplification and book illustration UX simplification are complete. Next:

1. generate and approve one canonical Emi reference image in chat, then upload it through the character card's `Загрузить главный референс` control;
2. choose/create one approved room reference for `emi-and-her-potty` where the room, blocks, recognizable potty and overall style are visible, then upload it through `Загрузить референс окружения` on the book screen;
3. use `Скопировать всю книгу` to try one batch ChatGPT Image request for all 6 separate page images; if consistency is insufficient, use the per-page `Скопировать эту страницу` workflow with the same canonical references;
4. upload approved page images to their corresponding pages and verify visual continuity of Emi and the recognizable potty (pink base, white rim, blue inner bowl);
5. set `emi-and-her-potty` to `ready` only after the parent approves the finished illustrations and wants the book visible in child mode;
6. keep the discovered ambiguous story-pattern inference issue in mind for later implementation improvement; do not add speculative infrastructure before another concrete need appears.
