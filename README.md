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

## Local Qwen-Image-2.1 through ComfyUI

The preferred local/private illustration provider is ComfyUI. FaryTale talks directly to
ComfyUI's local HTTP API; MCP/connectors are development tools and are not a runtime
dependency.

The repository includes tested Qwen-Image-2.1 API workflows:

- `config/comfyui/qwen-image-2.1-generate.api.json` — fresh 16:9 generation with 0–10 optional canonical reference images;
- `config/comfyui/qwen-image-2.1-edit.api.json` — text-guided editing where image 1 is the current page and the remaining slots are canonical references.

Configure `.env.local`:

```text
FARYTALE_IMAGE_PROVIDER=comfyui
FARYTALE_COMFYUI_BASE_URL=http://127.0.0.1:8188
FARYTALE_COMFYUI_GENERATE_WORKFLOW=config/comfyui/qwen-image-2.1-generate.api.json
FARYTALE_COMFYUI_EDIT_WORKFLOW=config/comfyui/qwen-image-2.1-edit.api.json
FARYTALE_COMFYUI_OUTPUT_NODE_ID=9
FARYTALE_COMFYUI_MODEL=qwen-image-2.1
FARYTALE_COMFYUI_TIMEOUT_MS=300000
```

Start the local ComfyUI server before using Generate/Edit. The reader and all manual
authoring remain usable when ComfyUI is stopped.

The checked-in workflows currently target these tested local weight filenames:

```text
diffusion_models/qwen_image_2.1_int8_convrot.safetensors
text_encoders/qwen3vl_8b_w4a8.safetensors
vae/qwen_image_2.1_vae_bf16.safetensors
```

Parent generation automatically assembles available references in stable order:
page characters → book environment → additional book references → declared external
objects. Qwen requests are capped at 10 images. For Edit, the current page consumes
image slot 1, leaving up to nine canonical reference slots.

To enable one-page image generation through the OpenAI Image API instead:

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

For manual illustration generation, a book can keep one canonical environment/props
reference in addition to reusable character identity references. Parent mode exposes
one dedicated prompt for generating that environment/props reference,
one flattened ready-to-copy prompt for the selected page and one whole-book ChatGPT
Image prompt that asks for separate images for every page; structured Markdown prompt
sections remain available only as technical/provenance details.

Declared exact object references such as a spoon, plate, chair or nail scissors can also
store their real private image files in the book. When a provider is configured, those
assets are attached automatically to the current page request. Regeneration archives the
previous image, Parent mode exposes archived variants for restore, and an edit-capable
provider adds a text field for targeted revision of the current illustration.

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
