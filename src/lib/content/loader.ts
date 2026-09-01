import { promises as fs } from "node:fs";
import path from "node:path";
import { ZodError } from "zod";
import {
  bookSchema,
  characterSchema,
  type Book,
  type Character,
  type LibraryManifest,
} from "./schemas";

export type ContentDiagnosticSeverity = "warning" | "error";

export type ContentDiagnosticCode =
  | "invalid_json"
  | "invalid_schema"
  | "unsafe_path"
  | "id_folder_mismatch"
  | "duplicate_id"
  | "invalid_page_order"
  | "missing_asset"
  | "missing_character"
  | "filesystem_error";

export type ContentDiagnostic = {
  severity: ContentDiagnosticSeverity;
  code: ContentDiagnosticCode;
  message: string;
  source: string;
  itemId?: string;
};

export type LoadedLibrary = {
  books: Book[];
  characters: Character[];
  diagnostics: ContentDiagnostic[];
};

type LoadOptions = {
  contentRoot?: string;
};

const defaultContentRoot = () => path.join(process.cwd(), "content");

function resolveContentRoot(contentRoot?: string) {
  if (!contentRoot) {
    return defaultContentRoot();
  }

  // Custom roots are used by tests/tools and must not make Turbopack trace the
  // whole project. Runtime app content is statically scoped to ./content above.
  return path.resolve(/* turbopackIgnore: true */ contentRoot);
}

function normalizeSource(contentRoot: string, absolutePath: string) {
  return path.relative(contentRoot, absolutePath).split(path.sep).join("/");
}

function formatZodError(error: ZodError) {
  return error.issues
    .map((issue) => {
      const location = issue.path.length ? issue.path.join(".") : "root";
      return `${location}: ${issue.message}`;
    })
    .join("; ");
}

export function isSafeContentPath(value: string) {
  if (!value || value.includes("\\") || value.includes("\0")) {
    return false;
  }

  if (path.posix.isAbsolute(value) || /^[A-Za-z]:/.test(value)) {
    return false;
  }

  const normalized = path.posix.normalize(value);
  return normalized !== ".." && !normalized.startsWith("../");
}

