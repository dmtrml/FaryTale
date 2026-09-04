# PROJECT-STATE.md — FaryTale

> Compact handoff state for coding agents.
> Read this immediately after `AGENTS.md`. Historical implementation/session detail is preserved in `docs/PROJECT_HISTORY.md` and should be consulted only when needed.
> Repository code, canonical content and tests are the source of truth.

## Current status

**Current phase:** local/private MVP complete — Phases 0–15 finished.

**Overall state:** FaryTale is a working reader-first family storybook app with parent-only authoring. The primary creation workflow is agent-first: an approved story can be materialized into canonical book/character files plus one prompt per page without manual technical form entry. Existing books remain readable without AI, credentials, a database or internet access.

## Current product snapshot

- Stack: Next.js 16.3.3 App Router, React 19.2.8, TypeScript 5.9.3, Tailwind CSS 4.3.3, Zod 4.5.4, Vitest.
- Canonical books: `content/books/<book-id>/`.
- Canonical characters: `content/characters/<character-id>/`.
- Reader mode: library, one-page reader, tap/swipe/keyboard navigation, offline/PWA support, no authoring controls.
- Parent mode: book/character editing, prompt review/copying, image/reference upload, page operations, print/PDF, ZIP export/import, AI Studio.
- Authoring: versioned `ApprovedStoryPackage` + high-level materializer, exact approved-text preservation, character reuse, per-page prompts, 1–200 pages.
- AI providers: optional and replaceable. Manual image mode remains the default; agent-first materialization does not generate images.
- Theme: persistent light/dark UI; print remains light.
- Illustration format: page images and book environment/props references are horizontal 16:9; covers and character identity references are unconstrained.

## Active local private content

Private family story content is intentionally ignored by Git.

Current local content:
- 3 active private illustrated books; each currently has 6 pages, ready illustrations, a cover and an environment reference.
- One reusable private child character has a canonical visual identity + uploaded identity reference. Its narrative description is intentionally generic across books rather than tied to one story goal.
- One additional private routine book was removed from the active library after repeated manual image-moderation failures and is preserved under ignored `content/archive/user-removed-books/`.

## Current authoring/UX behavior

- Parent book detail uses a compact page list: all page rows are visible, but only one selected page expands into the full editor.
- Secondary controls are collapsed by default under `Книга и обложка`, `Иллюстрации и референсы` and `Дополнительные инструменты`.
- Each page can expose a flattened ready-to-copy ChatGPT Image prompt while structured Markdown remains provenance/technical detail.
- Each book can keep one canonical environment/props reference and a generated environment-reference prompt.
- A whole-book manual image prompt requests separate 16:9 images per page; sensitive workflows may opt into page-by-page-only prompt mode.
- Parent uploads validate actual page/environment aspect ratio before accepting assets.
- Network image generation, when explicitly configured, requests a 16:9 output and remains per-page.

## Important architecture decisions

1. **Reader first.** Existing books must remain readable without AI, login, database or internet.
2. **Files are canonical.** Generated manifests/caches are never the sole source of book/character data.
3. **Child and Parent modes stay separate.** No prompts, destructive actions or AI controls in child mode.
4. **AI is optional/provider-agnostic.** Secrets remain server-only; manual mode must work with zero credentials.
5. **Agent-first is the primary creation workflow.** Parent forms are fallback/inspection surfaces, not a requirement to populate technical metadata.
6. **Approved text is source-of-truth.** Materialization persists it exactly; creative changes happen before materialization or through explicit replacement.
7. **Images stay manual by default.** Agent materialization creates prompts and leaves pages `prompt_ready`; image generation/upload is a separate explicit step.
8. **Recurring characters are reusable assets.** Character narrative/identity definitions must stay book-agnostic; book-specific goals belong to books.
9. **Routine story classification should be explicit when obvious.** Deterministic inference is only a fallback; ordinary routines such as potty use, tooth brushing, washing, dressing and hair care should use `habit-routine` rather than be misclassified by incidental emotional wording.
10. **Do not add speculative SaaS infrastructure.** Accounts, payments, public sharing, marketplace, native wrappers and complex analytics remain deferred until a concrete need appears.

## Safety / privacy boundaries

- Treat child/family images as sensitive private data.
- Do not commit private local story content; `.gitignore` intentionally excludes `content/books/*`, `content/characters/*` and `content/archive/` except `.gitkeep` placeholders.
- Do not expose provider keys via `NEXT_PUBLIC_*` or client imports.
- Only send references needed for the currently requested external generation action.
- Parent hold-to-enter protection is an accidental-child-use boundary for a local/private app, not public-service authentication.

## Known issues / non-blockers

- No blocker remains for the planned local/private MVP.
- Browser-level end-to-end mutation/theme tests are not automated; current coverage is unit/integration plus runtime smoke checks.
- Agent-first materialization handles textual data/prompts; binary covers/page images/reference images remain manual by design.
- A book is bounded at 200 pages in Parent authoring operations.
- Local networking note: use `localhost` rather than assuming `127.0.0.1` on this machine because another local project has previously occupied IPv4 port 3000 while FaryTale listened on IPv6.
- Do not refactor the large Parent book-detail page merely for aesthetics; split it into subcomponents when the next substantial UI change makes that useful.

## Verification baseline

Final verification for the 2026-09-04 consolidation:
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed: 21 files / 84 tests.
- `npm run build` passed with Next.js 16.3.3.
- `git diff --check` passed.
- Local private JSON was parsed after metadata correction; the corrected hair-care routine remains 6 pages and now uses canonical `habit` / `habit-routine` metadata.

## Git / working state

- Branch: `main`.
- Remote: `origin` → `https://github.com/dmtrml/FaryTale.git`.
- The substantial post-`89d473a` working set has been consolidated: compact book-editor UX, global 16:9 handling, prompt refinements, reusable-character cleanup, routine-pattern inference tests and documentation/state cleanup.
- The verified consolidation is committed locally on `main`.
- `AGENTS.md` now requires Git checkpoints for each coherent verified change and requires push when the configured remote is writable; failures must be recorded here rather than left implicit in chat.
- Push to `origin/main` is currently blocked by GitHub authentication: the active GitHub CLI/credential-manager account is `melkamsar`, which receives HTTP 403 for `dmtrml/FaryTale`; SSH also has no usable GitHub key on this machine. Do not rewrite repository history to work around this. Authenticate an account with push access and retry the normal push.

## Files that define the project

Read in this order:
1. `AGENTS.md`
2. `PROJECT-STATE.md`
3. `docs/PRODUCT_SPEC.md`
4. `docs/BOOK_FORMAT.md`
5. `docs/IMPLEMENTATION_PLAN.md`
6. `docs/AGENT_AUTHORING.md` when materializing an approved story
7. `skills/childrens-story-creator/SKILL.md` and companion skill files for child-facing content
8. `docs/PROJECT_HISTORY.md` only when detailed historical context is needed

## Exact next action

1. Authenticate GitHub on this computer with an account that has push access to `dmtrml/FaryTale`, then run `git push origin main`.
2. After the push succeeds, return to product use rather than infrastructure work: continue making/illustrating real books with the compact editor.
3. Change the editor only when real usage reveals a concrete UX problem.
4. When the next substantial Parent book-detail UI change is required, consider splitting the large page into focused subcomponents at that time rather than doing a standalone refactor now.
