import { z } from "zod";
import type {
  GeneratedImageResult,
  ImageGenerationRequest,
  ImageProvider,
} from "./contracts";

type FetchLike = typeof fetch;

export type OpenAIImageProviderOptions = {
  apiKey: string;
  baseUrl: string;
  model?: string;
  fetchImpl?: FetchLike;
  quality?: "low" | "medium" | "high" | "auto";
};

const responseSchema = z.object({
  data: z.array(z.object({ b64_json: z.string().min(1) })).min(1),
});

function imageSize(request: ImageGenerationRequest) {
  return request.size ? `${request.size.width}x${request.size.height}` : "1024x1024";
}

export class OpenAIImageProvider implements ImageProvider {
  readonly id = "openai-image";
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchImpl: FetchLike;
  private readonly quality: "low" | "medium" | "high" | "auto";

  constructor(options: OpenAIImageProviderOptions) {
    if (!options.apiKey.trim()) throw new Error("Image provider API key is required.");
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.model = options.model?.trim() || "gpt-image-2";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.quality = options.quality ?? "medium";
  }

  async generate(request: ImageGenerationRequest): Promise<GeneratedImageResult> {
    const prompt = request.prompt.trim();
    if (!prompt) throw new Error("Image generation requires a non-empty prompt.");
    const references = request.references ?? [];
    const response = references.length
      ? await this.editWithReferences(prompt, references, imageSize(request))
      : await this.generateFromPrompt(prompt, imageSize(request));

    if (!response.ok) {
      throw new Error(`Image provider request failed with HTTP ${response.status}.`);
    }

    const parsed = responseSchema.parse(await response.json());
    const encoded = parsed.data[0]?.b64_json;
    if (!encoded) throw new Error("Image provider returned no image data.");

    return {
      kind: "generated",
      imageStatus: "ready",
      bytes: Uint8Array.from(Buffer.from(encoded, "base64")),
      mimeType: "image/png",
      metadata: {
        provider: this.id,
        model: this.model,
        ...(response.headers.get("x-request-id")
          ? { requestId: response.headers.get("x-request-id") ?? undefined }
          : {}),
      },
    };
  }

  private generateFromPrompt(prompt: string, size: string) {
    return this.fetchImpl(`${this.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        prompt,
        size,
        quality: this.quality,
      }),
    });
  }

  private editWithReferences(
    prompt: string,
    references: NonNullable<ImageGenerationRequest["references"]>,
    size: string,
  ) {
    const form = new FormData();
    form.set("model", this.model);
    form.set("prompt", prompt);
    form.set("size", size);
    form.set("quality", this.quality);
    for (const [index, reference] of references.entries()) {
      if (!reference.bytes?.byteLength || !reference.mimeType) {
        throw new Error(`Reference image ${reference.path} has no loaded bytes/mime type.`);
      }
      const blobBytes = new Uint8Array(reference.bytes.byteLength);
      blobBytes.set(reference.bytes);
      form.append(
        "image[]",
        new Blob([blobBytes.buffer], { type: reference.mimeType }),
        reference.path.split("/").at(-1) || `reference-${index + 1}.png`,
      );
    }
    return this.fetchImpl(`${this.baseUrl}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });
  }
}
