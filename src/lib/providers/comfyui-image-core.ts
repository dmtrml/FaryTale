import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type {
  GeneratedImageResult,
  ImageGenerationRequest,
  ImageProvider,
  ImageReference,
} from "./contracts";

type FetchLike = typeof fetch;
type Workflow = Record<string, unknown>;

export type ComfyUIImageProviderOptions = {
  baseUrl: string;
  workflowPath: string;
  editWorkflowPath?: string;
  outputNodeId?: string;
  model?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  sleepImpl?: (milliseconds: number) => Promise<void>;
  workflowLoader?: (workflowPath: string) => Promise<Workflow>;
  clientId?: string;
};

const uploadResponseSchema = z.object({
  name: z.string().min(1),
  subfolder: z.string().optional().default(""),
  type: z.string().optional().default("input"),
});

const promptResponseSchema = z.object({
  prompt_id: z.string().min(1),
});

type ComfyImageDescriptor = {
  filename: string;
  subfolder: string;
  type: string;
};

function defaultSleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function defaultWorkflowLoader(workflowPath: string): Promise<Workflow> {
  const absolute = path.isAbsolute(workflowPath)
    ? workflowPath
    : path.join(/* turbopackIgnore: true */ process.cwd(), workflowPath);
  return JSON.parse(await fs.readFile(absolute, "utf8")) as Workflow;
}

function copyBytes(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

function uploadedImageName(value: z.infer<typeof uploadResponseSchema>) {
  return value.subfolder ? `${value.subfolder}/${value.name}` : value.name;
}

function mimeTypeFromFilename(filename: string, response: Response) {
  const header = response.headers.get("content-type")?.split(";")[0]?.trim();
  if (header?.startsWith("image/")) return header;
  switch (path.extname(filename).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".avif":
      return "image/avif";
    default:
      return "image/png";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function imageDescriptor(value: unknown): ComfyImageDescriptor | null {
  const record = asRecord(value);
  if (!record || typeof record.filename !== "string" || !record.filename) return null;
  return {
    filename: record.filename,
    subfolder: typeof record.subfolder === "string" ? record.subfolder : "",
    type: typeof record.type === "string" ? record.type : "output",
  };
}

function findOutputImage(
  history: unknown,
  promptId: string,
  outputNodeId?: string,
): { image?: ComfyImageDescriptor; completed: boolean; failed: boolean } {
  const root = asRecord(history);
  const entry = asRecord(root?.[promptId]);
  if (!entry) return { completed: false, failed: false };

  const status = asRecord(entry.status);
  const completed = status?.completed === true;
  const failed = status?.status_str === "error";
  const outputs = asRecord(entry.outputs);
  if (!outputs) return { completed, failed };

  const candidateOutputs = outputNodeId
    ? [outputs[outputNodeId]]
    : Object.values(outputs);

  for (const candidate of candidateOutputs) {
    const output = asRecord(candidate);
    const images = Array.isArray(output?.images) ? output.images : [];
    for (const value of images) {
      const image = imageDescriptor(value);
      if (image) return { image, completed, failed };
    }
  }
  return { completed, failed };
}

function replaceWorkflowTokens(
  value: unknown,
  replacements: {
    prompt: string;
    width: number;
    height: number;
    seed: number;
    editInstruction?: string;
    uploadedImages: string[];
  },
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => replaceWorkflowTokens(item, replacements));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        replaceWorkflowTokens(item, replacements),
      ]),
    );
  }
  if (typeof value !== "string") return value;
  if (value === "__FARYTALE_PROMPT__") return replacements.prompt;
  if (value === "__FARYTALE_WIDTH__") return replacements.width;
  if (value === "__FARYTALE_HEIGHT__") return replacements.height;
  if (value === "__FARYTALE_SEED__") return replacements.seed;
  if (value === "__FARYTALE_EDIT_INSTRUCTION__") {
    return replacements.editInstruction ?? "";
  }
  const imageMatch = value.match(/^__FARYTALE_IMAGE_(\d+)__$/);
  if (imageMatch) {
    const index = Number.parseInt(imageMatch[1]!, 10) - 1;
    const uploaded = replacements.uploadedImages[index];
    if (!uploaded) {
      throw new Error(
        `ComfyUI workflow requires reference image ${index + 1}, but the request did not provide it.`,
      );
    }
    return uploaded;
  }
  return value;
}

function requiredWorkflowImageSlots(value: unknown, slots = new Set<number>()) {
  if (Array.isArray(value)) {
    for (const item of value) requiredWorkflowImageSlots(item, slots);
    return slots;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) requiredWorkflowImageSlots(item, slots);
    return slots;
  }
  if (typeof value !== "string") return slots;
  const match = value.match(/^__FARYTALE_IMAGE_(\d+)__$/);
  if (match) slots.add(Number.parseInt(match[1]!, 10));
  return slots;
}

export class ComfyUIImageProvider implements ImageProvider {
  readonly id = "comfyui";
  private readonly baseUrl: string;
  private readonly workflowPath: string;
  private readonly editWorkflowPath?: string;
  private readonly outputNodeId?: string;
  private readonly model: string;
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;
  private readonly sleepImpl: (milliseconds: number) => Promise<void>;
  private readonly workflowLoader: (workflowPath: string) => Promise<Workflow>;
  private readonly clientId: string;

