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
import type { Book, BookPage, Character } from "../content/schemas";
import { composeChatPagePrompt } from "../story/chat-image-prompt";
import {
  assertQwenReferenceLimit,
  buildReferencePackPlan,
  type AvailableReferencePackItem,
} from "./reference-pack";

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

type EditPageOptions = GeneratePageOptions & {
  instruction: string;
  seed?: number;
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

export async function restoreBookPageImageVersion({
  bookId,
  pageNumber,
  historyPath,
  contentRoot: customRoot,
  now,
}: {
  bookId: string;
  pageNumber: number;
  historyPath: string;
  contentRoot?: string;
  now?: string;
}) {
  const contentRoot = contentRootPath(customRoot);
  const book = await getCanonicalBook(bookId, contentRoot);
  const page = book?.pages.find((item) => item.number === pageNumber);
  if (!book || !page) throw new Error("Page not found.");
  if (
    !isSafeContentPath(historyPath) ||
    !new RegExp(
      `^pages/history/${String(pageNumber).padStart(3, "0")}-[^/]+\\.(?:avif|gif|jpe?g|png|webp)$`,
      "i",
    ).test(historyPath)
  ) {
    throw new Error("Invalid page-image history path.");
  }
  const extension = path.extname(historyPath).toLowerCase();
  const mimeType = mimeByExtension[extension];
  if (!mimeType) throw new Error("Unsupported history image type.");
  const source = path.join(contentRoot, "books", bookId, ...historyPath.split("/"));
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await fs.readFile(source));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("History image not found.");
    }
    throw error;
  }

  const archivedCurrentPath = await archiveCurrentPageImage({
    contentRoot,
    bookId,
    pageNumber,
    currentImage: page.image,
    now,
  });
  const restored = await replaceBookPageImage({
    bookId,
    pageNumber,
    bytes,
    mimeType,
    contentRoot,
  });
  if (page.prompt) {
    await appendBookPageGenerationProvenance({
      bookId,
      pageNumber,
      status: "ready",
      provider: "history-restore",
      previousImagePath: archivedCurrentPath ?? undefined,
      note: `restored_from: ${historyPath}`,
      generatedAt: now,
      contentRoot,
    });
  }
  return {
    relativePath: restored.relativePath,
    restoredFrom: historyPath,
    archivedCurrentPath,
  };
}

