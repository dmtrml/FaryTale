# AGENTS.md — FaryTale

## Mission

Build FaryTale as a lightweight, reliable children's storybook library and reader with an optional parent-only AI authoring studio.

The application is first a **reader and library**. AI is a creation tool layered on top, not a runtime dependency for reading.

## Source of truth

Read these files in order before making architectural changes:

1. `AGENTS.md`
2. `docs/PRODUCT_SPEC.md`
3. `docs/BOOK_FORMAT.md`
4. `docs/IMPLEMENTATION_PLAN.md`
5. Relevant files under `skills/`

If implementation and documentation disagree, update both in the same change. Do not silently let them diverge.

## Persistent project state

`PROJECT-STATE.md` is the mandatory handoff file between agents and sessions.

Every agent must read `PROJECT-STATE.md` immediately after `AGENTS.md` and before starting implementation work.

The agent must update `PROJECT-STATE.md`:

1. after completing each implementation phase;
2. after any material architecture decision;
3. after discovering a blocker or external dependency;
4. before ending a work session;
5. before handing the project to another agent.

The state file must always contain:
- current phase;
- completed work;
- verification/tests that actually passed;
- known issues or blockers;
- important decisions and assumptions;
- files or areas currently being modified;
- the exact next recommended action.

Do not write vague statements such as "continue development". The next action must be concrete enough that a new agent can immediately execute it without asking the user what happened previously.

Do not mark work as completed unless it was actually implemented and verified. Do not delete useful historical decisions; condense older entries when needed.

Keep `PROJECT-STATE.md` compact enough for a new agent to understand the current project quickly. Move verbose completed-phase/session chronology to `docs/PROJECT_HISTORY.md` instead of letting the handoff file grow indefinitely.

Before starting new work, reconcile `PROJECT-STATE.md` with `docs/IMPLEMENTATION_PLAN.md`. If they disagree, inspect the repository and correct both documents to reflect reality.

## Autonomous working rule

Do not ask the user what to do next when the next step is derivable from the specification.

Work phase by phase. At the end of each phase:

1. run the relevant checks/tests/build;
2. fix regressions;
3. update `docs/IMPLEMENTATION_PLAN.md` status;
4. update `PROJECT-STATE.md` with what was actually completed, verification results, decisions, blockers, and the exact next action;
5. record any important architecture decision in the nearest relevant documentation;
6. continue to the next incomplete phase automatically.

Ask the user only when blocked by something that cannot safely be inferred, for example:
- an unavailable credential or external account that is strictly required to continue;
- a destructive action affecting user data outside the repository;
- a legal/commercial choice that materially changes product ownership or cost and has no safe default.

For normal design decisions, choose the simplest reversible option that preserves the product specification.

## Engineering principles

- Prefer boring, maintainable code over clever abstractions.
- Keep the reader fast and usable offline.
- Do not make reading depend on an AI API, database, login, or internet connection.
- Keep book content portable and human-readable.
- Preserve prompts and generation metadata alongside generated assets.
- AI providers must be replaceable behind interfaces.
- Never commit API keys or credentials.
- Treat child/family photos as sensitive private data.
- Minimize dependencies.
- Do not add a large backend until a concrete requirement needs one.
- Avoid premature subscription/payment/account systems.
- The MVP should be useful with zero AI providers configured.

## Default technical direction

Unless the repository already has a clearly better established stack, use:

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- a minimal PWA/offline layer
- local file-based content for books and characters
- server routes only for functionality that needs secrets or filesystem/provider access
- schema validation with Zod

Do not replace an existing healthy stack only to match this default.

## Product modes

### Child / Reader mode

This is the default experience.

Must be:
- visually calm;
- touch-friendly;
- full-screen friendly;
- free of AI controls;
- free of technical metadata;
- usable offline for already-installed books.

Primary flow:

`Library -> Open book -> Swipe/tap pages -> Close book`

### Parent mode

Parent-only controls for:
- viewing book details;
- creating/editing a book;
- replacing illustrations;
- reviewing prompts;
- managing characters;
- export;
- AI Studio/chat.

Do not expose destructive or AI-generation controls in child mode.

## Content-first architecture

Books live under:

`content/books/<book-id>/`

Characters live under:

`content/characters/<character-id>/`

The app must be able to rebuild its library index from these files.

Do not make a database the only copy of book content.

## AI architecture

AI is optional.

Implement provider abstractions, not hardcoded vendor logic.

Text providers may include:
- OpenRouter
- OpenAI-compatible endpoint
- direct provider adapters later

