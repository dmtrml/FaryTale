import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  bookSchema,
  bookStatusSchema,
  characterSchema,
  type Book,
  type BookPage,
  type Character,
} from "./schemas";
import { isSafeContentPath, loadLibrary } from "./loader";
import { inspectImage } from "../images/inspect";
import { assertBookIllustrationAspectRatio } from "../images/aspect-ratio";

const contentIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const imageTypes = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type ImageMimeType = keyof typeof imageTypes;

export const MAX_BOOK_PAGES = 200;
export const MAX_CHARACTER_REFERENCE_BYTES = 5 * 1024 * 1024;
export const MAX_BOOK_COVER_BYTES = 5 * 1024 * 1024;
export const MAX_BOOK_REFERENCE_BYTES = 5 * 1024 * 1024;

type AuthoringOptions = {
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

function assertContentId(value: string, label: string) {
  if (!contentIdPattern.test(value)) throw new Error(`Invalid ${label} id.`);
}

async function readBook(contentRoot: string, bookId: string) {
  assertContentId(bookId, "book");
  const filePath = path.join(contentRoot, "books", bookId, "book.json");
  const book = bookSchema.parse(JSON.parse(await fs.readFile(filePath, "utf8")));
  if (book.id !== bookId) throw new Error("Book id does not match its folder.");
  return { book, filePath, bookRoot: path.dirname(filePath) };
}

async function writeBook(filePath: string, book: Book) {
  const validated = bookSchema.parse(book);
  await fs.writeFile(filePath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  return validated;
}

async function readCharacter(contentRoot: string, characterId: string) {
  assertContentId(characterId, "character");
  const filePath = path.join(contentRoot, "characters", characterId, "character.json");
  const character = characterSchema.parse(JSON.parse(await fs.readFile(filePath, "utf8")));
  if (character.id !== characterId) throw new Error("Character id does not match its folder.");
  return { character, filePath, characterRoot: path.dirname(filePath) };
}

async function writeCharacter(filePath: string, character: Character) {
  const validated = characterSchema.parse(character);
  await fs.writeFile(filePath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  return validated;
}

function renumberPages(book: Book) {
  book.pages.forEach((page, index) => {
    page.number = index + 1;
  });
  if (book.authoring) {
    book.authoring.outline.forEach((item, index) => {
      item.pageNumber = index + 1;
    });
  }
}

async function assertCharactersExist(contentRoot: string, characterIds: string[]) {
  for (const characterId of characterIds) {
    assertContentId(characterId, "character");
    try {
      await fs.access(path.join(contentRoot, "characters", characterId, "character.json"));
    } catch {
      throw new Error(`Character "${characterId}" does not exist.`);
    }
  }
}

async function copyDeclaredFile(
  bookRoot: string,
  relativePath: string | undefined,
  kind: "page" | "prompt",
) {
  if (!relativePath || !isSafeContentPath(relativePath)) return undefined;
  const extension = path.posix.extname(relativePath);
  const folder = kind === "page" ? "pages/copies" : "prompts/copies";
  const targetRelative = `${folder}/${randomUUID()}${extension}`;
  const source = path.join(bookRoot, ...relativePath.split("/"));
  const target = path.join(bookRoot, ...targetRelative.split("/"));
  try {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target);
    return targetRelative;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function archiveDeclaredFile(
  bookRoot: string,
  relativePath: string | undefined,
  stillReferenced: Set<string>,
) {
  if (!relativePath || stillReferenced.has(relativePath) || !isSafeContentPath(relativePath)) return;
  const source = path.join(bookRoot, ...relativePath.split("/"));
  const target = path.join(
    bookRoot,
    "archive",
    "deleted-pages",
    randomUUID(),
    path.posix.basename(relativePath),
  );
  try {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.rename(source, target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function updateBookMetadata({
  bookId,
  title,
  language,
  goalDescription,
  minMonths,
  maxMonths,
  status,
  characterIds,
  ...options
}: AuthoringOptions & {
  bookId: string;
  title: string;
  language: string;
  goalDescription: string;
  minMonths: number;
  maxMonths: number;
  status: string;
  characterIds: string[];
}) {
  const cleanTitle = title.trim();
  const cleanLanguage = language.trim();
  const cleanGoal = goalDescription.trim();
  if (!cleanTitle || cleanTitle.length > 160) throw new Error("Book title is required and must be at most 160 characters.");
  if (cleanLanguage.length < 2 || cleanLanguage.length > 35) throw new Error("Book language must be between 2 and 35 characters.");
  if (!cleanGoal || cleanGoal.length > 500) throw new Error("Book goal is required and must be at most 500 characters.");
  if (!Number.isInteger(minMonths) || !Number.isInteger(maxMonths) || minMonths < 0 || maxMonths < minMonths || maxMonths > 144) {
    throw new Error("Invalid age range.");
  }
  const uniqueCharacterIds = [...new Set(characterIds)];
  const contentRoot = resolveContentRoot(options.contentRoot);
  await assertCharactersExist(contentRoot, uniqueCharacterIds);
  const { book, filePath } = await readBook(contentRoot, bookId);
  const allowed = new Set(uniqueCharacterIds);
  book.title = cleanTitle;
  book.language = cleanLanguage;
  book.goal.description = cleanGoal;
  book.age = { minMonths, maxMonths, label: `${minMonths}–${maxMonths} мес.` };
  book.status = bookStatusSchema.parse(status);
  book.characters = uniqueCharacterIds;
  for (const page of book.pages) page.characters = page.characters.filter((id) => allowed.has(id));
  book.updatedAt = todayValue(options.today);
  return writeBook(filePath, book);
}

export async function replaceBookCover({
  bookId,
  bytes,
  mimeType,
  ...options
}: AuthoringOptions & {
  bookId: string;
  bytes: Uint8Array;
  mimeType: string;
}) {
  if (!(mimeType in imageTypes)) throw new Error("Unsupported image type.");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BOOK_COVER_BYTES) {
    throw new Error("Cover image must be between 1 byte and 5 MB.");
  }
  const inspection = inspectImage(bytes, mimeType);
  const contentRoot = resolveContentRoot(options.contentRoot);
  const { book, filePath, bookRoot } = await readBook(contentRoot, bookId);
  const extension = imageTypes[mimeType as ImageMimeType];
  const relativePath = `covers/${randomUUID()}.${extension}`;
  const target = path.join(bookRoot, ...relativePath.split("/"));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, bytes);
  book.cover = relativePath;
  book.updatedAt = todayValue(options.today);
  await writeBook(filePath, book);
  return { book, relativePath, inspection };
}

export async function replaceBookEnvironmentReference({
  bookId,
  bytes,
  mimeType,
  ...options
}: AuthoringOptions & {
  bookId: string;
  bytes: Uint8Array;
  mimeType: string;
}) {
  if (!(mimeType in imageTypes)) throw new Error("Unsupported image type.");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BOOK_REFERENCE_BYTES) {
    throw new Error("Book reference image must be between 1 byte and 5 MB.");
  }
  const inspection = inspectImage(bytes, mimeType);
  assertBookIllustrationAspectRatio(
    inspection.width,
    inspection.height,
    "Environment reference",
  );
  const contentRoot = resolveContentRoot(options.contentRoot);
  const { book, filePath, bookRoot } = await readBook(contentRoot, bookId);
  const previous = book.references.find((reference) => reference.role === "environment");
  const extension = imageTypes[mimeType as ImageMimeType];
  const relativePath = `refs/environment-${randomUUID()}.${extension}`;
  const target = path.join(bookRoot, ...relativePath.split("/"));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, bytes);
  book.references = [
    ...book.references.filter((reference) => reference.role !== "environment"),
    { id: "environment", path: relativePath, role: "environment" },
  ];
  book.updatedAt = todayValue(options.today);
  await writeBook(filePath, book);
  if (previous && previous.path !== relativePath && isSafeContentPath(previous.path)) {
    await fs.rm(path.join(bookRoot, ...previous.path.split("/")), { force: true });
  }
  return { book, relativePath, inspection };
}

export async function updateBookPageCharacters({
  bookId,
  pageNumber,
  characterIds,
  ...options
}: AuthoringOptions & { bookId: string; pageNumber: number; characterIds: string[] }) {
  const contentRoot = resolveContentRoot(options.contentRoot);
  const uniqueCharacterIds = [...new Set(characterIds)];
  await assertCharactersExist(contentRoot, uniqueCharacterIds);
  const { book, filePath } = await readBook(contentRoot, bookId);
  const page = book.pages.find((item) => item.number === pageNumber);
  if (!page) throw new Error("Page not found.");
  page.characters = uniqueCharacterIds;
  book.characters = [...new Set([...book.characters, ...uniqueCharacterIds])];
  book.updatedAt = todayValue(options.today);
  return writeBook(filePath, book);
}

export async function insertBookPage({
  bookId,
  position,
  ...options
}: AuthoringOptions & { bookId: string; position: number }) {
  const contentRoot = resolveContentRoot(options.contentRoot);
  const { book, filePath } = await readBook(contentRoot, bookId);
  if (book.pages.length >= MAX_BOOK_PAGES) throw new Error(`A book can contain at most ${MAX_BOOK_PAGES} pages.`);
  if (!Number.isInteger(position) || position < 1 || position > book.pages.length + 1) throw new Error("Invalid insertion position.");
  const page: BookPage = { number: position, text: "", characters: [], imageStatus: "missing" };
  book.pages.splice(position - 1, 0, page);
  if (book.authoring) {
    book.authoring.outline.splice(position - 1, 0, {
      pageNumber: position,
      beat: "Новая страница — требуется уточнить действие.",
    });
  }
  renumberPages(book);
  book.status = "draft";
  book.updatedAt = todayValue(options.today);
  return writeBook(filePath, book);
}

export async function duplicateBookPage({
  bookId,
  pageNumber,
  ...options
}: AuthoringOptions & { bookId: string; pageNumber: number }) {
  const contentRoot = resolveContentRoot(options.contentRoot);
  const { book, filePath, bookRoot } = await readBook(contentRoot, bookId);
  if (book.pages.length >= MAX_BOOK_PAGES) throw new Error(`A book can contain at most ${MAX_BOOK_PAGES} pages.`);
  const index = book.pages.findIndex((item) => item.number === pageNumber);
  if (index < 0) throw new Error("Page not found.");
  const source = book.pages[index]!;
  const copiedImage = await copyDeclaredFile(bookRoot, source.image, "page");
  const copiedPrompt = await copyDeclaredFile(bookRoot, source.prompt, "prompt");
  const duplicate: BookPage = {
    ...source,
    number: pageNumber + 1,
    ...(copiedImage ? { image: copiedImage } : { image: undefined }),
    ...(copiedPrompt ? { prompt: copiedPrompt } : { prompt: undefined }),
    imageStatus: copiedImage ? source.imageStatus : copiedPrompt ? "prompt_ready" : "missing",
    characters: [...source.characters],
  };
  book.pages.splice(index + 1, 0, duplicate);
  if (book.authoring) {
    const sourceBeat = book.authoring.outline[index]?.beat ?? "Дублированная страница.";
    book.authoring.outline.splice(index + 1, 0, { pageNumber: pageNumber + 1, beat: sourceBeat });
  }
  renumberPages(book);
  book.status = "draft";
  book.updatedAt = todayValue(options.today);
  return writeBook(filePath, book);
}

export async function deleteBookPage({
  bookId,
  pageNumber,
  ...options
}: AuthoringOptions & { bookId: string; pageNumber: number }) {
  const contentRoot = resolveContentRoot(options.contentRoot);
  const { book, filePath, bookRoot } = await readBook(contentRoot, bookId);
  if (book.pages.length <= 1) throw new Error("A book must keep at least one page.");
  const index = book.pages.findIndex((item) => item.number === pageNumber);
  if (index < 0) throw new Error("Page not found.");
  const [removed] = book.pages.splice(index, 1);
  if (book.authoring) book.authoring.outline.splice(index, 1);
  const stillReferenced = new Set(
    book.pages.flatMap((page) => [page.image, page.prompt].filter((value): value is string => Boolean(value))),
  );
  await archiveDeclaredFile(bookRoot, removed?.image, stillReferenced);
  await archiveDeclaredFile(bookRoot, removed?.prompt, stillReferenced);
  renumberPages(book);
  book.status = "draft";
  book.updatedAt = todayValue(options.today);
  return writeBook(filePath, book);
}

export async function moveBookPage({
  bookId,
  pageNumber,
  targetPosition,
  ...options
}: AuthoringOptions & { bookId: string; pageNumber: number; targetPosition: number }) {
  const contentRoot = resolveContentRoot(options.contentRoot);
  const { book, filePath } = await readBook(contentRoot, bookId);
  if (!Number.isInteger(targetPosition) || targetPosition < 1 || targetPosition > book.pages.length) throw new Error("Invalid target position.");
  const index = book.pages.findIndex((item) => item.number === pageNumber);
  if (index < 0) throw new Error("Page not found.");
  if (index === targetPosition - 1) return book;
  const [page] = book.pages.splice(index, 1);
  book.pages.splice(targetPosition - 1, 0, page!);
  if (book.authoring) {
    const [outline] = book.authoring.outline.splice(index, 1);
    if (outline) book.authoring.outline.splice(targetPosition - 1, 0, outline);
  }
  renumberPages(book);
  book.status = "draft";
  book.updatedAt = todayValue(options.today);
  return writeBook(filePath, book);
}

function cleanList(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

export async function createCharacter({
  id,
  name,
  type,
  species,
  narrativeDescription,
  identity,
  palette = [],
  fixedTraits = [],
  doNotChange = [],
  ...options
}: AuthoringOptions & {
  id: string;
  name: string;
  type: string;
  species?: string;
  narrativeDescription: string;
  identity: string;
  palette?: string[];
  fixedTraits?: string[];
  doNotChange?: string[];
}) {
  assertContentId(id, "character");
  const contentRoot = resolveContentRoot(options.contentRoot);
  await fs.mkdir(path.join(contentRoot, "characters"), { recursive: true });
  const characterRoot = path.join(contentRoot, "characters", id);
  try {
    await fs.access(characterRoot);
    throw new Error("A character with this id already exists.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const character = characterSchema.parse({
    schemaVersion: 1,
    id,
    name: name.trim(),
    type: type.trim(),
    ...(species?.trim() ? { species: species.trim() } : {}),
    narrativeDescription: narrativeDescription.trim(),
    visual: {
      identity: identity.trim(),
      palette: cleanList(palette),
      fixedTraits: cleanList(fixedTraits),
      doNotChange: cleanList(doNotChange),
    },
    references: [],
  });
  await fs.mkdir(characterRoot, { recursive: false });
  return writeCharacter(path.join(characterRoot, "character.json"), character);
}

export async function updateCharacter({
  characterId,
  name,
  type,
  species,
  narrativeDescription,
  identity,
  palette = [],
  fixedTraits = [],
  doNotChange = [],
  ...options
}: AuthoringOptions & {
  characterId: string;
  name: string;
  type: string;
  species?: string;
  narrativeDescription: string;
  identity: string;
  palette?: string[];
  fixedTraits?: string[];
  doNotChange?: string[];
}) {
  const contentRoot = resolveContentRoot(options.contentRoot);
  const { character, filePath } = await readCharacter(contentRoot, characterId);
  character.name = name.trim();
  character.type = type.trim();
  if (species?.trim()) character.species = species.trim();
  else delete character.species;
  character.narrativeDescription = narrativeDescription.trim();
  character.visual.identity = identity.trim();
  character.visual.palette = cleanList(palette);
  character.visual.fixedTraits = cleanList(fixedTraits);
  character.visual.doNotChange = cleanList(doNotChange);
  return writeCharacter(filePath, character);
}

export async function addCharacterReference({
  characterId,
  bytes,
  mimeType,
  role,
  makeIdentity = false,
  ...options
}: AuthoringOptions & {
  characterId: string;
  bytes: Uint8Array;
  mimeType: string;
  role: string;
  makeIdentity?: boolean;
}) {
  if (!(mimeType in imageTypes)) throw new Error("Unsupported image type.");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_CHARACTER_REFERENCE_BYTES) throw new Error("Reference image must be between 1 byte and 5 MB.");
  inspectImage(bytes, mimeType);
  const contentRoot = resolveContentRoot(options.contentRoot);
  const { character, filePath, characterRoot } = await readCharacter(contentRoot, characterId);
  const referenceId = `ref-${randomUUID().slice(0, 8)}`;
  const extension = imageTypes[mimeType as ImageMimeType];
  const relativePath = `refs/${referenceId}.${extension}`;
  const target = path.join(characterRoot, ...relativePath.split("/"));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, bytes);
  if (makeIdentity) {
    for (const reference of character.references) {
      if (reference.role === "identity") reference.role = "reference";
    }
  }
  character.references.push({
    id: referenceId,
    path: relativePath,
    role: makeIdentity ? "identity" : role.trim() || "reference",
  });
  await writeCharacter(filePath, character);
  return { character, referenceId, relativePath };
}

export async function setCharacterIdentityReference({
  characterId,
  referenceId,
  ...options
}: AuthoringOptions & { characterId: string; referenceId: string }) {
  const contentRoot = resolveContentRoot(options.contentRoot);
  const { character, filePath } = await readCharacter(contentRoot, characterId);
  const selected = character.references.find((reference) => reference.id === referenceId);
  if (!selected) throw new Error("Reference not found.");
  for (const reference of character.references) {
    if (reference.role === "identity") reference.role = "reference";
  }
  selected.role = "identity";
  return writeCharacter(filePath, character);
}

export async function updateCharacterReferenceRole({
  characterId,
  referenceId,
  role,
  ...options
}: AuthoringOptions & { characterId: string; referenceId: string; role: string }) {
  const cleanRole = role.trim();
  if (!cleanRole || cleanRole.length > 80) throw new Error("Reference role is required and must be at most 80 characters.");
  const contentRoot = resolveContentRoot(options.contentRoot);
  const { character, filePath } = await readCharacter(contentRoot, characterId);
  const selected = character.references.find((reference) => reference.id === referenceId);
  if (!selected) throw new Error("Reference not found.");
  if (cleanRole === "identity") {
    for (const reference of character.references) {
      if (reference.role === "identity") reference.role = "reference";
    }
  }
  selected.role = cleanRole;
  return writeCharacter(filePath, character);
}

export async function removeCharacterReference({
  characterId,
  referenceId,
  ...options
}: AuthoringOptions & { characterId: string; referenceId: string }) {
  const contentRoot = resolveContentRoot(options.contentRoot);
  const { character, filePath, characterRoot } = await readCharacter(contentRoot, characterId);
  const index = character.references.findIndex((reference) => reference.id === referenceId);
  if (index < 0) throw new Error("Reference not found.");
  const [removed] = character.references.splice(index, 1);
  await writeCharacter(filePath, character);
  if (removed && isSafeContentPath(removed.path)) {
    await fs.rm(path.join(characterRoot, ...removed.path.split("/")), { force: true });
  }
  return character;
}

export async function deleteCharacter({
  characterId,
  ...options
}: AuthoringOptions & { characterId: string }) {
  const contentRoot = resolveContentRoot(options.contentRoot);
  assertContentId(characterId, "character");
  const library = await loadLibrary({ contentRoot });
  const usedBy = library.books.filter(
    (book) => book.characters.includes(characterId) || book.pages.some((page) => page.characters.includes(characterId)),
  );
  if (usedBy.length) {
    throw new Error(`Character is still used by: ${usedBy.map((book) => book.id).join(", ")}.`);
  }
  await fs.rm(path.join(contentRoot, "characters", characterId), { recursive: true, force: true });
}

export async function getCanonicalCharacter(characterId: string, contentRoot?: string) {
  const root = resolveContentRoot(contentRoot);
  const library = await loadLibrary({ contentRoot: root });
  return library.characters.find((character) => character.id === characterId) ?? null;
}
