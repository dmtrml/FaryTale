import { z } from "zod";
import { loadLibrary } from "../content/loader";
import {
  createDraftBook,
  getCanonicalBook,
  readBookPagePrompt,
  updateBookPageText,
} from "../content/mutations";
import {
  MAX_BOOK_PAGES,
  createCharacter,
  deleteBookPage,
  duplicateBookPage,
  insertBookPage,
  moveBookPage,
  updateBookMetadata,
  updateBookPageCharacters,
  updateCharacter,
} from "../content/authoring";
import { storyPatternSchema } from "../content/schemas";
import { preparePagePrompt, prepareStoryOutline } from "../story/generator";
import { materializeApprovedStory } from "../agent/materialize";

type ToolOptions = {
  contentRoot?: string;
  today?: string;
};

export type StudioToolResult = {
  tool: string;
  text: string;
  touchedBookId?: string;
};

const bookIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export async function listBooksTool(options: ToolOptions = {}): Promise<StudioToolResult> {
  const library = await loadLibrary({ contentRoot: options.contentRoot });
  const lines = library.books.map(
    (book) => `• ${book.id} — ${book.title} (${book.status}, ${book.pages.length} стр.)`,
  );
  return {
    tool: "list_books",
    text: lines.length ? lines.join("\n") : "Книг пока нет.",
  };
}

export async function getBookTool(input: unknown, options: ToolOptions = {}): Promise<StudioToolResult> {
  const { bookId } = z.object({ bookId: bookIdSchema }).parse(input);
  const book = await getCanonicalBook(bookId, options.contentRoot);
  if (!book) throw new Error("Книга не найдена.");

  const pageLines = book.pages.map(
    (page) => `${page.number}. ${page.text || "[текст пуст]"} · image=${page.imageStatus}`,
  );
  return {
    tool: "get_book",
    text: `${book.title}\nСтатус: ${book.status}\nВозраст: ${book.age.label}\nЦель: ${book.goal.description}\n${pageLines.join("\n")}`,
  };
}

export async function createBookTool(input: unknown, options: ToolOptions = {}): Promise<StudioToolResult> {
  const values = z
    .object({
      id: bookIdSchema.optional(),
      title: z.string().trim().min(1).max(160),
      goalDescription: z.string().trim().min(1).max(500),
      minMonths: z.number().int().min(0).max(144),
      maxMonths: z.number().int().min(0).max(144),
      pageCount: z.number().int().min(1).max(MAX_BOOK_PAGES),
    })
    .refine((value) => value.minMonths <= value.maxMonths, {
      message: "Минимальный возраст не может быть больше максимального.",
    })
    .parse(input);
  const book = await createDraftBook({ ...values, ...options });
  return {
    tool: "create_book",
    touchedBookId: book.id,
    text: `Создан черновик ${book.id}: «${book.title}», ${book.pages.length} стр.`,
  };
}

export async function updatePageTool(input: unknown, options: ToolOptions = {}): Promise<StudioToolResult> {
  const values = z
    .object({
      bookId: bookIdSchema,
      pageNumber: z.number().int().positive(),
      text: z.string().max(2000),
    })
    .parse(input);
  await updateBookPageText({ ...values, ...options });
  return {
    tool: "update_page",
    touchedBookId: values.bookId,
    text: `Страница ${values.pageNumber} книги ${values.bookId} сохранена в book.json.`,
  };
}

export async function createOutlineTool(input: unknown, options: ToolOptions = {}): Promise<StudioToolResult> {
  const values = z
    .object({
      bookId: bookIdSchema,
      storyPattern: storyPatternSchema.optional(),
      characterId: bookIdSchema.optional(),
      visualStyle: z.string().trim().max(600).optional(),
    })
    .parse(input);
  const book = await prepareStoryOutline({ ...values, ...options });
  return {
    tool: "create_outline",
    touchedBookId: values.bookId,
    text: `Структура сохранена: ${book.authoring?.storyPattern}, ${book.authoring?.outline.length ?? 0} beats, age-band ${book.authoring?.ageBand}.`,
  };
}