Image providers may include:
- OpenAI image generation
- Gemini image generation
- other providers later
- `manual`, which creates/saves prompts without generating an image

Do not make Codex CLI a runtime dependency of the app.

Codex/other coding agents may operate on the project folder using the same book format and story skill, which is a separate authoring path.

## AI Studio

The long-term parent AI Studio is conversational but tool-driven.

The chat should be able to invoke project actions such as:

- list books
- inspect a book
- create a story outline
- create/update a book
- update one page
- generate/revise an illustration prompt
- generate/retry one illustration
- add/update a character
- export a book

The agent must always modify canonical project data rather than keeping important state only in chat history.

## Agent-first approved-story authoring

The user's primary authoring workflow is agent-first. Parent web forms are a fallback/inspection surface, not the expected way to populate technical metadata.

When the user says an equivalent of:

- “занеси эту сказку в FaryTale”;
- “сохрани утверждённый сценарий в проект”;
- “добавь эту книгу в Fairy/FaryTale”;

and the approved story/scenario is available in the conversation/context, the agent should **materialize it autonomously**.

Required behavior:

1. Read the children's-story skill before materializing child-facing content.
2. Treat the user's approved page text/story as source-of-truth. Do not silently rewrite approved text during saving.
3. Infer implementation metadata such as canonical id, language, age band, story pattern, goal slug, lifecycle state and page-character membership when safely derivable.
   For clearly recognizable everyday routines, set the matching story pattern explicitly in the approved package rather than relying on ambiguous wording in automatic inference.
4. Reuse existing canonical recurring characters. Do not recreate or redesign an existing character such as `miau`.
5. Create complete textual canonical definitions for genuinely new characters when enough information is available; if no binary reference image exists, save the character anyway and report that reference art is pending.
6. Create the full page set in one approved-story materialization workflow rather than asking the user to add pages or tick checkboxes manually.
7. Save one final illustration prompt for **every page/scene**, using canonical identity, continuity and any available character reference paths.
8. In the current workflow, **do not generate images automatically**. Leave pages `prompt_ready` and let the user generate images in chat and upload them manually.
9. Validate the resulting canonical book and prompts and report a concise result: book id/title, page count, prompt count, characters, status and unresolved warnings.
10. Ask the user only for genuinely non-inferable creative decisions or missing source material, not for internal technical fields.

Use the versioned approved-story package/materializer documented in `docs/AGENT_AUTHORING.md` when available. External coding agents should prefer that high-level workflow over hand-editing dozens of canonical files independently.

## Story creation rules

Before creating or editing child-facing story content, read:

`skills/childrens-story-creator/SKILL.md`

Follow its age, pedagogy, visual consistency, and safety rules.

## Testing expectations

At minimum maintain:

- schema/unit tests for book parsing;
- tests for library indexing;
- tests for page ordering and missing assets;
- tests for parent/child mode access boundaries where practical;
- build/typecheck/lint;
- basic reader interaction tests;
- provider adapters tested with mocks, not live paid APIs by default.

## Security

- No secret keys in client bundles.
- No secret keys in repository content.
- Do not upload child/family images to third parties unless the parent explicitly triggers a generation action that requires it.
- Send only the reference images needed for the current page.
- Do not log raw private images or provider authorization headers.
- Keep manual/offline mode fully functional.

## Scope discipline

Do not build these before the core reader and file format are stable:

- subscriptions;
- payments;
- social network;
- public marketplace;
- complex analytics;
- multi-tenant SaaS admin;
- native mobile apps;
- video generation.

These can be added later without blocking the core product.

## Session completion rule

Never end a development session with repository state documented only in chat.

### Git checkpoint rule

- After finishing a coherent logical change and passing the relevant verification, create a Git commit with a concise message that describes that change.
- Do not accumulate multiple unrelated completed changes into one large uncommitted working tree when they could be safely checkpointed separately.
- If a Git remote is configured and the current credentials have permission, push the verified commit before ending the session.
- Never commit secrets, credentials, ignored private family content, or other files intentionally excluded by `.gitignore`.
- If commit or push cannot be completed, do not hide the failure: record the exact reason and the current Git state in `PROJECT-STATE.md`, and leave the normal next command needed to finish it.

Before stopping:
- make the working tree internally coherent;
- run the strongest relevant verification available;
- commit the completed logical change;
- push it when a configured remote is writable with the current credentials;
- update `PROJECT-STATE.md`;
- update implementation-plan checkboxes that are genuinely complete;
- leave the exact next executable step in `PROJECT-STATE.md`.

A future agent must be able to resume from repository files alone, without access to the previous chat.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
