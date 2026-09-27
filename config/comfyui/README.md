# ComfyUI workflows for FaryTale

FaryTale can use a local ComfyUI instance as an image provider without making ComfyUI or Qwen a dependency of the reader.

Export the working ComfyUI workflow in **API format**, keep that JSON outside canonical book content, and replace the inputs that FaryTale should control with these exact sentinel values:

- `__FARYTALE_PROMPT__` — page illustration prompt;
- `__FARYTALE_NEGATIVE_PROMPT__` — request-specific negative conditioning;
- `__FARYTALE_WIDTH__` — requested output width;
- `__FARYTALE_HEIGHT__` — requested output height;
- `__FARYTALE_SEED__` — per-request seed;
- `__FARYTALE_STEPS__` — per-request sampling step count;
- `__FARYTALE_EDIT_INSTRUCTION__` — raw parent edit instruction for edit workflows when a node needs it separately;
- `__FARYTALE_IMAGE_1__` … `__FARYTALE_IMAGE_10__` — uploaded reference-image filenames in deterministic FaryTale reference-pack order.

For the edit workflow, image 1 is the current page illustration being edited. Canonical character/environment/object references follow as images 2…10.

Example fragment:

```json
{
  "12": {
    "inputs": {
      "text": "__FARYTALE_PROMPT__"
    },
    "class_type": "CLIPTextEncode"
  },
  "31": {
    "inputs": {
      "image": "__FARYTALE_IMAGE_1__"
    },
    "class_type": "LoadImage"
  }
}
```

Server-only configuration:

```text
FARYTALE_IMAGE_PROVIDER=comfyui
FARYTALE_COMFYUI_BASE_URL=http://localhost:8188
FARYTALE_COMFYUI_GENERATE_WORKFLOW=config/comfyui/qwen-image-2.1-generate.api.json
FARYTALE_COMFYUI_EDIT_WORKFLOW=config/comfyui/qwen-image-2.1-edit.api.json
FARYTALE_COMFYUI_OUTPUT_NODE_ID=<SaveImage node id, optional>
FARYTALE_COMFYUI_MODEL=qwen-image-2.1
```

The provider uploads only the references supplied for the current generation request, submits the patched workflow to `/prompt`, polls `/history/<prompt_id>`, then fetches the selected output with `/view`.

Do not commit private reference images, generated family images, credentials, or machine-specific absolute workflow paths.

## Included Qwen-Image-2.1 workflows

This repository includes two API-format workflows aligned with the Qwen-Image-2.1 native nodes available in ComfyUI 0.37.x:

- `qwen-image-2.1-generate.api.json` — text-to-image plus optional multi-image conditioning. Reference images are fed to `TextEncodeQwenImage21`, while sampling uses a fresh FaryTale 16:9 latent so a character reference does not become the composition canvas.
- `qwen-image-2.1-edit.api.json` — image edit. Image 1 is the current page illustration and its Qwen latent becomes the edit canvas; images 2…10 are canonical references.

The checked-in workflows use the local model filenames currently tested for FaryTale:

- `qwen_image_2.1_int8_convrot.safetensors`
- `qwen3vl_8b_w4a8.safetensors`
- `qwen_image_2.1_vae_bf16.safetensors`

### Checked-in Qwen defaults

The included workflows intentionally use a local-performance preset rather than Qwen's
maximum/native 2K output size:

- `TextEncodeQwenImage21.resolution`: `1024` for both generation and editing;
- sampling steps: `25` by default from FaryTale through `__FARYTALE_STEPS__`;
- CFG: `1`;
- sampler: `euler`;
- scheduler: `simple`;
- denoise: `1`;
- seed: random per request unless a concrete seed is supplied;
- canonical character reference output: `1024×1024`;
- canonical environment reference output: `1024×576`;
- ordinary page generation output: `1920×1080` (16:9);
- edit output size follows the edit workflow's source-image latent; the request size is
  kept for provider-contract consistency but the checked-in edit workflow uses image 1
  as the latent canvas.

Qwen-specific operational instructions are English-first. Canonical family/story source
fields may remain in Russian and are embedded as semantic source data so FaryTale does
not need a second translation/rewriting model at runtime.

The checked-in workflows no longer leave `negative_prompt` empty. FaryTale supplies a
conservative children's-book negative preset for text/artifact/anatomy/clutter issues.
Canonical child identity generation additionally suppresses sad/gloomy/crying/fearful
portrait drift. Story-page negative conditioning deliberately does **not** ban sadness
or fear globally because a story may intentionally depict those emotions.

If you prefer your own ComfyUI settings, export that workflow in API format, keep the
sentinels you want FaryTale to control, and point
`FARYTALE_COMFYUI_GENERATE_WORKFLOW` / `FARYTALE_COMFYUI_EDIT_WORKFLOW` at the
custom files. Values that are not represented by sentinels remain owned by that workflow.

If another machine uses different Qwen weight filenames, copy these workflow files locally and point the environment variables at the machine-specific copies rather than changing canonical book data.
