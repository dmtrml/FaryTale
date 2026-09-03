import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { bookSchema, imageStatusSchema, type Book } from "./schemas";
import { isSafeContentPath, loadLibrary } from "./loader";
import { inspectImage } from "../images/inspect";
import { MAX_BOOK_PAGES } from "./authoring";

const bookIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const imageTypes = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

const mimeTypesByExtension = Object.fromEntries(
  Object.entries(imageTypes).map(([mimeType, extension]) => [`.${extension}`, mimeType]),
) as Record<string, string>;

type ImageMimeType = keyof typeof imageTypes;

export const MAX_PAGE_IMAGE_BYTES = 5 * 1024 * 1024;

type MutationOptions = {
  contentRoot?: string;
  today?: string;
};

function resolveContentRoot(contentRoot?: string) {
  return contentRoot
    ? path.resolve(/* turbopackIgnore: true */ contentRoot)
    : path.join(process.cwd(), "content");
}

function todayValue(value?: string) {
  return value ?? new Date().toISOString().slice(0, 10);
}

function assertBookId(bookId: string) {
  if (!bookIdPattern.test(bookId)) {
    throw new Error("Invalid book id.");
  }
}

function getBookFile(contentRoot: string, bookId: string) {
  assertBookId(bookId);
  return path.join(contentRoot, "books", bookId, "book.json");
}

async function readCanonicalBook(contentRoot: string, bookId: string) {
  const filePath = getBookFile(contentRoot, bookId);
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = bookSchema.parse(JSON.parse(raw));

  if (parsed.id !== bookId) {
    throw new Error("Book id does not match its folder.");
  }

  for (let index = 0; index < parsed.pages.length; index += 1) {
    if (parsed.pages[index]?.number !== index + 1) {
      throw new Error("Book pages are not ordered consecutively.");
    }
  }

  return { book: parsed, filePath };
}

