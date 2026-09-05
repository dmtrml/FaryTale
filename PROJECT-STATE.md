# PROJECT-STATE.md — FaryTale

> Compact handoff state for coding agents.
> Read this immediately after `AGENTS.md`. Historical implementation/session detail is preserved in `docs/PROJECT_HISTORY.md` and should be consulted only when needed.
> Repository code, canonical content and tests are the source of truth.

## Current status

**Current phase:** local/private MVP complete — canonical library classification plus filtering/sorting implemented.

**Overall state:** FaryTale is a working reader-first family storybook app with parent-only authoring. The primary creation workflow is agent-first: an approved story can be materialized into canonical book/character files plus one prompt per page without manual technical form entry. Existing books remain readable without AI, credentials, a database or internet access.

## Current product snapshot

- Stack: Next.js 16.3.3 App Router, React 19.2.8, TypeScript 5.9.3, Tailwind CSS 4.3.3, Zod 4.5.4, Vitest.
- Canonical books: `content/books/<book-id>/`.
- Canonical characters: `content/characters/<character-id>/`.
- Reader mode: library, one-page reader, tap/swipe/keyboard navigation, offline/PWA support, no authoring controls.
- Parent mode: book/character editing, prompt review/copying, image/reference upload, page operations, print/PDF, ZIP export/import, AI Studio.
- Authoring: versioned `ApprovedStoryPackage` + high-level materializer, exact approved-text preservation, character reuse, per-page prompts, 1–200 pages.
- Agent-first materialization also persists canonical library classification: meanings, situations, collections, free tags and arbitrary parent-defined custom facets; character filtering continues to use canonical character IDs.
- Library browsing uses that canonical classification directly: Parent mode has full filters including dynamic custom facets, while the child shelf exposes only compact character/meaning/situation filters plus simple ordering.
- AI providers: optional and replaceable. Manual image mode remains the default; agent-first materialization does not generate images.
- Theme: persistent light/dark UI; print remains light.
- Illustration format: page images and book environment/props references are horizontal 16:9; covers and character identity references are unconstrained.

## Active local private content

Private family story content is intentionally ignored by Git.

Current local content:
- 4 active private books total: 3 illustrated/ready books plus the new 6-page `Эми стрижёт ноготки` book in `prompt_ready` state awaiting its environment reference, scissors photo/reference, cover and page illustrations.
- One reusable private child character has a canonical visual identity + uploaded identity reference. Its narrative description is intentionally generic across books rather than tied to one story goal.
- One additional private routine book was removed from the active library after repeated manual image-moderation failures and is preserved under ignored `content/archive/user-removed-books/`.

## Current authoring/UX behavior

- Parent book detail uses a compact page list: all page rows are visible, but only one selected page expands into the full editor.
- Secondary controls are collapsed by default under `Книга и обложка`, `Иллюстрации и референсы` and `Дополнительные инструменты`.
- Each page can expose a flattened ready-to-copy ChatGPT Image prompt while structured Markdown remains provenance/technical detail.
- Each book can keep one canonical environment/props reference and a generated environment-reference prompt.
- Books can also declare parent-supplied external object references for exact recurring real-world props. Ready-to-copy ChatGPT prompts enumerate canonical character refs, the stored environment ref and these external refs in order, with per-reference usage instructions.
- A whole-book manual image prompt requests separate 16:9 images per page; sensitive workflows may opt into page-by-page-only prompt mode.
- Parent uploads validate actual page/environment aspect ratio before accepting assets.
- Network image generation, when explicitly configured, requests a 16:9 output and remains per-page.
- Parent library filters can be combined across character, meaning, situation, collection, tag and any custom classification dimension. Custom dimensions appear automatically from canonical data rather than requiring UI code changes.
- Child library keeps only character, meaning and situation filters when there are multiple useful choices; both libraries can sort by recent update, creation date or title.
- Child shelf is intentionally compact and library-like: the large `Наши сказки` heading/subtitle are removed, the shelf can use up to a 1600px-wide content area, and book cards flow through an auto-fill grid with a ~220px minimum width instead of being locked to two large columns.
- Reader resume treats the final page as completed reading: reaching the last page clears saved resume progress, so reopening the book starts from page 1 without the “Вы остановились…” prompt. Only unfinished interior pages are resumable.

