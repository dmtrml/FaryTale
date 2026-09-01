import { z } from "zod";
import type { TextGenerationRequest, TextProvider } from "./contracts";

export async function generateValidatedStructured<T>(
  provider: TextProvider,
  request: Omit<TextGenerationRequest, "responseSchema">,
  schemaName: string,
  schema: z.ZodType<T>,
  maxAttempts = 2,
): Promise<T> {
  const attempts = Math.max(1, Math.min(maxAttempts, 3));
  let prompt = request.prompt;
  let lastIssue = "invalid structured response";

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await provider.generate({
      ...request,
      prompt,
      responseSchema: {
        name: schemaName,
        jsonSchema: z.toJSONSchema(schema) as Record<string, unknown>,
      },
    });

    let candidate = result.structured;
    if (candidate === undefined) {
      try {
        candidate = JSON.parse(result.text);
      } catch {
        lastIssue = "response was not valid JSON";
      }
    }

    const parsed = schema.safeParse(candidate);
    if (parsed.success) return parsed.data;
    lastIssue = parsed.error.issues.map((issue) => issue.message).join("; ");

    prompt = `${request.prompt}\n\nThe previous response was invalid (${lastIssue}). Return only data that strictly matches the requested JSON schema.`;
  }

  throw new Error(`Model output failed validation after ${attempts} attempt(s): ${lastIssue}`);
}
