import { describe, expect, it } from "vitest";
import type {
  ImageGenerationRequest,
  ImageProvider,
  TextGenerationRequest,
  TextProvider,
} from "./contracts";
import { ManualImageProvider } from "./manual-image";
import { ProviderRegistry, createDefaultProviderRegistry } from "./registry";

class FakeTextProvider implements TextProvider {
  readonly id = "fake-text";

  async generate(request: TextGenerationRequest) {
    return {
      text: `fake:${request.prompt}`,
      structured: { ok: true },
      metadata: { provider: this.id },
    };
  }
}

class FakeImageProvider implements ImageProvider {
  readonly id = "fake-image";

  async generate(request: ImageGenerationRequest) {
    void request;
    return {
      kind: "generated" as const,
      imageStatus: "ready" as const,
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "image/webp",
      metadata: { provider: this.id, model: "fake-v1" },
    };
  }
}

describe("ManualImageProvider", () => {
  it("returns prompt_ready without credentials or network output", async () => {
    const result = await new ManualImageProvider().generate({
      prompt: "  Draw Miau washing paws.  ",
      references: [{ path: "characters/miau/refs/canonical.webp" }],
    });

    expect(result).toEqual({
      kind: "deferred",
      imageStatus: "prompt_ready",
      prompt: "Draw Miau washing paws.",
      metadata: { provider: "manual" },
    });
    expect("bytes" in result).toBe(false);
  });

  it("rejects an empty prompt", async () => {
    await expect(new ManualImageProvider().generate({ prompt: "   " })).rejects.toThrow(
      "non-empty prompt",
    );
  });
});

describe("ProviderRegistry", () => {
  it("ships manual image mode as the default image provider", () => {
    expect(createDefaultProviderRegistry().createImage("manual")).toBeInstanceOf(
      ManualImageProvider,
    );
  });

  it("can swap text and image implementations behind stable contracts", async () => {
    const registry = new ProviderRegistry()
      .registerText("fake-text", () => new FakeTextProvider())
      .registerImage("fake-image", () => new FakeImageProvider());

    const text = await registry.createText("fake-text").generate({
      purpose: "story",
      prompt: "hello",
    });
    const image = await registry.createImage("fake-image").generate({ prompt: "scene" });

    expect(text.structured).toEqual({ ok: true });
    expect(text.metadata.provider).toBe("fake-text");
    expect(image.kind).toBe("generated");
    expect(image.metadata.provider).toBe("fake-image");
  });
});
