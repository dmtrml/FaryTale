# PROJECT HISTORY - FaryTale

> Public technical history for coding agents.
> Current handoff state lives in `PROJECT-STATE.md`. This file keeps older implementation milestones without private family story content.
> A full pre-cleanup local snapshot that may contain private story details is preserved under ignored `content/archive/project-history/` and must not be committed.

## 2026-08-29 - MVP foundation and phases 0-15

### Phases 0-4 - reader foundation

- Established Next.js App Router + React + TypeScript + Tailwind + Zod.
- Added canonical file-based `content/books/` and `content/characters/` structure.
- Implemented validated filesystem discovery with diagnostics for malformed content, unsafe paths and missing assets.
- Built the child-facing library and one-page reader with tap/swipe/keyboard navigation.
- Added a minimal PWA/offline layer for already-loaded reader content.

### Phase 5 - Parent mode

- Added deliberate parent entry with an HTTP-only short-lived cookie.
- Added parent-only book detail/editor surfaces.
- Added page text editing, image replacement, prompt inspection and basic draft creation.
- Kept child mode isolated from authoring and destructive controls.

### Phase 6 - story-skill integration

- Reflected age bands and story patterns from the children's-story skill into typed runtime rules.
- Added deterministic outline/prompt preparation without requiring an AI provider.
- Reused canonical character identity in page prompts.

### Phases 7-10 - provider and Studio architecture

- Added vendor-neutral `TextProvider` and `ImageProvider` contracts.
- Kept manual image mode as the zero-credential default.
- Added Parent AI Studio with explicit project tools instead of raw filesystem access.
- Added an optional OpenAI-compatible structured text adapter.
- Added an optional OpenAI image adapter with per-page generation and canonical reference support.
- Kept provider configuration and secrets server-only.

### Phase 11 - quality and consistency

- Centralized canonical character identity-reference selection.
- Added prompt quality checks and continuity constraints.
- Added raster image type/signature/dimension validation.
- Added previous-image history for regeneration comparison.

### Phase 12 - export and polish

- Added browser print/Save-as-PDF layout.
- Added portable ZIP export/import with path, schema, asset and checksum validation.
- Kept export/import/provider code server-side so the reader stays lightweight.

### Phase 13 - complete authoring editor

- Removed the former short-story page limit and standardized Parent operations on a 200-page ceiling.
- Added metadata/lifecycle editing, page insert/duplicate/delete/reorder operations and long-book support.
- Added full canonical character create/edit/delete and reference-image management.
- Added book-level environment/props references.
- Added flattened manual ChatGPT Image prompts for one page and whole-book generation.
- Added regression coverage for 80+ page books and structural asset safety.

### Phase 14 - theme

- Added persistent light/dark appearance with OS preference fallback.
- Kept print output forced light.

### Phase 15 - agent-first approved-story authoring

- Added versioned `ApprovedStoryPackage` v1 for complete approved stories.
- Added high-level materialization that persists exact approved text, resolves/reuses characters, creates all pages and writes one illustration prompt per scene.
- Added safe create/replace behavior with archive/rollback semantics.
- Added Studio and local CLI/API entry points for complete story materialization.
- Verified an 80-page approved story can materialize through one operation.
- Kept image generation intentionally outside materialization; pages finish `prompt_ready`.

## 2026-09-03 - practical authoring refinements

### Character workflow simplification

- Reworked character cards around the canonical identity reference and one ready-to-copy visual-character prompt.
- Moved structured character fields and reference-role management behind advanced/collapsed controls.
- Removed narrative/story context from reusable visual-character prompt composition so book-specific goals do not leak into identity references.
- Added a direct main-reference upload path.

### Book illustration workflow simplification

- Reworked Parent book detail around manual ChatGPT Image usage.
- Added one canonical book-level environment/props reference alongside reusable character identity references.
- Added ready-to-copy environment-reference prompts.
- Added flattened per-page prompts while preserving structured Markdown as provenance.
- Added a whole-book prompt that requests separate images rather than a collage/storyboard.

### Prompt moderation hardening

- Refined child-facing visual prompt composition to focus on neutral educational actions and reduce false-positive-prone defensive/body wording.
- Added an opt-in page-by-page-only minimal prompt mode for a sensitive routine workflow where combining all scenes into one request repeatedly caused moderation failures.
- Kept approved read-aloud text separate from image-prompt wording.

### Global 16:9 rule

- Standardized all page illustrations and environment/props references on horizontal 16:9.
- Added upload-time aspect-ratio validation.
- Added 16:9 requirements to flattened and technical prompts.
- Updated network image requests to a 16:9 target size.
- Covers and character identity references remain unconstrained.

### Compact Parent book editor

- Replaced the long always-visible page editor with a compact list of lightweight page rows.
- All page rows are visible for scanning; only one selected page expands into the full editor.
- Collapsed secondary sections for book/cover settings, illustration references and rare technical tools.
- Preserved page text/image/prompt/character/structural actions inside the expanded row.
- Avoided rendering dozens of hidden full editors for long books.

### Child library cover rendering

- Published books now show their actual canonical covers in the child library when available.
- The previous decorative card remains as fallback.

## 2026-09-04 - maintenance consolidation

- Removed one repeatedly failing local private book from the active library without permanent deletion; local content remains under ignored archive storage.
- Split the oversized handoff document into compact `PROJECT-STATE.md` plus this public technical history.
- Preserved the full former state snapshot locally under ignored `content/archive/project-history/` because it may contain private family story details.
- Generalized reusable character narrative metadata so it stays book-agnostic.
- Improved deterministic routine-pattern inference by removing an overly broad emotion keyword and adding concrete routine cues.
- Added tests proving body-awareness wording and predictable hair-care ritual wording resolve to `habit-routine` when no explicit pattern is supplied.

## Verification milestones

- Phase 15 baseline: 19 test files / 71 tests plus typecheck, lint and production build.
- Subsequent authoring/image UX refinements expanded coverage through 21 test files.
- 2026-09-04 consolidation: typecheck passed, lint passed, 21 test files / 84 tests passed, production build passed, and `git diff --check` passed.
