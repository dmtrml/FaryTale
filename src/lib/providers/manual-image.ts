import type {
  DeferredImageGenerationResult,
  ImageGenerationRequest,
  ImageProvider,
} from "./contracts";

export class ManualImageProvider implements ImageProvider {
  readonly id = "manual";

  async generate(request: ImageGenerationRequest): Promise<DeferredImageGenerationResult> {
    const prompt = request.prompt.trim();
    if (!prompt) throw new Error("Manual image generation requires a non-empty prompt.");

    return {
      kind: "deferred",
      imageStatus: "prompt_ready",
      prompt,
      metadata: {
        provider: this.id,
      },
    };
  }
}
