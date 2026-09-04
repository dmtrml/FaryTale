import {
  createCharacterTool,
  createBookTool,
  createOutlineTool,
  createPromptTool,
  deletePageTool,
  duplicatePageTool,
  getBookTool,
  getCharacterTool,
  insertPageTool,
  listBooksTool,
  listCharactersTool,
  materializeApprovedStoryTool,
  movePageTool,
  type StudioToolResult,
  updateBookMetadataTool,
  updateCharacterTool,
  updatePageCharactersTool,
  updatePageTool,
} from "./tools";
import type { TextProvider } from "../providers/contracts";
import { interpretStudioMessage } from "./model-interpreter";

type OrchestratorOptions = {
  contentRoot?: string;
  today?: string;
  textProvider?: TextProvider | null;
};

function help(): StudioToolResult {
  return {
    tool: "help",
    text: [
      "Локальный Studio работает через явные project tools. Доступные команды:",
      "/books",
      "/book <book-id>",
      "/characters",
      "/character <character-id>",
      "/outline <book-id> [story-pattern] [character-id]",
      "/prompt <book-id> <page-number>",
      "/page <book-id> <page-number> <новый текст>",
      "/insert <book-id> <position>",
      "/duplicate <book-id> <page-number>",
      "/delete-page <book-id> <page-number>",
      "/move <book-id> <page-number> <target-position>",
      "/page-characters <book-id> <page-number> <id1,id2>",
      "/create <id> | <название> | <цель> | <minMonths> | <maxMonths> | <pages>",
      "/book-meta <id> | <название> | <язык> | <цель> | <minMonths> | <maxMonths> | <status> | <characterIds через запятую>",
      "/character-create <id> | <имя> | <тип> | <species> | <описание> | <visual identity>",
      "/character-update <id> | <имя> | <тип> | <species> | <описание> | <visual identity>",
      "/materialize-json <ApprovedStoryPackage JSON>",
      "Свободный текст при настроенном text provider переводится только в команды из этого allowlist.",
    ].join("\n"),
  };
}

