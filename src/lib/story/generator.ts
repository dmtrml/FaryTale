import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { bookSchema, storyPatternSchema, type StoryPattern } from "../content/schemas";
import { isSafeContentPath, loadLibrary } from "../content/loader";
import { ManualImageProvider } from "../providers/manual-image";
import { composeIllustrationPrompt } from "./prompt";
import { assertIllustrationPromptQuality } from "./quality";
import {
  fitBeatsToPageCount,
  recommendStoryPattern,
  selectAgeBand,
} from "./rules";

type PrepareStoryOptions = {
  contentRoot?: string;
  bookId: string;
  storyPattern?: StoryPattern;
  characterId?: string;
  visualStyle?: string;
  today?: string;
};

type PreparePagePromptOptions = PrepareStoryOptions & {
  pageNumber: number;
};

function rootPath(contentRoot?: string) {
  return contentRoot
    ? path.resolve(/* turbopackIgnore: true */ contentRoot)
    : path.join(process.cwd(), "content");
}

async function resolvePreparation(options: PrepareStoryOptions) {
  const root = rootPath(options.contentRoot);
  const library = await loadLibrary({ contentRoot: root });
  const book = library.books.find((item) => item.id === options.bookId);
  if (!book) throw new Error("Book not found or invalid.");

  const ageRule = selectAgeBand(book.age.minMonths, book.age.maxMonths);
  const pattern = storyPatternSchema.parse(
    options.storyPattern ?? recommendStoryPattern(book.goal.type, book.goal.description),
  );
  const beats = fitBeatsToPageCount(pattern, book.pages.length);

  const selectedCharacter = options.characterId
    ? library.characters.find((character) => character.id === options.characterId)
    : undefined;
  if (options.characterId && !selectedCharacter) {
    throw new Error("Selected character does not exist.");
  }
  const characters = selectedCharacter ? [selectedCharacter] : [];

  return { root, book, ageRule, pattern, beats, characters };
}

function applyOutline({
  book,
  ageRule,
  pattern,
  beats,
  characters,
  visualStyle,
}: Awaited<ReturnType<typeof resolvePreparation>> & { visualStyle?: string }) {
  book.characters = characters.map((character) => character.id);
  book.authoring = {
    skill: "childrens-story-creator-v1",
    ageBand: ageRule.id,
    storyPattern: pattern,
    ...(visualStyle?.trim() ? { visualStyle: visualStyle.trim() } : {}),
    outline: beats.map((beat, index) => ({ pageNumber: index + 1, beat })),
  };
  for (const page of book.pages) {
    page.characters = characters.map((character) => character.id);
  }
}

async function writeBook(root: string, book: (Awaited<ReturnType<typeof resolvePreparation>>)["book"], today?: string) {
  book.updatedAt = today ?? new Date().toISOString().slice(0, 10);
  const validated = bookSchema.parse(book);
  await fs.writeFile(
    path.join(root, "books", book.id, "book.json"),
    `${JSON.stringify(validated, null, 2)}\n`,
    "utf8",
  );
  return validated;
}

async function writePrompt({
  root,
  book,
  pageNumber,
  beat,
  ageRule,
  characters,
}: Awaited<ReturnType<typeof resolvePreparation>> & {
  pageNumber: number;
  beat: string;
}) {
  const page = book.pages.find((item) => item.number === pageNumber);
  if (!page) throw new Error("Page not found.");

  const imageProvider = new ManualImageProvider();
  const preferredPrompt = `prompts/${String(page.number).padStart(3, "0")}.md`;
  const currentPromptIsReusable = Boolean(
    page.prompt &&
    isSafeContentPath(page.prompt) &&
    !book.pages.some((item) => item.number !== pageNumber && item.prompt === page.prompt),
  );
  const preferredPromptIsFree = !book.pages.some(
    (item) => item.number !== pageNumber && item.prompt === preferredPrompt,
  );
  const promptRelative = currentPromptIsReusable
    ? page.prompt!
    : preferredPromptIsFree
      ? preferredPrompt
      : `prompts/assets/${randomUUID()}.md`;
  page.prompt = promptRelative;

  const prompt = composeIllustrationPrompt({
    book,
    pageNumber: page.number,
    beat,
    ageRule,
    characters,
  });
  assertIllustrationPromptQuality(prompt, characters);
  const imageResult = await imageProvider.generate({
    prompt,
    references: characters.flatMap((character) =>
      character.references.map((reference) => ({
        path: `characters/${character.id}/${reference.path}`,
        role: reference.role,
      })),
    ),
  });
  page.imageStatus = imageResult.imageStatus;

  const promptPath = path.join(root, "books", book.id, ...promptRelative.split("/"));
  await fs.mkdir(path.dirname(promptPath), { recursive: true });
  await fs.writeFile(promptPath, imageResult.prompt, "utf8");
  return promptRelative;
}

export async function prepareStoryOutline(options: PrepareStoryOptions) {
  const preparation = await resolvePreparation(options);
  applyOutline({ ...preparation, visualStyle: options.visualStyle });
  return writeBook(preparation.root, preparation.book, options.today);
}

export async function preparePagePrompt(options: PreparePagePromptOptions) {
  const preparation = await resolvePreparation(options);
  applyOutline({ ...preparation, visualStyle: options.visualStyle });
  const beat = preparation.beats[options.pageNumber - 1];
  if (!beat) throw new Error("Page not found.");
  await writePrompt({ ...preparation, pageNumber: options.pageNumber, beat });

  if (preparation.book.pages.every((page) => page.imageStatus === "prompt_ready" || page.imageStatus === "ready")) {
    if (preparation.book.status === "draft" || preparation.book.status === "text_ready") {
      preparation.book.status = "prompt_ready";
    }
  }
  return writeBook(preparation.root, preparation.book, options.today);
}

export async function prepareManualStoryDraft(options: PrepareStoryOptions) {
  const preparation = await resolvePreparation(options);
  applyOutline({ ...preparation, visualStyle: options.visualStyle });

  for (let index = 0; index < preparation.book.pages.length; index += 1) {
    const page = preparation.book.pages[index];
    const beat = preparation.beats[index];
    if (!page || !beat) continue;
    if (page.imageStatus === "ready") continue;
    await writePrompt({ ...preparation, pageNumber: page.number, beat });
  }

  if (preparation.book.status === "draft" || preparation.book.status === "text_ready") {
    preparation.book.status = "prompt_ready";
  }
  return writeBook(preparation.root, preparation.book, options.today);
}
