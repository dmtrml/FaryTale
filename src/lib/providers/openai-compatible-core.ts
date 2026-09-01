import { z } from "zod";
import type {
  TextGenerationRequest,
  TextGenerationResult,
  TextProvider,
} from "./contracts";

type FetchLike = typeof fetch;

export type OpenAICompatibleTextProviderOptions = {
  apiKey: string;
  baseUrl: string;
  model: string;
  providerId?: string;
  fetchImpl?: FetchLike;
  maxAttempts?: number;
  extraHeaders?: Record<string, string>;
};

const responseSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string().nullable(),
      }),
    }),
  ).min(1),
});

function endpoint(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

function retryableStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

export class OpenAICompatibleTextProvider implements TextProvider {
  readonly id: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchImpl: FetchLike;
  private readonly maxAttempts: number;
  private readonly extraHeaders: Record<string, string>;

  constructor(options: OpenAICompatibleTextProviderOptions) {
    if (!options.apiKey.trim()) throw new Error("Text provider API key is required.");
    if (!options.model.trim()) throw new Error("Text provider model is required.");
    this.id = options.providerId ?? "openai-compatible";
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl;
    this.model = options.model;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? 2, 3));
    this.extraHeaders = options.extraHeaders ?? {};
  }

  async generate(request: TextGenerationRequest): Promise<TextGenerationResult> {
    const messages = [
      ...(request.system ? [{ role: "system", content: request.system }] : []),
      { role: "user", content: request.prompt },
    ];
    const body = {
      model: this.model,
      messages,
      stream: false,
      ...(request.responseSchema
        ? {
            response_format: {
              type: "json_schema",
              json_schema: {
                name: request.responseSchema.name,
                strict: true,
                schema: request.responseSchema.jsonSchema,
              },
            },
          }
        : {}),
    };

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const response = await this.fetchImpl(endpoint(this.baseUrl), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            ...this.extraHeaders,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const error = new Error(`Text provider request failed with HTTP ${response.status}.`);
          if (attempt < this.maxAttempts && retryableStatus(response.status)) {
            lastError = error;
            continue;
          }
          throw error;
        }

        const parsed = responseSchema.parse(await response.json());
        const text = parsed.choices[0]?.message.content?.trim();
        if (!text) throw new Error("Text provider returned an empty response.");

        let structured: unknown;
        if (request.responseSchema) {
          try {
            structured = JSON.parse(text);
          } catch {
            // Validation/repair is intentionally handled at the application boundary.
          }
        }

        return {
          text,
          ...(structured !== undefined ? { structured } : {}),
          metadata: {
            provider: this.id,
            model: parsed.model ?? this.model,
            ...(parsed.id ? { requestId: parsed.id } : {}),
          },
        };
      } catch (error) {
        const safeError = error instanceof Error ? error : new Error("Text provider request failed.");
        lastError = safeError;
        if (attempt >= this.maxAttempts) throw safeError;
      }
    }

    throw lastError ?? new Error("Text provider request failed.");
  }
}
