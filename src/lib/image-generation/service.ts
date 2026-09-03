import { promises as fs } from "node:fs";
import path from "node:path";
import { isSafeContentPath, loadLibrary } from "../content/loader";
import {
  appendBookPageGenerationProvenance,
  getCanonicalBook,
  readBookPagePrompt,
  replaceBookPageImage,
  setBookPageImageStatus,
} from "../content/mutations";
import type { ImageProvider, ImageReference } from "../providers/contracts";
import { selectCanonicalIdentityReference } from "../characters/identity";
import type { Book } from "../content/schemas";

const mimeByExtension: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

type GeneratePageOptions = {
  bookId: string;
  pageNumber: number;
  provider: ImageProvider;
  contentRoot?: string;
  now?: string;
};

function contentRootPath(customRoot?: string) {
  return customRoot
    ? path.resolve(/* turbopackIgnore: true */ customRoot)
    : path.join(process.cwd(), "content");
}

async function archiveCurrentPageImage({
  contentRoot,
  bookId,
  pageNumber,
  currentImage,
  now,
}: {
  contentRoot: string;
  bookId: string;
  pageNumber: number;
  currentImage?: string;
  now?: string;
}) {
  if (!currentImage || !isSafeContentPath(currentImage)) return null;
  const extension = path.extname(currentImage).toLowerCase();
  if (!mimeByExtension[extension]) return null;
  const source = path.join(contentRoot, "books", bookId, ...currentImage.split("/"));
  const stamp = (now ?? new Date().toISOString()).replace(/[:.]/g, "-");
  const relativePath = `pages/history/${String(pageNumber).padStart(3, "0")}-${stamp}${extension}`;
  const destination = path.join(contentRoot, "books", bookId, ...relativePath.split("/"));
  try {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(source, destination);
    return relativePath;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function listBookPageImageHistory({
  bookId,
  pageNumber,
  contentRoot: customRoot,
}: {
  bookId: string;
  pageNumber: number;
  contentRoot?: string;
}) {
  const contentRoot = contentRootPath(customRoot);
  const book = await getCanonicalBook(bookId, contentRoot);
  if (!book || !book.pages.some((page) => page.number === pageNumber)) return [];
  const historyRoot = path.join(contentRoot, "books", bookId, "pages", "history");
  try {
    const names = await fs.readdir(historyRoot);
    const prefix = `${String(pageNumber).padStart(3, "0")}-`;
    return names
      .filter((name) => name.startsWith(prefix) && mimeByExtension[path.extname(name).toLowerCase()])
      .sort()
      .reverse()
      .map((name) => `pages/history/${name}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function loadPageReferences(
  contentRoot: string,
  book: Book,
  characterIds: string[],
): Promise<ImageReference[]> {
  const library = await loadLibrary({ contentRoot });
  const references: ImageReference[] = [];

  for (const characterId of characterIds) {
    const character = library.characters.find((item) => item.id === characterId);
    if (!character) continue;
    const selected = selectCanonicalIdentityReference(character);
    if (!selected || !isSafeContentPath(selected.path)) continue;

    const mimeType = mimeByExtension[path.extname(selected.path).toLowerCase()];
    if (!mimeType) continue;
    const absolutePath = path.join(
      contentRoot,
      "characters",
      character.id,
      ...selected.path.split("/"),
    );
    try {
      const bytes = new Uint8Array(await fs.readFile(absolutePath));
      references.push({
        path: `characters/${character.id}/${selected.path}`,
        role: selected.role,
        mimeType,
        bytes,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  const environmentReference = book.references.find((reference) => reference.role === "environment");
  if (environmentReference && isSafeContentPath(environmentReference.path)) {
    const mimeType = mimeByExtension[path.extname(environmentReference.path).toLowerCase()];
    if (mimeType) {
      const absolutePath = path.join(
        contentRoot,
        "books",
        book.id,
        ...environmentReference.path.split("/"),
      );
      try {
        const bytes = new Uint8Array(await fs.readFile(absolutePath));
        references.push({
          path: `books/${book.id}/${environmentReference.path}`,
          role: "environment",
          mimeType,
          bytes,
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  }
  return references;
}

export async function generateBookPageImage(options: GeneratePageOptions) {
  const contentRoot = contentRootPath(options.contentRoot);
  const book = await getCanonicalBook(options.bookId, contentRoot);
  if (!book) throw new Error("Book not found or invalid.");
  const page = book.pages.find((item) => item.number === options.pageNumber);
  if (!page) throw new Error("Page not found.");
  const prompt = await readBookPagePrompt({
    bookId: options.bookId,
    pageNumber: options.pageNumber,
    contentRoot,
  });
  if (!prompt?.trim()) throw new Error("Page prompt is required before image generation.");

  const references = await loadPageReferences(contentRoot, book, page.characters);
  await setBookPageImageStatus({
    bookId: options.bookId,
    pageNumber: options.pageNumber,
    imageStatus: "generating",
    contentRoot,
  });

  try {
    const result = await options.provider.generate({
      prompt,
      references,
      size: { width: 1024, height: 1024 },
    });

    if (result.kind === "deferred") {
      await setBookPageImageStatus({
        bookId: options.bookId,
        pageNumber: options.pageNumber,
        imageStatus: "prompt_ready",
        contentRoot,
      });
      await appendBookPageGenerationProvenance({
        bookId: options.bookId,
        pageNumber: options.pageNumber,
        status: "prompt_ready",
        provider: result.metadata.provider,
        model: result.metadata.model,
        requestId: result.metadata.requestId,
        referencePaths: references.map((item) => item.path),
        generatedAt: options.now,
        contentRoot,
      });
      return { result, referencePaths: references.map((item) => item.path) };
    }

    const previousImagePath = await archiveCurrentPageImage({
      contentRoot,
      bookId: options.bookId,
      pageNumber: options.pageNumber,
      currentImage: page.image,
      now: options.now,
    });
    const saved = await replaceBookPageImage({
      bookId: options.bookId,
      pageNumber: options.pageNumber,
      bytes: result.bytes,
      mimeType: result.mimeType,
      contentRoot,
    });
    await appendBookPageGenerationProvenance({
      bookId: options.bookId,
      pageNumber: options.pageNumber,
      status: "ready",
      provider: result.metadata.provider,
      model: result.metadata.model,
      requestId: result.metadata.requestId,
      referencePaths: references.map((item) => item.path),
      previousImagePath: previousImagePath ?? undefined,
      generatedAt: options.now,
      contentRoot,
    });
    return {
      result,
      relativePath: saved.relativePath,
      referencePaths: references.map((item) => item.path),
    };
  } catch (error) {
    await setBookPageImageStatus({
      bookId: options.bookId,
      pageNumber: options.pageNumber,
      imageStatus: "failed",
      contentRoot,
    });
    await appendBookPageGenerationProvenance({
      bookId: options.bookId,
      pageNumber: options.pageNumber,
      status: "failed",
      provider: options.provider.id,
      referencePaths: references.map((item) => item.path),
      note: error instanceof Error ? error.message : "Image generation failed.",
      generatedAt: options.now,
      contentRoot,
    });
    throw error;
  }
}