### Accepted UX improvements — 2026-09-04

- The parent reviewed and accepted the full `ux/14-experience-improvements` branch; it was fast-forward merged into `main`.
- The accepted set includes the original 14 UX improvements plus fullscreen reading and configurable automatic page advance, documented in `docs/UX_REVIEW_14.md`.
- Major accepted changes include: parent book progress/continue CTA, previous/next page workflow, page filters, ordered prompt→generate→upload flow, drag/drop previews, visual Parent book cards, agent-first new-book entry, conversational Helper presentation, simplified character prompt presentation, simplified child shelf, long-book reader progress, local reading resume, a dedicated end-of-book state, fullscreen reading and configurable automatic page advance.
- The end-of-book state reuses the normal navigation row (`Ещё раз · Конец ❤️ · На полку`) instead of adding a taller extra panel, preventing the final-page illustration from shrinking.
- During review, the child-shelf `Для родителей` entry was moved from the page footer into the top header. Reader page progress and the resume-reading banner now use theme tokens instead of translucent light-only backgrounds, so both render correctly in dark mode.
- The reader now has optional fullscreen mode and a slideshow selector with 5/10/15/20-second intervals. Automatic advance resets after each page change, pauses behind the resume-reading decision, stops on the last page, and uses a short fade/slide transition. The slideshow selector/options use theme tokens so the opened menu also follows dark mode.
- The built-in Helper accepts simple natural-language list requests locally. Creative free-text authoring still requires a configured text provider; when absent, the UI now explains that limitation and points to the external agent-first workflow instead of returning a technical error.
- The final accepted review checklist is preserved in `docs/UX_REVIEW_14.md` as product-history/reference documentation.

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
11. **Agent-created books are classified automatically.** When a story is materialized, the agent should infer obvious meanings and situations, keep character filtering on canonical character IDs, use collections only when established, and preserve any parent-defined custom classification dimensions rather than asking for routine manual metadata entry.
12. **Library filters are schema-driven.** Filter options must be derived from canonical `characters` / `classification`, including dynamic custom facets, rather than maintained as a separate hardcoded taxonomy in UI code.
13. **Exact real-world props can be separate external references.** When the parent says they will attach a photo of a recurring object (for example nail scissors), record it as `authoring.externalReferences` instead of hiding it only in page prose. The whole-book/page ChatGPT prompt must enumerate it alongside the normal character/environment references.

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

