import { describe, expect, it } from "vitest";
import { ComfyUIImageProvider } from "./comfyui-image-core";

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ComfyUIImageProvider", () => {
  it("uploads supplied references, patches workflow tokens, waits for output and downloads the image", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    let historyCalls = 0;
    const provider = new ComfyUIImageProvider({
      baseUrl: "http://localhost:8188/",
      workflowPath: "ignored.json",
      outputNodeId: "9",
      clientId: "test-client",
      pollIntervalMs: 1,
      timeoutMs: 1000,
      sleepImpl: async () => undefined,
      workflowLoader: async () => ({
        "1": {
          inputs: {
            text: "__FARYTALE_PROMPT__",
            width: "__FARYTALE_WIDTH__",
            height: "__FARYTALE_HEIGHT__",
          },
        },
        "2": { inputs: { image: "__FARYTALE_IMAGE_1__" } },
      }),
      fetchImpl: (async (url, init) => {
        const href = String(url);
        calls.push({ url: href, init });
        if (href.endsWith("/upload/image")) {
          return jsonResponse({ name: "emi.png", subfolder: "farytale", type: "input" });
        }
        if (href.endsWith("/prompt")) {
          return jsonResponse({ prompt_id: "prompt-123" });
        }
        if (href.endsWith("/history/prompt-123")) {
          historyCalls += 1;
          if (historyCalls === 1) return jsonResponse({});
          return jsonResponse({
            "prompt-123": {
              status: { completed: true, status_str: "success" },
              outputs: {
                "9": {
                  images: [{ filename: "result.png", subfolder: "", type: "output" }],
                },
              },
            },
          });
        }
        if (href.includes("/view?")) {
          return new Response(new Uint8Array([1, 2, 3, 4]), {
            status: 200,
            headers: { "Content-Type": "image/png" },
          });
        }
        return new Response(null, { status: 404 });
      }) as typeof fetch,
    });

    const result = await provider.generate({
      prompt: "Keep Emi consistent",
      seed: 123,
      size: { width: 1664, height: 928 },
      references: [
        {
          path: "characters/emi/refs/canonical.png",
          role: "identity",
          mimeType: "image/png",
          bytes: new Uint8Array([8, 9]),
        },
      ],
    });

    const uploadCall = calls.find((call) => call.url.endsWith("/upload/image"));
    expect(uploadCall?.init?.body).toBeInstanceOf(FormData);
    const uploadedFile = (uploadCall?.init?.body as FormData).get("image");
    expect(uploadedFile).toBeInstanceOf(File);
    expect(Array.from(new Uint8Array(await (uploadedFile as File).arrayBuffer()))).toEqual([8, 9]);

    const promptCall = calls.find((call) => call.url.endsWith("/prompt"));
    const submitted = JSON.parse(String(promptCall?.init?.body));
    expect(submitted.client_id).toBe("test-client");
    expect(submitted.prompt["1"].inputs).toEqual({
      text: "Keep Emi consistent",
      width: 1664,
      height: 928,
    });
    expect(submitted.prompt["2"].inputs.image).toBe("farytale/emi.png");
    expect(calls.filter((call) => call.url.endsWith("/history/prompt-123"))).toHaveLength(2);
    expect(calls.some((call) => call.url.includes("filename=result.png"))).toBe(true);
    expect(Array.from(result.bytes)).toEqual([1, 2, 3, 4]);
    expect(result.metadata).toEqual({
      provider: "comfyui",
      model: "qwen-image-2.1",
      requestId: "prompt-123",
      seed: 123,
    });
  });

  it("uses the edit workflow with the source image first and canonical references after it", async () => {
    const uploadedBytes: number[][] = [];
    const loadedPaths: string[] = [];
    let uploadIndex = 0;
    let submittedPrompt:
      | Record<string, { inputs: Record<string, unknown> }>
      | undefined;
    const provider = new ComfyUIImageProvider({
      baseUrl: "http://localhost:8188",
      workflowPath: "generate.json",
      editWorkflowPath: "edit.json",
      outputNodeId: "9",
      sleepImpl: async () => undefined,
      workflowLoader: async (workflowPath) => {
        loadedPaths.push(workflowPath);
        return {
          "1": { inputs: { text: "__FARYTALE_PROMPT__" } },
          "2": { inputs: { image: "__FARYTALE_IMAGE_1__" } },
          "3": { inputs: { image: "__FARYTALE_IMAGE_2__" } },
          "4": {
            inputs: {
              seed: "__FARYTALE_SEED__",
              instruction: "__FARYTALE_EDIT_INSTRUCTION__",
            },
          },
        };
      },
      fetchImpl: (async (url, init) => {
        const href = String(url);
        if (href.endsWith("/upload/image")) {
          uploadIndex += 1;
          const file = (init?.body as FormData).get("image") as File;
          uploadedBytes.push(Array.from(new Uint8Array(await file.arrayBuffer())));
          return jsonResponse({
            name: `input-${uploadIndex}.png`,
            subfolder: "",
            type: "input",
          });
        }
        if (href.endsWith("/prompt")) {
          submittedPrompt = JSON.parse(String(init?.body)).prompt;
          return jsonResponse({ prompt_id: "edit-1" });
        }
        if (href.endsWith("/history/edit-1")) {
          return jsonResponse({
            "edit-1": {
              status: { completed: true, status_str: "success" },
              outputs: {
                "9": {
                  images: [{ filename: "edited.png", subfolder: "", type: "output" }],
                },
              },
            },
          });
        }
        if (href.includes("/view?")) {
          return new Response(new Uint8Array([7, 7]), {
            status: 200,
            headers: { "Content-Type": "image/png" },
          });
        }
        return new Response(null, { status: 404 });
      }) as typeof fetch,
    });

    const result = await provider.generate({
      mode: "edit",
      prompt: "Edit image 1 and keep identity from image 2.",
      editInstruction: "Make the spoon smaller.",
      seed: 77,
      sourceImage: {
        path: "books/sample/pages/001.png",
        mimeType: "image/png",
        bytes: new Uint8Array([1, 2]),
      },
      references: [
        {
          path: "characters/emi/refs/canonical.png",
          mimeType: "image/png",
          bytes: new Uint8Array([3, 4]),
        },
      ],
    });

    expect(loadedPaths).toEqual(["edit.json"]);
    expect(uploadedBytes).toEqual([[1, 2], [3, 4]]);
    expect(submittedPrompt?.["2"].inputs.image).toBe("input-1.png");
    expect(submittedPrompt?.["3"].inputs.image).toBe("input-2.png");
    expect(submittedPrompt?.["4"].inputs).toEqual({
      seed: 77,
      instruction: "Make the spoon smaller.",
    });
    expect(result.metadata.seed).toBe(77);
  });

  it("does not upload references for a prompt-only workflow", async () => {
    const urls: string[] = [];
    const provider = new ComfyUIImageProvider({
      baseUrl: "http://localhost:8188",
      workflowPath: "ignored.json",
      outputNodeId: "3",
      sleepImpl: async () => undefined,
      workflowLoader: async () => ({
        "1": { inputs: { text: "__FARYTALE_PROMPT__" } },
      }),
      fetchImpl: (async (url, init) => {
        const href = String(url);
        urls.push(href);
        if (href.endsWith("/prompt")) return jsonResponse({ prompt_id: "p1" });
        if (href.endsWith("/history/p1")) {
          return jsonResponse({
            p1: {
              status: { completed: true, status_str: "success" },
              outputs: {
                "3": {
                  images: [{ filename: "result.webp", subfolder: "", type: "output" }],
                },
              },
            },
          });
        }
        if (href.includes("/view?")) {
          return new Response(new Uint8Array([5, 6]), {
            status: 200,
            headers: { "Content-Type": "image/webp" },
          });
        }
        void init;
        return new Response(null, { status: 404 });
      }) as typeof fetch,
    });

    const result = await provider.generate({ prompt: "A room" });
    expect(urls.some((url) => url.endsWith("/upload/image"))).toBe(false);
    expect(result.mimeType).toBe("image/webp");
  });

  it("prunes unused image slots and their dynamic image links", async () => {
    let submitted: Record<string, unknown> | undefined;
    const provider = new ComfyUIImageProvider({
      baseUrl: "http://localhost:8188",
      workflowPath: "ignored.json",
      outputNodeId: "9",
      sleepImpl: async () => undefined,
      workflowLoader: async () => ({
        "2": { class_type: "LoadImage", inputs: { image: "__FARYTALE_IMAGE_1__" } },
        "3": { class_type: "LoadImage", inputs: { image: "__FARYTALE_IMAGE_2__" } },
        "4": {
          class_type: "TextEncodeQwenImage21",
          inputs: {
            prompt: "__FARYTALE_PROMPT__",
            "images.image_1": ["2", 0],
            "images.image_2": ["3", 0],
          },
        },
        "9": { class_type: "SaveImage", inputs: { images: ["8", 0] } },
      }),
      fetchImpl: (async (url, init) => {
        const href = String(url);
        if (href.endsWith("/upload/image")) {
          return jsonResponse({ name: "one.png", subfolder: "", type: "input" });
        }
        if (href.endsWith("/prompt")) {
          submitted = JSON.parse(String(init?.body)).prompt;
          return jsonResponse({ prompt_id: "prune-1" });
        }
        if (href.endsWith("/history/prune-1")) {
          return jsonResponse({
            "prune-1": {
              status: { completed: true, status_str: "success" },
              outputs: {
                "9": {
                  images: [{ filename: "result.png", subfolder: "", type: "output" }],
                },
              },
            },
          });
        }
        if (href.includes("/view?")) {
          return new Response(new Uint8Array([1]), {
            status: 200,
            headers: { "Content-Type": "image/png" },
          });
        }
        return new Response(null, { status: 404 });
      }) as typeof fetch,
    });

    await provider.generate({
      prompt: "Используй референс 1 только как внешность.",
      references: [
        {
          path: "one.png",
          mimeType: "image/png",
          bytes: new Uint8Array([1]),
        },
      ],
    });

    expect(submitted?.["3"]).toBeUndefined();
    expect(
      (submitted?.["4"] as { inputs: Record<string, unknown> }).inputs[
        "images.image_2"
      ],
    ).toBeUndefined();
    expect(
      (submitted?.["4"] as { inputs: Record<string, unknown> }).inputs.prompt,
    ).toContain("<image1>");
  });

  it("fails rather than silently ignoring more images than the workflow declares", async () => {
    const provider = new ComfyUIImageProvider({
      baseUrl: "http://localhost:8188",
      workflowPath: "ignored.json",
      workflowLoader: async () => ({
        "2": { inputs: { image: "__FARYTALE_IMAGE_1__" } },
      }),
      fetchImpl: (async () => new Response(null, { status: 500 })) as typeof fetch,
    });

    await expect(
      provider.generate({
        prompt: "scene",
        references: [
          { path: "one.png", mimeType: "image/png", bytes: new Uint8Array([1]) },
          { path: "two.png", mimeType: "image/png", bytes: new Uint8Array([2]) },
        ],
      }),
    ).rejects.toThrow("no slot for submitted image 2");
  });

  it("returns safe HTTP errors without exposing provider response bodies", async () => {
    const provider = new ComfyUIImageProvider({
      baseUrl: "http://localhost:8188",
      workflowPath: "ignored.json",
      workflowLoader: async () => ({
        "1": { inputs: { text: "__FARYTALE_PROMPT__" } },
      }),
      fetchImpl: (async () =>
        new Response("private comfy details", { status: 503 })) as typeof fetch,
    });

    await expect(provider.generate({ prompt: "scene" })).rejects.toThrow("HTTP 503");
  });
});
