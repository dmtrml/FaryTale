import { describe, expect, it } from "vitest";
import { OpenAIImageProvider } from "./openai-image-core";

function imageResponse(requestId = "image-request") {
  return new Response(
    JSON.stringify({ data: [{ b64_json: Buffer.from([1, 2, 3, 4]).toString("base64") }] }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", "x-request-id": requestId },
    },
  );
}

describe("OpenAIImageProvider", () => {
  it("uses images/generations for prompt-only requests", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const provider = new OpenAIImageProvider({
      apiKey: "test-secret",
      baseUrl: "https://api.example.test/v1/",
      model: "gpt-image-2",
      fetchImpl: (async (url, init) => {
        capturedUrl = String(url);
        capturedInit = init;
        return imageResponse();
      }) as typeof fetch,
    });

    const result = await provider.generate({ prompt: "A simple kitten", size: { width: 1024, height: 1024 } });

    expect(capturedUrl).toBe("https://api.example.test/v1/images/generations");
    expect((capturedInit?.headers as Record<string, string>).Authorization).toBe("Bearer test-secret");
    expect(JSON.parse(String(capturedInit?.body))).toMatchObject({
      model: "gpt-image-2",
      prompt: "A simple kitten",
      size: "1024x1024",
      quality: "medium",
    });
    expect(Array.from(result.bytes)).toEqual([1, 2, 3, 4]);
    expect(result.metadata.requestId).toBe("image-request");
  });

  it("uses multipart images/edits and only supplied reference bytes", async () => {
    let capturedUrl = "";
    let capturedForm: FormData | undefined;
    const provider = new OpenAIImageProvider({
      apiKey: "test-secret",
      baseUrl: "https://api.example.test/v1",
      fetchImpl: (async (url, init) => {
        capturedUrl = String(url);
        capturedForm = init?.body as FormData;
        return imageResponse();
      }) as typeof fetch,
    });

    await provider.generate({
      prompt: "Keep the same kitten identity",
      references: [
        {
          path: "characters/miau/refs/canonical.png",
          role: "identity",
          mimeType: "image/png",
          bytes: new Uint8Array([8, 9]),
        },
      ],
    });

    expect(capturedUrl).toBe("https://api.example.test/v1/images/edits");
    expect(capturedForm?.get("model")).toBe("gpt-image-2");
    expect(capturedForm?.get("prompt")).toBe("Keep the same kitten identity");
    const images = capturedForm?.getAll("image[]") ?? [];
    expect(images).toHaveLength(1);
    expect(images[0]).toBeInstanceOf(File);
    expect((images[0] as File).type).toBe("image/png");
    expect(Array.from(new Uint8Array(await (images[0] as File).arrayBuffer()))).toEqual([8, 9]);
  });

  it("returns a safe status-only provider error", async () => {
    const provider = new OpenAIImageProvider({
      apiKey: "test-secret",
      baseUrl: "https://api.example.test/v1",
      fetchImpl: (async () => new Response("private provider details", { status: 429 })) as typeof fetch,
    });

    await expect(provider.generate({ prompt: "kitten" })).rejects.toThrow("HTTP 429");
  });
});