UX review branch verification on 2026-09-04:
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed: 21 files / 86 tests.
- `npm run build` passed with Next.js 16.3.3.
- `git diff --check` passed.
- Production runtime smoke on port 3010 returned HTTP 200 for the child library, Parent book list, selected Parent book page, Characters, New Book, Helper and reader. Parent screens rendered their new UX markers with the parent cookie.
- After parent review, the final-page reader controls were revised so they reuse the normal navigation row and no longer add vertical height that can shrink the illustration.
- Fullscreen/slideshow reader additions passed `npm run typecheck`, `npm run lint`, reader navigation tests, `npm run build`, and `git diff --check`. Actual fullscreen entry remains a manual browser check because the Fullscreen API requires a user gesture.
- After the parent approved the complete UX package and it was merged into `main`, full post-merge verification passed: `npm run typecheck`, `npm run lint`, `npm test` (21 files / 86 tests), `npm run build`, and `git diff --check`.
- Slideshow dark-menu styling and automatic fade/slide page transition also passed `npm run typecheck`, `npm run lint`, reader navigation tests, `npm run build`, and `git diff --check`.
- Agent-assigned library classification was added to canonical Book v1 / `ApprovedStoryPackage` with backward-compatible empty defaults for existing books. Verification passed: `npm run typecheck`, `npm run lint`, targeted classification/materializer/loader/prompt tests (26/26), full `npm test` (21 files / 87 tests), `npm run build`, and `git diff --check`.
- Library filtering/sorting now consumes canonical classification directly. Parent mode supports character, meaning, situation, collection, tag and dynamic custom facets; child mode keeps compact character/meaning/situation filters. Verification passed: `npm run typecheck`, `npm run lint`, full `npm test` (22 files / 90 tests), `npm run build`, and `git diff --check`. The three current ignored private books were backfilled with classification metadata only; their approved story text and illustrations were not changed.
- Reader completion/resume behavior was tightened so the final page never becomes a resume target; reaching it clears local saved progress. Reader navigation regression coverage now includes unfinished-vs-completed resume eligibility.
- Verification for the resume-completion fix passed: `npm run typecheck`, `npm run lint`, targeted reader navigation tests (4/4), full `npm test` (22 files / 91 tests), `npm run build`, and `git diff --check`.
- On 2026-09-05 the approved 6-page story `Эми стрижёт ноготки` was materialized as `emi-trims-her-nails` using the canonical agent-first workflow. It reuses `emi`, is classified as `habit-routine`, and every page prompt explicitly requires a separate photo/reference of the real child nail scissors in addition to the usual character/environment references, preserving the scissors' shape, color, size, construction and rounded tips. The scissors are always adult-controlled in the scenes. Materialization reported 6/6 prompts and no warnings; binary scissors/environment/cover/page assets remain intentionally pending. Post-materialization verification passed: `npm run typecheck`, `npm run lint`, full `npm test` (22 files / 91 tests), and `git diff --check`.
- Follow-up correction on 2026-09-05: external object references are now first-class optional authoring metadata instead of only continuity prose. `emi-trims-her-nails` declares the parent's nail-scissors photo as `authoring.externalReferences`. The prompt builder enumerates character refs first, the stored environment reference next, then external object refs; therefore once this book's environment reference is uploaded its whole-book prompt explicitly says reference 1 = Emi, reference 2 = canonical environment, reference 3 = the exact nail-scissors photo. Parent UI also lists external refs under `Иллюстрации и референсы`. This remains backward-compatible with older books that have no external refs. Verification passed: `npm run typecheck`, `npm run lint`, full `npm test` (22 files / 91 tests), `npm run build`, and `git diff --check`.

## Git / working state

- Branch: `main`.
- Remote: `origin` → `https://github.com/dmtrml/FaryTale.git`.
- The substantial post-`89d473a` working set has been consolidated: compact book-editor UX, global 16:9 handling, prompt refinements, reusable-character cleanup, routine-pattern inference tests and documentation/state cleanup.
- The verified consolidation is committed locally on `main`.
- `AGENTS.md` now requires Git checkpoints for each coherent verified change and requires push when the configured remote is writable; failures must be recorded here rather than left implicit in chat.
- Push to `origin/main` is working with the current credentials. On 2026-09-05 commit `c5ef08e` was pushed successfully to `https://github.com/dmtrml/FaryTale.git`, so the earlier 403 authentication blocker is resolved.
- The accepted UX work was merged from `ux/14-experience-improvements` into `main` by fast-forward through commit `7b85103`.

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

1. Review the denser child-shelf layout in real use across desktop/tablet widths and adjust only concrete sizing issues that appear.
2. For `emi-trims-her-nails`, create/upload the usual canonical environment reference; when generating the whole series in ChatGPT, attach Emi + that environment reference + the parent's nail-scissors photo as the three references enumerated by the prompt, then generate/upload the six 16:9 page illustrations and cover.
3. Keep new user-defined classification dimensions in `classification.custom`; Parent filters will discover them automatically.
4. Keep future UX work checkpointed as separate coherent commits.
