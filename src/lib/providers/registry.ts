import type { ImageProvider, TextProvider } from "./contracts";
import { ManualImageProvider } from "./manual-image";

type ImageProviderFactory = () => ImageProvider;
type TextProviderFactory = () => TextProvider;

export class ProviderRegistry {
  private readonly imageFactories = new Map<string, ImageProviderFactory>();
  private readonly textFactories = new Map<string, TextProviderFactory>();

  registerImage(id: string, factory: ImageProviderFactory) {
    this.imageFactories.set(id, factory);
    return this;
  }

  registerText(id: string, factory: TextProviderFactory) {
    this.textFactories.set(id, factory);
    return this;
  }

  createImage(id: string) {
    const factory = this.imageFactories.get(id);
    if (!factory) throw new Error(`Unknown image provider: ${id}`);
    return factory();
  }

  createText(id: string) {
    const factory = this.textFactories.get(id);
    if (!factory) throw new Error(`Unknown text provider: ${id}`);
    return factory();
  }
}

export function createDefaultProviderRegistry() {
  return new ProviderRegistry().registerImage("manual", () => new ManualImageProvider());
}