async function pathExists(absolutePath: string) {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile(absolutePath: string) {
  const raw = await fs.readFile(absolutePath, "utf8");
  return JSON.parse(raw) as unknown;
}

async function listDirectories(absolutePath: string) {
  try {
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function validatePageOrder(book: Book): ContentDiagnostic | null {
  for (let index = 0; index < book.pages.length; index += 1) {
    const expected = index + 1;
    if (book.pages[index]?.number !== expected) {
      return {
        severity: "error",
        code: "invalid_page_order",
        itemId: book.id,
        source: `${book.id}/book.json`,
        message: `Pages must be ordered consecutively from 1; expected page ${expected}.`,
      };
    }
  }

  return null;
}

function collectBookPaths(book: Book) {
  const paths: Array<{ value: string; label: string; required: boolean }> = [];

  if (book.cover) {
    paths.push({ value: book.cover, label: "cover", required: false });
  }

  for (const page of book.pages) {
    if (page.image) {
      paths.push({
        value: page.image,
        label: `page ${page.number} image`,
        required: false,
      });
    }
    if (page.prompt) {
      paths.push({
        value: page.prompt,
        label: `page ${page.number} prompt`,
        required: false,
      });
    }
  }

  return paths;
}

async function loadCharacters(
  contentRoot: string,
  diagnostics: ContentDiagnostic[],
) {
  const charactersRoot = path.join(contentRoot, "characters");
  const folders = await listDirectories(charactersRoot);
  const characters: Character[] = [];
  const ids = new Set<string>();

  for (const folder of folders) {
    const filePath = path.join(charactersRoot, folder, "character.json");
    if (!(await pathExists(filePath))) {
      continue;
    }

    let value: unknown;
    try {
      value = await readJsonFile(filePath);
    } catch (error) {
      diagnostics.push({
        severity: "error",
        code:
          error instanceof SyntaxError ? "invalid_json" : "filesystem_error",
        source: normalizeSource(contentRoot, filePath),
        message:
          error instanceof Error ? error.message : "Unable to read character file.",
      });
      continue;
    }

    const parsed = characterSchema.safeParse(value);
    if (!parsed.success) {
      diagnostics.push({
        severity: "error",
        code: "invalid_schema",
        source: normalizeSource(contentRoot, filePath),
        message: formatZodError(parsed.error),
      });
      continue;
    }

    const character = parsed.data;
    if (character.id !== folder) {
      diagnostics.push({
        severity: "error",
        code: "id_folder_mismatch",
        itemId: character.id,
        source: normalizeSource(contentRoot, filePath),
        message: `Character id "${character.id}" must match folder "${folder}".`,
      });
      continue;
    }

    if (ids.has(character.id)) {
      diagnostics.push({
        severity: "error",
        code: "duplicate_id",
        itemId: character.id,
        source: normalizeSource(contentRoot, filePath),
        message: `Duplicate character id "${character.id}".`,
      });
      continue;
    }

    let unsafeReference = false;
    for (const reference of character.references) {
      if (!isSafeContentPath(reference.path)) {
        unsafeReference = true;
        diagnostics.push({
          severity: "error",
          code: "unsafe_path",
          itemId: character.id,
          source: normalizeSource(contentRoot, filePath),
          message: `Unsafe character reference path: ${reference.path}`,
        });
        continue;
      }

      const absoluteReference = path.join(
        charactersRoot,
        folder,
        ...reference.path.split("/"),
      );
      if (!(await pathExists(absoluteReference))) {
        diagnostics.push({
          severity: "warning",
          code: "missing_asset",
          itemId: character.id,
          source: normalizeSource(contentRoot, absoluteReference),
          message: `Missing character reference "${reference.path}".`,
        });
      }
    }

    if (unsafeReference) {
      continue;
    }

    ids.add(character.id);
    characters.push(character);
  }

  return characters;
}

async function loadBooks(
  contentRoot: string,
  characterIds: Set<string>,
  diagnostics: ContentDiagnostic[],
) {
  const booksRoot = path.join(contentRoot, "books");
  const folders = await listDirectories(booksRoot);
  const books: Book[] = [];
  const ids = new Set<string>();

  for (const folder of folders) {
    const filePath = path.join(booksRoot, folder, "book.json");
    if (!(await pathExists(filePath))) {
      continue;
    }

    let value: unknown;
    try {
      value = await readJsonFile(filePath);
    } catch (error) {
      diagnostics.push({
        severity: "error",
        code:
          error instanceof SyntaxError ? "invalid_json" : "filesystem_error",
        source: normalizeSource(contentRoot, filePath),
        message:
          error instanceof Error ? error.message : "Unable to read book file.",
      });
      continue;
    }

    const parsed = bookSchema.safeParse(value);
    if (!parsed.success) {
      diagnostics.push({
        severity: "error",
        code: "invalid_schema",
        source: normalizeSource(contentRoot, filePath),
        message: formatZodError(parsed.error),
      });
      continue;
    }

    const book = parsed.data;
    if (book.id !== folder) {
      diagnostics.push({
        severity: "error",
        code: "id_folder_mismatch",
        itemId: book.id,
        source: normalizeSource(contentRoot, filePath),
        message: `Book id "${book.id}" must match folder "${folder}".`,
      });
      continue;
    }

    if (ids.has(book.id)) {
      diagnostics.push({
        severity: "error",
        code: "duplicate_id",
        itemId: book.id,
        source: normalizeSource(contentRoot, filePath),
        message: `Duplicate book id "${book.id}".`,
      });
      continue;
    }

    const pageOrderDiagnostic = validatePageOrder(book);
    if (pageOrderDiagnostic) {
      pageOrderDiagnostic.source = normalizeSource(contentRoot, filePath);
      diagnostics.push(pageOrderDiagnostic);
      continue;
    }

    let hasUnsafePath = false;
    for (const asset of collectBookPaths(book)) {
      if (!isSafeContentPath(asset.value)) {
        hasUnsafePath = true;
        diagnostics.push({
          severity: "error",
          code: "unsafe_path",
          itemId: book.id,
          source: normalizeSource(contentRoot, filePath),
          message: `Unsafe ${asset.label} path: ${asset.value}`,
        });
        continue;
      }

      const absoluteAsset = path.join(
        booksRoot,
        folder,
        ...asset.value.split("/"),
      );
      if (!(await pathExists(absoluteAsset))) {
        diagnostics.push({
          severity: asset.required ? "error" : "warning",
          code: "missing_asset",
          itemId: book.id,
          source: normalizeSource(contentRoot, absoluteAsset),
          message: `Missing ${asset.label} "${asset.value}".`,
        });
      }
    }

    if (hasUnsafePath) {
      continue;
    }

    const referencedCharacters = new Set([
      ...book.characters,
      ...book.pages.flatMap((page) => page.characters),
    ]);
    for (const characterId of referencedCharacters) {
      if (!characterIds.has(characterId)) {
        diagnostics.push({
          severity: "warning",
          code: "missing_character",
          itemId: book.id,
          source: normalizeSource(contentRoot, filePath),
          message: `Book references missing character "${characterId}".`,
        });
      }
    }

    ids.add(book.id);
    books.push(book);
  }

  return books;
}

export async function loadLibrary(options: LoadOptions = {}): Promise<LoadedLibrary> {
  const contentRoot = resolveContentRoot(options.contentRoot);
  const diagnostics: ContentDiagnostic[] = [];
  const characters = await loadCharacters(contentRoot, diagnostics);
  const characterIds = new Set(characters.map((character) => character.id));
  const books = await loadBooks(contentRoot, characterIds, diagnostics);

  books.sort((a, b) => a.id.localeCompare(b.id));
  characters.sort((a, b) => a.id.localeCompare(b.id));

  return { books, characters, diagnostics };
}

export function createLibraryManifest(books: Book[]): LibraryManifest {
  return {
    schemaVersion: 1,
    books: [...books]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((book) => ({
        id: book.id,
        title: book.title,
        language: book.language,
        age: book.age,
        goal: book.goal,
        status: book.status,
        ...(book.cover ? { cover: book.cover } : {}),
        updatedAt: book.updatedAt,
        pageCount: book.pages.length,
      })),
  };
}

export async function writeLibraryManifest(options: LoadOptions = {}) {
  const contentRoot = resolveContentRoot(options.contentRoot);
  const library = await loadLibrary({ contentRoot });
  const manifest = createLibraryManifest(library.books);
  const generatedRoot = path.join(contentRoot, "generated");
  const manifestPath = path.join(generatedRoot, "library-manifest.json");

  await fs.mkdir(generatedRoot, { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return { manifest, manifestPath, diagnostics: library.diagnostics };
}
