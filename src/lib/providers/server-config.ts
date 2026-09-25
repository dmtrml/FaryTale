import "server-only";
import { z } from "zod";
import { createDefaultProviderRegistry } from "./registry";
import { OpenAICompatibleTextProvider } from "./openai-compatible-core";
import { OpenAIImageProvider } from "./openai-image-core";
import { ComfyUIImageProvider } from "./comfyui-image-core";

const providerEnvironmentSchema = z.object({
  FARYTALE_IMAGE_PROVIDER: z.enum(["manual", "openai-image", "comfyui"]).default("manual"),
  FARYTALE_IMAGE_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  FARYTALE_IMAGE_MODEL: z.string().trim().default("gpt-image-2"),
  FARYTALE_IMAGE_API_KEY: z.string().trim().optional(),
  FARYTALE_COMFYUI_BASE_URL: z.string().url().default("http://localhost:8188"),
  FARYTALE_COMFYUI_GENERATE_WORKFLOW: z.string().trim().min(1).optional(),
  FARYTALE_COMFYUI_EDIT_WORKFLOW: z.string().trim().min(1).optional(),
  FARYTALE_COMFYUI_OUTPUT_NODE_ID: z.string().trim().min(1).optional(),
  FARYTALE_COMFYUI_MODEL: z.string().trim().default("qwen-image-2.1"),
  FARYTALE_COMFYUI_POLL_INTERVAL_MS: z.coerce.number().int().min(50).max(10000).default(750),
  FARYTALE_COMFYUI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(1800000).default(300000),
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
    FARYTALE_COMFYUI_BASE_URL: process.env.FARYTALE_COMFYUI_BASE_URL,
    FARYTALE_COMFYUI_GENERATE_WORKFLOW: process.env.FARYTALE_COMFYUI_GENERATE_WORKFLOW,
    FARYTALE_COMFYUI_EDIT_WORKFLOW: process.env.FARYTALE_COMFYUI_EDIT_WORKFLOW,
    FARYTALE_COMFYUI_OUTPUT_NODE_ID: process.env.FARYTALE_COMFYUI_OUTPUT_NODE_ID,
    FARYTALE_COMFYUI_MODEL: process.env.FARYTALE_COMFYUI_MODEL,
    FARYTALE_COMFYUI_POLL_INTERVAL_MS: process.env.FARYTALE_COMFYUI_POLL_INTERVAL_MS,
    FARYTALE_COMFYUI_TIMEOUT_MS: process.env.FARYTALE_COMFYUI_TIMEOUT_MS,
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
  if (config.FARYTALE_IMAGE_PROVIDER === "comfyui") {
    if (!config.FARYTALE_COMFYUI_GENERATE_WORKFLOW) {
      throw new Error("Configured ComfyUI provider is missing a generate workflow path.");
    }
    return new ComfyUIImageProvider({
      baseUrl: config.FARYTALE_COMFYUI_BASE_URL,
      workflowPath: config.FARYTALE_COMFYUI_GENERATE_WORKFLOW,
      editWorkflowPath: config.FARYTALE_COMFYUI_EDIT_WORKFLOW,
      outputNodeId: config.FARYTALE_COMFYUI_OUTPUT_NODE_ID,
      model: config.FARYTALE_COMFYUI_MODEL,
      pollIntervalMs: config.FARYTALE_COMFYUI_POLL_INTERVAL_MS,
      timeoutMs: config.FARYTALE_COMFYUI_TIMEOUT_MS,
    });
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
