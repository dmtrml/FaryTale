export type ProviderMetadata = {
  provider: string;
  model?: string;
  requestId?: string;
};

export type TextGenerationPurpose =
  | "story"
  | "story_revision"
  | "page_revision"
  | "illustration_prompt";

export type TextGenerationRequest = {
  purpose: TextGenerationPurpose;
  prompt: string;
  system?: string;
  responseSchema?: {
    name: string;
    jsonSchema: Record<string, unknown>;
  };
};

export type TextGenerationResult = {
  text: string;
  structured?: unknown;
  metadata: ProviderMetadata;
};

export interface TextProvider {
  readonly id: string;
  generate(request: TextGenerationRequest): Promise<TextGenerationResult>;
}

export type ImageReference = {
  path: string;
  role?: string;
  mimeType?: string;
  bytes?: Uint8Array;
};

export type ImageGenerationRequest = {
  prompt: string;
  references?: ImageReference[];
  size?: {
    width: number;
    height: number;
  };
};

export type DeferredImageGenerationResult = {
  kind: "deferred";
  imageStatus: "prompt_ready";
  prompt: string;
  metadata: ProviderMetadata;
};

export type GeneratedImageResult = {
  kind: "generated";
  imageStatus: "ready";
  bytes: Uint8Array;
  mimeType: string;
  metadata: ProviderMetadata;
};

export type ImageGenerationResult = DeferredImageGenerationResult | GeneratedImageResult;

export interface ImageProvider {
  readonly id: string;
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}
