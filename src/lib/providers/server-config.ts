import "server-only";
import { z } from "zod";
import { createDefaultProviderRegistry } from "./registry";
import { OpenAICompatibleTextProvider } from "./openai-compatible-core";
import { OpenAIImageProvider } from "./openai-image-core";

const providerEnvironmentSchema = z.object({
  FARYTALE_IMAGE_PROVIDER: z.enum(["manual", "openai-image"]).default("manual"),
  FARYTALE_IMAGE_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  FARYTALE_IMAGE_MODEL: z.string().trim().default("gpt-image-2"),
  FARYTALE_IMAGE_API_KEY: z.string().trim().optional(),
  OPENAI_API_KEY: z.string().trim().optional(),
  FARYTALE_TEXT_PROVIDER: z.enum(["disabled", "openai-compatible"]).default("disabled"),
  FARYTALE_TEXT_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  FARYTALE_TEXT_MODEL: z.string().trim().optional(),
  FARYTALE_TEXT_API_KEY: z.string().trim().optional(),
  OPENROUTER_API_KEY: z.string().trim().optional(),
});

export type ServerProviderConfig = z.infer<typeof providerEnvironmentSchema>;

export function getServerProviderConfig(): ServerProviderConfig {
  return providerEnvironmentSchema.parse({
    FARYTALE_IMAGE_PROVIDER: process.env.FARYTALE_IMAGE_PROVIDER,
    FARYTALE_IMAGE_BASE_URL: process.env.FARYTALE_IMAGE_BASE_URL,
    FARYTALE_IMAGE_MODEL: process.env.FARYTALE_IMAGE_MODEL,
    FARYTALE_IMAGE_API_KEY: process.env.FARYTALE_IMAGE_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    FARYTALE_TEXT_PROVIDER: process.env.FARYTALE_TEXT_PROVIDER,
    FARYTALE_TEXT_BASE_URL: process.env.FARYTALE_TEXT_BASE_URL,
    FARYTALE_TEXT_MODEL: process.env.FARYTALE_TEXT_MODEL,
    FARYTALE_TEXT_API_KEY: process.env.FARYTALE_TEXT_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  });
}

export function getConfiguredImageProvider() {
  const config = getServerProviderConfig();
  if (config.FARYTALE_IMAGE_PROVIDER === "manual") {
    return createDefaultProviderRegistry().createImage("manual");
  }
  const apiKey = config.FARYTALE_IMAGE_API_KEY ?? config.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Configured image provider is missing an API key.");
  return new OpenAIImageProvider({
    apiKey,
    baseUrl: config.FARYTALE_IMAGE_BASE_URL,
    model: config.FARYTALE_IMAGE_MODEL,
  });
}

export function getConfiguredTextProvider() {
  const config = getServerProviderConfig();
  if (config.FARYTALE_TEXT_PROVIDER === "disabled") return null;

  const apiKey = config.FARYTALE_TEXT_API_KEY ?? config.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Configured text provider is missing an API key.");
  if (!config.FARYTALE_TEXT_MODEL) throw new Error("Configured text provider is missing a model.");

  return new OpenAICompatibleTextProvider({
    apiKey,
    baseUrl: config.FARYTALE_TEXT_BASE_URL,
    model: config.FARYTALE_TEXT_MODEL,
    extraHeaders: config.FARYTALE_TEXT_BASE_URL.includes("openrouter.ai")
      ? { "X-Title": "FaryTale" }
      : undefined,
  });
}