export async function runStudioMessage(message: string, options: OrchestratorOptions = {}) {
  const input = message.trim();
  if (!input || input === "/help" || /^помощь$/i.test(input)) return help();
  if (input === "/books" || /^книги$/i.test(input) || /^(покажи|открой|список).*(книг)/i.test(input)) {
    return listBooksTool(options);
  }
  if (
    input === "/characters" ||
    /^персонажи$/i.test(input) ||
    /^(покажи|открой|список).*(персонаж|геро)/i.test(input)
  ) {
    return listCharactersTool(options);
  }

  const book = input.match(/^\/book\s+([a-z0-9-]+)$/i);
  if (book) return getBookTool({ bookId: book[1] }, options);

  const character = input.match(/^\/character\s+([a-z0-9-]+)$/i);
  if (character) return getCharacterTool({ characterId: character[1] }, options);

  const outline = input.match(/^\/outline\s+([a-z0-9-]+)(?:\s+([a-z0-9-]+))?(?:\s+([a-z0-9-]+))?$/i);
  if (outline) {
    return createOutlineTool(
      {
        bookId: outline[1],
        ...(outline[2] ? { storyPattern: outline[2] } : {}),
        ...(outline[3] ? { characterId: outline[3] } : {}),
      },
      options,
    );
  }

  const prompt = input.match(/^\/prompt\s+([a-z0-9-]+)\s+(\d+)$/i);
  if (prompt) {
    return createPromptTool({ bookId: prompt[1], pageNumber: Number(prompt[2]) }, options);
  }

  const page = input.match(/^\/page\s+([a-z0-9-]+)\s+(\d+)\s+([\s\S]+)$/i);
  if (page) {
    return updatePageTool(
      { bookId: page[1], pageNumber: Number(page[2]), text: page[3] },
      options,
    );
  }

  const insert = input.match(/^\/insert\s+([a-z0-9-]+)\s+(\d+)$/i);
  if (insert) return insertPageTool({ bookId: insert[1], position: Number(insert[2]) }, options);

  const duplicate = input.match(/^\/duplicate\s+([a-z0-9-]+)\s+(\d+)$/i);
  if (duplicate) return duplicatePageTool({ bookId: duplicate[1], pageNumber: Number(duplicate[2]) }, options);

  const deletePage = input.match(/^\/delete-page\s+([a-z0-9-]+)\s+(\d+)$/i);
  if (deletePage) return deletePageTool({ bookId: deletePage[1], pageNumber: Number(deletePage[2]) }, options);

  const move = input.match(/^\/move\s+([a-z0-9-]+)\s+(\d+)\s+(\d+)$/i);
  if (move) return movePageTool({ bookId: move[1], pageNumber: Number(move[2]), targetPosition: Number(move[3]) }, options);

  const pageCharacters = input.match(/^\/page-characters\s+([a-z0-9-]+)\s+(\d+)\s*([a-z0-9,-]*)$/i);
  if (pageCharacters) {
    const characterIds = pageCharacters[3]
      ? pageCharacters[3].split(",").map((value) => value.trim()).filter(Boolean)
      : [];
    return updatePageCharactersTool({ bookId: pageCharacters[1], pageNumber: Number(pageCharacters[2]), characterIds }, options);
  }

  if (input.startsWith("/create ")) {
    const parts = input.slice(8).split("|").map((part) => part.trim());
    if (parts.length === 6) {
      return createBookTool(
        {
          id: parts[0],
          title: parts[1],
          goalDescription: parts[2],
          minMonths: Number(parts[3]),
          maxMonths: Number(parts[4]),
          pageCount: Number(parts[5]),
        },
        options,
      );
    }
  }

  if (input.startsWith("/book-meta ")) {
    const parts = input.slice(11).split("|").map((part) => part.trim());
    if (parts.length === 8) {
      return updateBookMetadataTool({
        bookId: parts[0],
        title: parts[1],
        language: parts[2],
        goalDescription: parts[3],
        minMonths: Number(parts[4]),
        maxMonths: Number(parts[5]),
        status: parts[6],
        characterIds: parts[7] ? parts[7].split(",").map((value) => value.trim()).filter(Boolean) : [],
      }, options);
    }
  }

  if (input.startsWith("/character-create ")) {
    const parts = input.slice(18).split("|").map((part) => part.trim());
    if (parts.length === 6) {
      return createCharacterTool({
        id: parts[0],
        name: parts[1],
        type: parts[2],
        species: parts[3] || undefined,
        narrativeDescription: parts[4],
        identity: parts[5],
      }, options);
    }
  }

  if (input.startsWith("/character-update ")) {
    const parts = input.slice(18).split("|").map((part) => part.trim());
    if (parts.length === 6) {
      return updateCharacterTool({
        characterId: parts[0],
        name: parts[1],
        type: parts[2],
        species: parts[3] || undefined,
        narrativeDescription: parts[4],
        identity: parts[5],
      }, options);
    }
  }

  if (input.startsWith("/materialize-json ")) {
    const json = input.slice("/materialize-json ".length).trim();
    let packageValue: unknown;
    try {
      packageValue = JSON.parse(json);
    } catch {
      throw new Error("ApprovedStoryPackage JSON is invalid.");
    }
    return materializeApprovedStoryTool(packageValue, options);
  }

  if (options.textProvider) {
    const command = await interpretStudioMessage(options.textProvider, input);
    return runStudioMessage(command, { ...options, textProvider: null });
  }

  if (/(сказк|истори|книг)/i.test(input)) {
    return {
      tool: "conversation_unavailable",
      text: [
        "Идею понял. Для полноценного свободного разговора и творческого создания истории встроенному помощнику нужна настроенная текстовая модель.",
        "Пока самый удобный путь — обсудить и утвердить историю с внешним агентом ChatGPT, а затем попросить его сохранить утверждённую книгу в FaryTale.",
        "Без текстовой модели здесь всё равно работают быстрые действия: показать книги и персонажей, а также технические команды из /help.",
      ].join("\n\n"),
    } satisfies StudioToolResult;
  }

  return {
    tool: "unrecognized",
    text: "Не удалось однозначно понять запрос без настроенной текстовой модели. Попробуйте «покажи мои книги» или «покажи персонажей». Технические команды доступны через /help.",
  } satisfies StudioToolResult;
}