export async function createPromptTool(input: unknown, options: ToolOptions = {}): Promise<StudioToolResult> {
  const values = z
    .object({
      bookId: bookIdSchema,
      pageNumber: z.number().int().positive(),
      storyPattern: storyPatternSchema.optional(),
      characterId: bookIdSchema.optional(),
      visualStyle: z.string().trim().max(600).optional(),
    })
    .parse(input);
  const current = await getCanonicalBook(values.bookId, options.contentRoot);
  if (!current) throw new Error("Книга не найдена.");

  const book = await preparePagePrompt({
    ...values,
    storyPattern: values.storyPattern ?? current.authoring?.storyPattern,
    characterId: values.characterId ?? current.characters[0],
    visualStyle: values.visualStyle ?? current.authoring?.visualStyle,
    ...options,
  });
  const prompt = await readBookPagePrompt({
    bookId: values.bookId,
    pageNumber: values.pageNumber,
    contentRoot: options.contentRoot,
  });
  return {
    tool: "create_prompt",
    touchedBookId: values.bookId,
    text: `Промпт страницы ${values.pageNumber} сохранён (${prompt?.length ?? 0} символов). Статус страницы: ${book.pages[values.pageNumber - 1]?.imageStatus}.`,
  };
}

export async function listCharactersTool(options: ToolOptions = {}): Promise<StudioToolResult> {
  const library = await loadLibrary({ contentRoot: options.contentRoot });
  return {
    tool: "list_characters",
    text: library.characters.length
      ? library.characters.map((character) => `• ${character.id} — ${character.name}`).join("\n")
      : "Персонажей пока нет.",
  };
}

export async function getCharacterTool(input: unknown, options: ToolOptions = {}): Promise<StudioToolResult> {
  const { characterId } = z.object({ characterId: bookIdSchema }).parse(input);
  const library = await loadLibrary({ contentRoot: options.contentRoot });
  const character = library.characters.find((item) => item.id === characterId);
  if (!character) throw new Error("Персонаж не найден.");
  return {
    tool: "get_character",
    text: `${character.name}\n${character.narrativeDescription}\nVisual identity: ${character.visual.identity}\nReferences: ${character.references.length}`,
  };
}

export async function updateBookMetadataTool(input: unknown, options: ToolOptions = {}): Promise<StudioToolResult> {
  const values = z.object({
    bookId: bookIdSchema,
    title: z.string().trim().min(1).max(160),
    language: z.string().trim().min(2).max(35),
    goalDescription: z.string().trim().min(1).max(500),
    minMonths: z.number().int().min(0).max(144),
    maxMonths: z.number().int().min(0).max(144),
    status: z.enum(["draft", "text_ready", "prompt_ready", "illustrating", "ready", "archived"]),
    characterIds: z.array(bookIdSchema).default([]),
  }).refine((value) => value.minMonths <= value.maxMonths, { message: "Invalid age range." }).parse(input);
  await updateBookMetadata({ ...values, ...options });
  return { tool: "update_book_metadata", touchedBookId: values.bookId, text: `Книга ${values.bookId} обновлена.` };
}

export async function insertPageTool(input: unknown, options: ToolOptions = {}): Promise<StudioToolResult> {
  const values = z.object({ bookId: bookIdSchema, position: z.number().int().min(1).max(MAX_BOOK_PAGES) }).parse(input);
  const book = await insertBookPage({ ...values, ...options });
  return { tool: "insert_page", touchedBookId: values.bookId, text: `Страница вставлена в позицию ${values.position}. Теперь ${book.pages.length} стр.` };
}

export async function duplicatePageTool(input: unknown, options: ToolOptions = {}): Promise<StudioToolResult> {
  const values = z.object({ bookId: bookIdSchema, pageNumber: z.number().int().positive() }).parse(input);
  const book = await duplicateBookPage({ ...values, ...options });
  return { tool: "duplicate_page", touchedBookId: values.bookId, text: `Страница ${values.pageNumber} продублирована. Теперь ${book.pages.length} стр.` };
}

