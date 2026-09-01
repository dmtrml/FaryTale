# FaryTale

FaryTale is a lightweight family storybook library and reader with optional parent-only authoring tools.

See [`docs/MVP.md`](docs/MVP.md) for the implemented MVP flows, backup/restore, offline behavior, provider setup and security/privacy boundaries.
See [`docs/AGENT_AUTHORING.md`](docs/AGENT_AUTHORING.md) for the primary agent-first workflow: approve a story in chat, then let the agent save the whole book plus one prompt per scene without manual form entry.

Start here:
1. Read `AGENTS.md`.
2. Read `PROJECT-STATE.md`.
3. Read `docs/PRODUCT_SPEC.md`.
4. Read `docs/IMPLEMENTATION_PLAN.md`.
5. When creating or editing stories, read `skills/childrens-story-creator/SKILL.md`.

The project is intentionally split into:
- a lightweight child/reader experience,
- a parent authoring mode,
- an AI layer that is optional and replaceable,
- file-based story and character content that stays portable.

The AI layer must never be required just to open and read existing books.

## Development

Requirements:
- Node.js 22+
- npm 10+

Install and run:

```bash
npm install
npm run dev
```

Verification:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Optional text provider

The reader, manual story workflow, and slash-command Studio work with no AI credentials.

To enable the optional OpenAI-compatible Studio intent interpreter (for example through OpenRouter), configure server environment variables only:

```text
FARYTALE_TEXT_PROVIDER=openai-compatible
FARYTALE_TEXT_BASE_URL=https://openrouter.ai/api/v1
FARYTALE_TEXT_MODEL=<provider/model>
FARYTALE_TEXT_API_KEY=<secret>
```

`OPENROUTER_API_KEY` is also accepted as a server-only fallback for `FARYTALE_TEXT_API_KEY`. Never expose these values through `NEXT_PUBLIC_*` variables.

To enable one-page image generation through the OpenAI Image API:

```text
FARYTALE_IMAGE_PROVIDER=openai-image
FARYTALE_IMAGE_BASE_URL=https://api.openai.com/v1
FARYTALE_IMAGE_MODEL=gpt-image-2
FARYTALE_IMAGE_API_KEY=<secret>
```

`OPENAI_API_KEY` is accepted as a server-only fallback. `manual` remains the default image provider; no image API call is made unless the parent explicitly triggers generation for one page.

Canonical content lives under:

```text
content/books/<book-id>/
content/characters/<character-id>/
```

Parent mode also provides browser Print/Save-as-PDF and a self-contained ZIP export/import flow so a complete book can be archived independently of the running app.

## Agent-first approved story

The recommended creation path is not manual form entry. An external agent can turn an approved story into an `ApprovedStoryPackage` and materialize the whole book in one operation. With a local server running:

```bash
npm run agent:materialize -- .scratch/farytale-agent/<book-id>.json
```

This creates canonical characters/pages and a prompt for every scene, validates the result, and leaves images for manual generation/upload (`prompt_ready`).

Parent mode includes a persistent light/dark appearance toggle. Until a choice is saved, FaryTale follows the operating-system color preference; reader mode uses the same local preference while print/PDF remains light.

The Parent editor supports long books (up to 200 pages): metadata editing, direct page navigation,
page insertion/duplication/deletion/reordering, page character assignment, and full canonical
character/reference-image management are available without hand-editing JSON.