async function loadPageReferences(
  contentRoot: string,
  items: AvailableReferencePackItem[],
): Promise<ImageReference[]> {
  const references: ImageReference[] = [];

  for (const item of items) {
    if (!isSafeContentPath(item.storage.relativePath)) continue;
    const mimeType = mimeByExtension[path.extname(item.storage.relativePath).toLowerCase()];
    if (!mimeType) continue;
    const absolutePath =
      item.storage.scope === "character"
        ? path.join(
            contentRoot,
            "characters",
            item.storage.ownerId,
            ...item.storage.relativePath.split("/"),
          )
        : path.join(
            contentRoot,
            "books",
            item.storage.ownerId,
            ...item.storage.relativePath.split("/"),
          );
    try {
      const bytes = new Uint8Array(await fs.readFile(absolutePath));
      references.push({
        path: item.storage.providerPath,
        role: item.kind === "external" ? `external:${item.id}` : item.role,
        mimeType,
        bytes,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return references;
}

async function loadCurrentPageImageReference(
  contentRoot: string,
  book: Book,
  page: BookPage,
): Promise<ImageReference> {
  if (!page.image || !isSafeContentPath(page.image)) {
    throw new Error("A current page illustration is required before editing.");
  }
  const mimeType = mimeByExtension[path.extname(page.image).toLowerCase()];
  if (!mimeType) throw new Error("Unsupported current page image type.");
  const absolutePath = path.join(
    contentRoot,
    "books",
    book.id,
    ...page.image.split("/"),
  );
  try {
    return {
      path: `books/${book.id}/${page.image}`,
      role: "edit-source",
      mimeType,
      bytes: new Uint8Array(await fs.readFile(absolutePath)),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("Current page illustration file is missing.");
    }
    throw error;
  }
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

  const library = await loadLibrary({ contentRoot });
  const pageCharacters = page.characters
    .map((characterId) => library.characters.find((item) => item.id === characterId))
    .filter((character): character is Character => Boolean(character));
  const referenceItems = assertQwenReferenceLimit(
    buildReferencePackPlan({ book, characters: pageCharacters }),
  );
  const references = await loadPageReferences(contentRoot, referenceItems);
  const providerPrompt = composeChatPagePrompt({
    book,
    page,
    rawPrompt: prompt,
    characters: pageCharacters,
    referenceItems,
  });
  await setBookPageImageStatus({
    bookId: options.bookId,
    pageNumber: options.pageNumber,
    imageStatus: "generating",
    contentRoot,
  });

  try {
    const result = await options.provider.generate({
      prompt: providerPrompt,
      references,
      size: { width: 1920, height: 1080 },
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
        seed: result.metadata.seed,
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
      seed: result.metadata.seed,
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

export async function editBookPageImage(options: EditPageOptions) {
  const instruction = options.instruction.trim();
  if (!instruction) throw new Error("Image edit instruction is required.");
  if (instruction.length > 2000) throw new Error("Image edit instruction is too long.");

  const contentRoot = contentRootPath(options.contentRoot);
  const book = await getCanonicalBook(options.bookId, contentRoot);
  if (!book) throw new Error("Book not found or invalid.");
  const page = book.pages.find((item) => item.number === options.pageNumber);
  if (!page) throw new Error("Page not found.");
  const rawPrompt = await readBookPagePrompt({
    bookId: options.bookId,
    pageNumber: options.pageNumber,
    contentRoot,
  });
  if (!rawPrompt?.trim()) throw new Error("Page prompt is required before image editing.");

  const library = await loadLibrary({ contentRoot });
  const pageCharacters = page.characters
    .map((characterId) => library.characters.find((item) => item.id === characterId))
    .filter((character): character is Character => Boolean(character));
  const referenceItems = assertQwenReferenceLimit(
    buildReferencePackPlan({ book, characters: pageCharacters }),
    1,
  );
  const references = await loadPageReferences(contentRoot, referenceItems);
  const sourceImage = await loadCurrentPageImageReference(contentRoot, book, page);
  const continuityPrompt = composeChatPagePrompt({
    book,
    page,
    rawPrompt,
    characters: pageCharacters,
    referenceItems,
    referencePrefix: [
      {
        label: `текущая иллюстрация страницы ${page.number}, которую нужно редактировать`,
        instruction:
          "Это основа правки. Сохраняй всё, что пользователь прямо не просит изменить.",
      },
    ],
  });
  const providerPrompt = [
    "Отредактируй референс 1, а не создавай произвольную новую сцену.",
    `Требуемая правка: ${instruction}`,
    "Сохрани композицию, персонажей, окружение, стиль и все детали, которые не относятся к запрошенной правке.",
    continuityPrompt,
  ].join(" ");

  await setBookPageImageStatus({
    bookId: options.bookId,
    pageNumber: options.pageNumber,
    imageStatus: "generating",
    contentRoot,
  });

  try {
    const result = await options.provider.generate({
      mode: "edit",
      prompt: providerPrompt,
      sourceImage,
      references,
      editInstruction: instruction,
      ...(options.seed !== undefined ? { seed: options.seed } : {}),
      size: { width: 1920, height: 1080 },
    });

    if (result.kind === "deferred") {
      await setBookPageImageStatus({
        bookId: options.bookId,
        pageNumber: options.pageNumber,
        imageStatus: "ready",
        contentRoot,
      });
      return {
        result,
        referencePaths: [sourceImage.path, ...references.map((item) => item.path)],
      };
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
      seed: result.metadata.seed,
      referencePaths: [sourceImage.path, ...references.map((item) => item.path)],
      previousImagePath: previousImagePath ?? undefined,
      note: `edit_instruction: ${instruction}`,
      generatedAt: options.now,
      contentRoot,
    });
    return {
      result,
      relativePath: saved.relativePath,
      referencePaths: [sourceImage.path, ...references.map((item) => item.path)],
    };
  } catch (error) {
    await setBookPageImageStatus({
      bookId: options.bookId,
      pageNumber: options.pageNumber,
      imageStatus: "ready",
      contentRoot,
    });
    await appendBookPageGenerationProvenance({
      bookId: options.bookId,
      pageNumber: options.pageNumber,
      status: "failed",
      provider: options.provider.id,
      referencePaths: [sourceImage.path, ...references.map((item) => item.path)],
      note: `edit_failed: ${error instanceof Error ? error.message : "Image edit failed."}`,
      generatedAt: options.now,
      contentRoot,
    });
    throw error;
  }
}
