import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { bookSchema, characterSchema, type Book, type Character } from "../content/schemas";
import { getCanonicalBook } from "../content/mutations";
import { loadLibrary } from "../content/loader";
import { createStoredZip, readZip, type ZipEntry } from "./zip";
import { inspectImage } from "../images/inspect";

const exportManifestSchema = z.object({
  format: z.literal("farytale-book-export"),
  version: z.literal(1),
  bookId: z.string().min(1),
});

const mimeByExtension: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function contentRootPath(customRoot?: string) {
  return customRoot
    ? path.resolve(/* turbopackIgnore: true */ customRoot)
    : path.join(process.cwd(), "content");
}

async function collectDirectory(root: string, zipPrefix: string): Promise<ZipEntry[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const result: ZipEntry[] = [];
  for (const entry of entries) {
    const absolute = path.join(root, entry.name);
    const relative = `${zipPrefix}/${entry.name}`;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) result.push(...(await collectDirectory(absolute, relative)));
    else if (entry.isFile()) result.push({ path: relative, bytes: new Uint8Array(await fs.readFile(absolute)) });
  }
  return result;
}

export async function buildBookExport(bookId: string, customRoot?: string) {
  const contentRoot = contentRootPath(customRoot);
  const book = await getCanonicalBook(bookId, contentRoot);
  if (!book) throw new Error("Book not found or invalid.");
  const library = await loadLibrary({ contentRoot });
  const characters = book.characters
    .map((id) => library.characters.find((character) => character.id === id))
    .filter((character): character is Character => Boolean(character));
  if (characters.length !== book.characters.length) throw new Error("Book references a missing character.");

  const manifest = new TextEncoder().encode(
    `${JSON.stringify({ format: "farytale-book-export", version: 1, bookId: book.id }, null, 2)}\n`,
  );
  const entries: ZipEntry[] = [{ path: "export.json", bytes: manifest }];
  entries.push(...(await collectDirectory(path.join(contentRoot, "books", book.id), `books/${book.id}`)));
  for (const character of characters) {
    entries.push(
      ...(await collectDirectory(
        path.join(contentRoot, "characters", character.id),
        `characters/${character.id}`,
      )),
    );
  }
  const zip = createStoredZip(entries);
  validateBookExport(zip);
  return zip;
}

export type ValidatedBookExport = {
  manifest: z.infer<typeof exportManifestSchema>;
  book: Book;
  characters: Character[];
  entries: Map<string, Uint8Array>;
};

function parseJson<T>(entries: Map<string, Uint8Array>, key: string, schema: z.ZodType<T>) {
  const bytes = entries.get(key);
  if (!bytes) throw new Error(`Export is missing ${key}.`);
  return schema.parse(JSON.parse(new TextDecoder().decode(bytes)));
}

export function validateBookExport(bytes: Uint8Array): ValidatedBookExport {
  const entries = readZip(bytes);
  const manifest = parseJson(entries, "export.json", exportManifestSchema);
  const bookPath = `books/${manifest.bookId}/book.json`;
  const book = parseJson(entries, bookPath, bookSchema);
  if (book.id !== manifest.bookId) throw new Error("Export book id does not match its folder/manifest.");

  for (const page of book.pages) {
    if (page.image) {
      const image = entries.get(`books/${book.id}/${page.image}`);
      if (!image) throw new Error(`Export is missing declared page image: ${page.image}`);
      const mimeType = mimeByExtension[path.extname(page.image).toLowerCase()];
      if (!mimeType) throw new Error(`Unsupported exported page image type: ${page.image}`);
      inspectImage(image, mimeType);
    }
    if (page.prompt && !entries.has(`books/${book.id}/${page.prompt}`)) {
      throw new Error(`Export is missing declared page prompt: ${page.prompt}`);
    }
  }
  if (book.cover) {
    const cover = entries.get(`books/${book.id}/${book.cover}`);
    if (!cover) throw new Error(`Export is missing declared cover: ${book.cover}`);
    const mimeType = mimeByExtension[path.extname(book.cover).toLowerCase()];
    if (!mimeType) throw new Error(`Unsupported exported cover type: ${book.cover}`);
    inspectImage(cover, mimeType);
  }
  for (const reference of book.references) {
    const image = entries.get(`books/${book.id}/${reference.path}`);
    if (!image) throw new Error(`Export is missing book reference: ${reference.path}`);
    const mimeType = mimeByExtension[path.extname(reference.path).toLowerCase()];
    if (!mimeType) throw new Error(`Unsupported exported book reference type: ${reference.path}`);
    inspectImage(image, mimeType);
  }

  const characters = book.characters.map((characterId) => {
    const character = parseJson(
      entries,
      `characters/${characterId}/character.json`,
      characterSchema,
    );
    if (character.id !== characterId) throw new Error(`Character ${characterId} id does not match its folder.`);
    for (const reference of character.references) {
      const image = entries.get(`characters/${characterId}/${reference.path}`);
      if (!image) {
        throw new Error(`Export is missing character reference: ${characterId}/${reference.path}`);
      }
      const mimeType = mimeByExtension[path.extname(reference.path).toLowerCase()];
      if (!mimeType) throw new Error(`Unsupported character reference type: ${characterId}/${reference.path}`);
      inspectImage(image, mimeType);
    }
    return character;
  });
  return { manifest, book, characters, entries };
}

async function writeEntriesToStaging(validated: ValidatedBookExport, staging: string) {
  const allowedPrefixes = [
    `books/${validated.book.id}/`,
    ...validated.characters.map((character) => `characters/${character.id}/`),
  ];
  for (const [entryPath, content] of validated.entries) {
    if (entryPath === "export.json" || !allowedPrefixes.some((prefix) => entryPath.startsWith(prefix))) continue;
    const destination = path.join(staging, ...entryPath.split("/"));
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, content);
  }
}

export async function importBookExport(bytes: Uint8Array, customRoot?: string) {
  const validated = validateBookExport(bytes);
  const contentRoot = contentRootPath(customRoot);
  const targetBook = path.join(contentRoot, "books", validated.book.id);
  try {
    await fs.access(targetBook);
    throw new Error("A book with this id already exists.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  for (const character of validated.characters) {
    const target = path.join(contentRoot, "characters", character.id, "character.json");
    try {
      const existing = characterSchema.parse(JSON.parse(await fs.readFile(target, "utf8")));
      if (JSON.stringify(existing) !== JSON.stringify(character)) {
        throw new Error(`Character ${character.id} already exists with a different canonical definition.`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  const staging = path.join(os.tmpdir(), `farytale-import-${randomUUID()}`);
  await fs.mkdir(staging, { recursive: true });
  try {
    await writeEntriesToStaging(validated, staging);
    await fs.mkdir(path.join(contentRoot, "books"), { recursive: true });
    await fs.mkdir(path.join(contentRoot, "characters"), { recursive: true });
    for (const character of validated.characters) {
      const target = path.join(contentRoot, "characters", character.id);
      try {
        await fs.access(target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        await fs.rename(path.join(staging, "characters", character.id), target);
      }
    }
    await fs.rename(path.join(staging, "books", validated.book.id), targetBook);
    return validated.book;
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}
