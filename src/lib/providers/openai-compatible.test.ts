import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { TextGenerationRequest, TextProvider } from "./contracts";
import { OpenAICompatibleTextProvider } from "./openai-compatible-core";
import { generateValidatedStructured } from "./structured";

describe("OpenAICompatibleTextProvider", () => {
  it("sends OpenAI-compatible chat-completions with JSON schema and parses content", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const provider = new OpenAICompatibleTextProvider({
      apiKey: "secret-test-key",
      baseUrl: "https://example.test/v1/",
      model: "example/model",
      fetchImpl: (async (url, init) => {
        capturedUrl = String(url);
        capturedInit = init;
        return new Response(
          JSON.stringify({
            id: "req-1",
            model: "example/model",
            choices: [{ message: { content: '{"intent":"list_books"}' } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as typeof fetch,
    });

    const result = await provider.generate({
      purpose: "story",
      system: "Return JSON.",
      prompt: "List books",
      responseSchema: {
        name: "intent",
        jsonSchema: { type: "object", properties: { intent: { type: "string" } } },
      },
    });

    expect(capturedUrl).toBe("https://example.test/v1/chat/completions");
    expect((capturedInit?.headers as Record<string, string>).Authorization).toBe(
      "Bearer secret-test-key",
    );
    const body = JSON.parse(String(capturedInit?.body));
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: {
        name: "intent",
        strict: true,
        schema: { type: "object", properties: { intent: { type: "string" } } },
      },
    });
    expect(result.structured).toEqual({ intent: "list_books" });
    expect(result.metadata.requestId).toBe("req-1");
  });

  it("retries retryable HTTP errors but reports only safe status information", async () => {
    let calls = 0;
    const provider = new OpenAICompatibleTextProvider({
      apiKey: "secret",
      baseUrl: "https://example.test/v1",
      model: "model",
      maxAttempts: 2,
      fetchImpl: (async () => {
        calls += 1;
        return new Response("provider secret body", { status: 503 });
      }) as typeof fetch,
    });

    await expect(provider.generate({ purpose: "story", prompt: "hello" })).rejects.toThrow(
      "HTTP 503",
    );
    expect(calls).toBe(2);
  });
});

describe("generateValidatedStructured", () => {
  it("repairs invalid structured output with a bounded retry", async () => {
    let calls = 0;
    const fake: TextProvider = {
      id: "fake",
      async generate(request: TextGenerationRequest) {
        void request;
        calls += 1;
        return calls === 1
          ? { text: '{"page":0}', structured: { page: 0 }, metadata: { provider: "fake" } }
          : { text: '{"page":2}', structured: { page: 2 }, metadata: { provider: "fake" } };
      },
    };

    const value = await generateValidatedStructured(
      fake,
      { purpose: "story", prompt: "Choose a page" },
      "page_choice",
      z.object({ page: z.number().int().positive() }),
      2,
    );
    expect(value).toEqual({ page: 2 });
    expect(calls).toBe(2);
  });
});