export async function deletePageTool(input: unknown, options: ToolOptions = {}): Promise<StudioToolResult> {
  const values = z.object({ bookId: bookIdSchema, pageNumber: z.number().int().positive() }).parse(input);
  const book = await deleteBookPage({ ...values, ...options });
  return { tool: "delete_page", touchedBookId: values.bookId, text: `Страница удалена. Осталось ${book.pages.length} стр.` };
}

export async function movePageTool(input: unknown, options: ToolOptions = {}): Promise<StudioToolResult> {
  const values = z.object({ bookId: bookIdSchema, pageNumber: z.number().int().positive(), targetPosition: z.number().int().positive() }).parse(input);
  await moveBookPage({ ...values, ...options });
  return { tool: "move_page", touchedBookId: values.bookId, text: `Страница ${values.pageNumber} перемещена в позицию ${values.targetPosition}.` };
}

export async function updatePageCharactersTool(input: unknown, options: ToolOptions = {}): Promise<StudioToolResult> {
  const values = z.object({ bookId: bookIdSchema, pageNumber: z.number().int().positive(), characterIds: z.array(bookIdSchema) }).parse(input);
  await updateBookPageCharacters({ ...values, ...options });
  return { tool: "update_page_characters", touchedBookId: values.bookId, text: `Персонажи страницы ${values.pageNumber} обновлены.` };
}

export async function createCharacterTool(input: unknown, options: ToolOptions = {}): Promise<StudioToolResult> {
  const values = z.object({
    id: bookIdSchema,
    name: z.string().trim().min(1),
    type: z.string().trim().min(1),
    species: z.string().trim().optional(),
    narrativeDescription: z.string().trim().min(1),
    identity: z.string().trim().min(1),
    palette: z.array(z.string()).default([]),
    fixedTraits: z.array(z.string()).default([]),
    doNotChange: z.array(z.string()).default([]),
  }).parse(input);
  const character = await createCharacter({ ...values, ...options });
  return { tool: "create_character", text: `Персонаж ${character.id} создан.` };
}

export async function updateCharacterTool(input: unknown, options: ToolOptions = {}): Promise<StudioToolResult> {
  const values = z.object({
    characterId: bookIdSchema,
    name: z.string().trim().min(1),
    type: z.string().trim().min(1),
    species: z.string().trim().optional(),
    narrativeDescription: z.string().trim().min(1),
    identity: z.string().trim().min(1),
    palette: z.array(z.string()).default([]),
    fixedTraits: z.array(z.string()).default([]),
    doNotChange: z.array(z.string()).default([]),
  }).parse(input);
  const character = await updateCharacter({ ...values, ...options });
  return { tool: "update_character", text: `Персонаж ${character.id} обновлён.` };
}

export async function materializeApprovedStoryTool(
  input: unknown,
  options: ToolOptions = {},
): Promise<StudioToolResult> {
  const report = await materializeApprovedStory(input, options);
  const warningText = report.warnings.length
    ? `\nПредупреждения:\n${report.warnings.map((warning) => `• ${warning}`).join("\n")}`
    : "\nПредупреждений нет.";
  return {
    tool: "materialize_approved_story",
    touchedBookId: report.bookId,
    text: [
      `Книга «${report.title}» сохранена в FaryTale.`,
      `ID: ${report.bookId}`,
      `Страниц: ${report.pageCount}`,
      `Промптов: ${report.promptCount}/${report.pageCount}`,
      `Статус: ${report.status}`,
      `Возрастная группа: ${report.ageBand}`,
      `Story pattern: ${report.storyPattern}`,
      `Персонажи: ${report.characters.length ? report.characters.map((character) => `${character.id} (${character.source})`).join(", ") : "нет"}`,
      report.archivedPreviousBook ? `Предыдущая версия: ${report.archivedPreviousBook}` : "",
      warningText,
    ].filter(Boolean).join("\n"),
  };
}
