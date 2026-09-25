# ComfyUI workflows for FaryTale

FaryTale can use a local ComfyUI instance as an image provider without making ComfyUI or Qwen a dependency of the reader.

Export the working ComfyUI workflow in **API format**, keep that JSON outside canonical book content, and replace the inputs that FaryTale should control with these exact sentinel values:

- `__FARYTALE_PROMPT__` — page illustration prompt;
- `__FARYTALE_WIDTH__` — requested output width;
- `__FARYTALE_HEIGHT__` — requested output height;
- `__FARYTALE_SEED__` — per-request seed;
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