async function writeCanonicalBook(filePath: string, book: Book) {
  const validated = bookSchema.parse(book);
  await fs.writeFile(filePath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  return validated;
}

export async function setBookPageImageStatus({
  bookId,
  pageNumber,
  imageStatus,
  ...options
}: MutationOptions & {
  bookId: string;
  pageNumber: number;
  imageStatus: string;
}) {
  const contentRoot = resolveContentRoot(options.contentRoot);
  const { book, filePath } = await readCanonicalBook(contentRoot, bookId);
  const page = book.pages.find((item) => item.number === pageNumber);
  if (!page) throw new Error("Page not found.");
  page.imageStatus = imageStatusSchema.parse(imageStatus);
  book.updatedAt = todayValue(options.today);
  return writeCanonicalBook(filePath, book);
}

export async function updateBookPageText({
  bookId,
  pageNumber,
  text,
  ...options
}: MutationOptions & {
  bookId: string;
  pageNumber: number;
  text: string;
}) {
  const contentRoot = resolveContentRoot(options.contentRoot);
  const { book, filePath } = await readCanonicalBook(contentRoot, bookId);
  const page = book.pages.find((item) => item.number === pageNumber);

  if (!page) {
    throw new Error("Page not found.");
  }

  if (text.length > 2000) {
    throw new Error("Page text is too long.");
  }

  page.text = text.trim();
  book.updatedAt = todayValue(options.today);
  return writeCanonicalBook(filePath, book);
}

export async function replaceBookPageImage({
  bookId,
  pageNumber,
  bytes,
  mimeType,
  ...options
}: MutationOptions & {
  bookId: string;
  pageNumber: number;
  bytes: Uint8Array;
  mimeType: string;
}) {
  if (!(mimeType in imageTypes)) {
    throw new Error("Unsupported image type.");
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PAGE_IMAGE_BYTES) {
    throw new Error("Image must be between 1 byte and 5 MB.");
  }
  const inspection = inspectImage(bytes, mimeType);

  const contentRoot = resolveContentRoot(options.contentRoot);
  const { book, filePath } = await readCanonicalBook(contentRoot, bookId);
  const page = book.pages.find((item) => item.number === pageNumber);
  if (!page) {
    throw new Error("Page not found.");
  }

  const extension = imageTypes[mimeType as ImageMimeType];
  const preferredPath = `pages/${String(pageNumber).padStart(3, "0")}.${extension}`;
  const currentPathIsReusable = Boolean(
    page.image &&
    isSafeContentPath(page.image) &&
    path.extname(page.image).toLowerCase() === `.${extension}` &&
    !book.pages.some((item) => item.number !== pageNumber && item.image === page.image),
  );
  const preferredPathIsFree = !book.pages.some(
    (item) => item.number !== pageNumber && item.image === preferredPath,
  );
  const relativePath = currentPathIsReusable
    ? page.image!
    : preferredPathIsFree
      ? preferredPath
      : `pages/assets/${randomUUID()}.${extension}`;
  const imagePath = path.join(contentRoot, "books", bookId, ...relativePath.split("/"));

  await fs.mkdir(path.dirname(imagePath), { recursive: true });
  await fs.writeFile(imagePath, bytes);

  page.image = relativePath;
  page.imageStatus = "ready";
  book.updatedAt = todayValue(options.today);
  await writeCanonicalBook(filePath, book);

  return { book, relativePath, imagePath, inspection };
}

export async function readBookPagePrompt({
  bookId,
  pageNumber,
  contentRoot: customContentRoot,
}: {
  bookId: string;
  pageNumber: number;
  contentRoot?: string;
}) {
  const contentRoot = resolveContentRoot(customContentRoot);
  const { book } = await readCanonicalBook(contentRoot, bookId);
  const page = book.pages.find((item) => item.number === pageNumber);

  if (!page?.prompt) {
    return null;
  }
  if (!isSafeContentPath(page.prompt)) {
    throw new Error("Unsafe prompt path.");
  }

  const promptPath = path.join(contentRoot, "books", bookId, ...page.prompt.split("/"));
  try {
    return await fs.readFile(promptPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function readBookPagePrompts({
  bookId,
  contentRoot: customContentRoot,
}: {
  bookId: string;
  contentRoot?: string;
}) {
  const contentRoot = resolveContentRoot(customContentRoot);
  const { book } = await readCanonicalBook(contentRoot, bookId);
  return Promise.all(
    book.pages.map(async (page) => {
      if (!page.prompt || !isSafeContentPath(page.prompt)) return null;
      const promptPath = path.join(contentRoot, "books", bookId, ...page.prompt.split("/"));
      try {
        return await fs.readFile(promptPath, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    }),
  );
}

export async function inspectBookPageImage({
  bookId,
  pageNumber,
  contentRoot: customContentRoot,
}: {
  bookId: string;
  pageNumber: number;
  contentRoot?: string;
}) {
  const contentRoot = resolveContentRoot(customContentRoot);
  const { book } = await readCanonicalBook(contentRoot, bookId);
  const page = book.pages.find((item) => item.number === pageNumber);
  if (!page?.image || !isSafeContentPath(page.image)) return null;
  const mimeType = mimeTypesByExtension[path.extname(page.image).toLowerCase()];
  if (!mimeType) return null;
  try {
    const bytes = new Uint8Array(
      await fs.readFile(path.join(contentRoot, "books", bookId, ...page.image.split("/"))),
    );
    return inspectImage(bytes, mimeType);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function appendBookPageGenerationProvenance({
  bookId,
  pageNumber,
  status,
  provider,
  model,
  requestId,
  referencePaths = [],
  previousImagePath,
  note,
  generatedAt,
  contentRoot: customContentRoot,
}: {
  bookId: string;
  pageNumber: number;
  status: "ready" | "failed" | "prompt_ready";
  provider: string;
  model?: string;
  requestId?: string;
  referencePaths?: string[];
  previousImagePath?: string;
  note?: string;
  generatedAt?: string;
  contentRoot?: string;
}) {
  const contentRoot = resolveContentRoot(customContentRoot);
  const { book } = await readCanonicalBook(contentRoot, bookId);
  const page = book.pages.find((item) => item.number === pageNumber);
  if (!page?.prompt || !isSafeContentPath(page.prompt)) {
    throw new Error("Page has no safe prompt file.");
  }
  const promptPath = path.join(contentRoot, "books", bookId, ...page.prompt.split("/"));
  const lines = [
    "",
    "## Generation result",
    `- status: ${status}`,
    `- provider: ${provider}`,
    `- model: ${model ?? ""}`,
    `- generated_at: ${generatedAt ?? new Date().toISOString()}`,
    `- request_id: ${requestId ?? ""}`,
    "- reference_images:",
    ...(referencePaths.length ? referencePaths.map((item) => `  - ${item}`) : ["  - none"]),
    ...(previousImagePath ? [`- previous_image: ${previousImagePath}`] : []),
    ...(note ? [`- note: ${note.replace(/[\r\n]+/g, " ").slice(0, 500)}`] : []),
    "",
  ];
  await fs.appendFile(promptPath, lines.join("\n"), "utf8");
}

export async function createDraftBook({
  title,
  goalDescription,
  pageCount,
  minMonths,
  maxMonths,
  id,
  ...options
}: MutationOptions & {
  title: string;
  goalDescription: string;
  pageCount: number;
  minMonths: number;
  maxMonths: number;
  id?: string;
}) {
  const cleanTitle = title.trim();
  const cleanGoal = goalDescription.trim();
  if (!cleanTitle || cleanTitle.length > 160) {
    throw new Error("Draft title is required and must be at most 160 characters.");
  }
  if (!cleanGoal || cleanGoal.length > 500) {
    throw new Error("Draft goal is required and must be at most 500 characters.");
  }
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > MAX_BOOK_PAGES) {
    throw new Error(`Page count must be between 1 and ${MAX_BOOK_PAGES}.`);
  }
  if (
    !Number.isInteger(minMonths) ||
    !Number.isInteger(maxMonths) ||
    minMonths < 0 ||
    maxMonths < minMonths ||
    maxMonths > 144
  ) {
    throw new Error("Invalid age range.");
  }

  const contentRoot = resolveContentRoot(options.contentRoot);
  const bookId = id ?? `draft-${randomUUID().slice(0, 8)}`;
  assertBookId(bookId);
  const bookRoot = path.join(contentRoot, "books", bookId);

  try {
    await fs.access(bookRoot);
    throw new Error("A book with this id already exists.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const today = todayValue(options.today);
  const book = bookSchema.parse({
    schemaVersion: 1,
    id: bookId,
    title: cleanTitle,
    language: "ru",
    age: {
      minMonths,
      maxMonths,
      label: `${minMonths}–${maxMonths} мес.`,
    },
    goal: {
      type: "custom",
      slug: "parent-draft",
      description: cleanGoal,
    },
    characters: [],
    status: "draft",
    createdAt: today,
    updatedAt: today,
    pages: Array.from({ length: pageCount }, (_, index) => ({
      number: index + 1,
      text: "",
      characters: [],
      imageStatus: "missing",
    })),
  });

  await fs.mkdir(bookRoot, { recursive: false });
  await writeCanonicalBook(path.join(bookRoot, "book.json"), book);
  return book;
}

export async function getCanonicalBook(bookId: string, contentRoot?: string) {
  const root = resolveContentRoot(contentRoot);
  const library = await loadLibrary({ contentRoot: root });
  return library.books.find((book) => book.id === bookId) ?? null;
}