  constructor(options: ComfyUIImageProviderOptions) {
    if (!options.baseUrl.trim()) throw new Error("ComfyUI base URL is required.");
    if (!options.workflowPath.trim()) throw new Error("ComfyUI workflow path is required.");
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.workflowPath = options.workflowPath;
    this.editWorkflowPath = options.editWorkflowPath?.trim() || undefined;
    this.outputNodeId = options.outputNodeId?.trim() || undefined;
    this.model = options.model?.trim() || "qwen-image-2.1";
    this.pollIntervalMs = options.pollIntervalMs ?? 750;
    this.timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleepImpl = options.sleepImpl ?? defaultSleep;
    this.workflowLoader = options.workflowLoader ?? defaultWorkflowLoader;
    this.clientId = options.clientId?.trim() || "farytale";
  }

  async generate(request: ImageGenerationRequest): Promise<GeneratedImageResult> {
    const prompt = request.prompt.trim();
    if (!prompt) throw new Error("Image generation requires a non-empty prompt.");
    const mode = request.mode ?? "generate";
    if (mode === "edit" && !request.sourceImage) {
      throw new Error("ComfyUI edit requires a source image.");
    }
    const workflowPath =
      mode === "edit"
        ? this.editWorkflowPath ?? ""
        : this.workflowPath;
    if (!workflowPath) {
      throw new Error("ComfyUI edit workflow path is required for image editing.");
    }
    const inputImages = [
      ...(request.sourceImage ? [request.sourceImage] : []),
      ...(request.references ?? []),
    ];
    const workflow = await this.workflowLoader(workflowPath);
    const requiredSlots = requiredWorkflowImageSlots(workflow);
    for (const slot of requiredSlots) {
      if (!inputImages[slot - 1]) {
        throw new Error(
          `ComfyUI workflow requires reference image ${slot}, but the request did not provide it.`,
        );
      }
    }
    const uploadedImages: string[] = [];
    for (const reference of inputImages) {
      uploadedImages.push(await this.uploadReference(reference));
    }

    const size = request.size ?? { width: 1920, height: 1080 };
    const seed = request.seed ?? Math.floor(Math.random() * 2_147_483_647);
    const patchedWorkflow = replaceWorkflowTokens(workflow, {
      prompt,
      width: size.width,
      height: size.height,
      seed,
      editInstruction: request.editInstruction?.trim() || undefined,
      uploadedImages,
    });

    const submitResponse = await this.fetchImpl(`${this.baseUrl}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: patchedWorkflow,
        client_id: this.clientId,
      }),
    });
    if (!submitResponse.ok) {
      throw new Error(`ComfyUI prompt submission failed with HTTP ${submitResponse.status}.`);
    }
    const { prompt_id: promptId } = promptResponseSchema.parse(await submitResponse.json());
    const output = await this.waitForOutput(promptId);
    const query = new URLSearchParams({
      filename: output.filename,
      subfolder: output.subfolder,
      type: output.type,
    });
    const imageResponse = await this.fetchImpl(`${this.baseUrl}/view?${query.toString()}`);
    if (!imageResponse.ok) {
      throw new Error(`ComfyUI image download failed with HTTP ${imageResponse.status}.`);
    }
    const bytes = new Uint8Array(await imageResponse.arrayBuffer());
    if (!bytes.byteLength) throw new Error("ComfyUI returned an empty image.");

    return {
      kind: "generated",
      imageStatus: "ready",
      bytes,
      mimeType: mimeTypeFromFilename(output.filename, imageResponse),
      metadata: {
        provider: this.id,
        model: this.model,
        requestId: promptId,
        seed,
      },
    };
  }

  private async uploadReference(reference: ImageReference) {
    if (!reference.bytes?.byteLength || !reference.mimeType) {
      throw new Error(`Reference image ${reference.path} has no loaded bytes/mime type.`);
    }
    const filename = path.basename(reference.path) || "reference.png";
    const form = new FormData();
    const bytes = copyBytes(reference.bytes);
    form.set(
      "image",
      new Blob([bytes.buffer], { type: reference.mimeType }),
      filename,
    );
    form.set("type", "input");
    form.set("overwrite", "true");
    const response = await this.fetchImpl(`${this.baseUrl}/upload/image`, {
      method: "POST",
      body: form,
    });
    if (!response.ok) {
      throw new Error(`ComfyUI reference upload failed with HTTP ${response.status}.`);
    }
    return uploadedImageName(uploadResponseSchema.parse(await response.json()));
  }

  private async waitForOutput(promptId: string) {
    const startedAt = Date.now();
    while (Date.now() - startedAt <= this.timeoutMs) {
      const response = await this.fetchImpl(
        `${this.baseUrl}/history/${encodeURIComponent(promptId)}`,
      );
      if (!response.ok) {
        throw new Error(`ComfyUI history request failed with HTTP ${response.status}.`);
      }
      const state = findOutputImage(
        await response.json(),
        promptId,
        this.outputNodeId,
      );
      if (state.image) return state.image;
      if (state.failed) throw new Error("ComfyUI generation failed.");
      if (state.completed) {
        throw new Error("ComfyUI completed without an image output.");
      }
      await this.sleepImpl(this.pollIntervalMs);
    }
    throw new Error("ComfyUI generation timed out.");
  }
}
