import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { bookSchema, characterSchema, type Character } from "../content/schemas";
import { loadLibrary } from "../content/loader";
import { composeIllustrationPrompt } from "../story/prompt";
import { assertIllustrationPromptQuality } from "../story/quality";
import { recommendStoryPattern, selectAgeBand } from "../story/rules";
import { approvedStoryPackageSchema, type ApprovedStoryPackage } from "./story-package";

type MaterializeOptions = {
  contentRoot?: string;
  today?: string;
  now?: string;
};

export type ApprovedStoryMaterializationReport = {
  bookId: string;
  title: string;
  pageCount: number;
  promptCount: number;
  status: "prompt_ready";
  storyPattern: string;
  ageBand: string;
  classification: ApprovedStoryPackage["classification"];
  characters: Array<{
    id: string;
    name: string;
    source: "reused" | "created";
    hasReferenceImage: boolean;
  }>;
  archivedPreviousBook?: string;
  warnings: string[];
};

function resolveContentRoot(contentRoot?: string) {
  return contentRoot
    ? path.resolve(/* turbopackIgnore: true */ contentRoot)
    : path.join(process.cwd(), "content");
}

function todayValue(value?: string) {
  return value ?? new Date().toISOString().slice(0, 10);
}

function safeTimestamp(value?: string) {
  return (value ?? new Date().toISOString()).replace(/[:.]/g, "-");
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function requireNewCharacterDefinition(
  definition: ApprovedStoryPackage["characters"][number],
) {
  if (
    !definition.name ||
    !definition.type ||
    !definition.narrativeDescription ||
    !definition.identity
  ) {
    throw new Error(
      `New character "${definition.id}" needs name, type, narrativeDescription and identity.`,
    );
  }

  return characterSchema.parse({
    schemaVersion: 1,
    id: definition.id,
    name: definition.name,
    type: definition.type,
    ...(definition.species ? { species: definition.species } : {}),
    narrativeDescription: definition.narrativeDescription,
    visual: {
      identity: definition.identity,
      palette: definition.palette,
      fixedTraits: definition.fixedTraits,
      doNotChange: definition.doNotChange,
    },
    references: [],
  });
}

function deriveGoalType(storyPattern: string, explicit?: string) {
  if (explicit) return explicit;
  return storyPattern.replace(/-.+$/, "") || "custom";
}

export async function materializeApprovedStory(
  input: unknown,
  options: MaterializeOptions = {},
): Promise<ApprovedStoryMaterializationReport> {
  const story = approvedStoryPackageSchema.parse(input);
  const contentRoot = resolveContentRoot(options.contentRoot);
  const today = todayValue(options.today);
  const library = await loadLibrary({ contentRoot });
  const existingCharacters = new Map(library.characters.map((character) => [character.id, character]));
  const packageCharacterIds = new Set(story.characters.map((character) => character.id));
  const resolvedCharacters = new Map<string, Character>();
  const characterSources = new Map<string, "reused" | "created">();
  const newCharacters: Character[] = [];

  for (const definition of story.characters) {
    const existing = existingCharacters.get(definition.id);
    if (existing) {
      resolvedCharacters.set(existing.id, existing);
      characterSources.set(existing.id, "reused");
      continue;
    }
    const created = requireNewCharacterDefinition(definition);
    resolvedCharacters.set(created.id, created);
    characterSources.set(created.id, "created");
    newCharacters.push(created);
  }

  const allPageCharacterIds = new Set(
    story.pages.flatMap((page) => page.characterIds ?? []),
  );
  for (const characterId of allPageCharacterIds) {
    if (!packageCharacterIds.has(characterId)) {
      const existing = existingCharacters.get(characterId);
      if (!existing) {
        throw new Error(
          `Page references unknown character "${characterId}". Add it to the package characters list.`,
        );
      }
      resolvedCharacters.set(existing.id, existing);
      characterSources.set(existing.id, "reused");
    }
  }

  const bookCharacterIds = [...resolvedCharacters.keys()];
  const storyPattern =
    story.storyPattern ??
    recommendStoryPattern(story.goal.type ?? "custom", story.goal.description);
  const ageRule = selectAgeBand(story.age.minMonths, story.age.maxMonths);
  const pages = story.pages.map((page, index) => {
    const characterIds = page.characterIds ?? bookCharacterIds;
    for (const characterId of characterIds) {
      if (!resolvedCharacters.has(characterId)) {
        throw new Error(`Page ${index + 1} references unresolved character "${characterId}".`);
      }
    }
    return {
      number: index + 1,
      text: page.text,
      prompt: `prompts/${String(index + 1).padStart(3, "0")}.md`,
      characters: [...new Set(characterIds)],
      imageStatus: "prompt_ready" as const,
    };
  });

  const book = bookSchema.parse({
    schemaVersion: 1,
    id: story.id,
    title: story.title,
    language: story.language,
    age: {
      minMonths: story.age.minMonths,
      maxMonths: story.age.maxMonths,
      label: `${story.age.minMonths}–${story.age.maxMonths} мес.`,
    },
    goal: {
      type: deriveGoalType(storyPattern, story.goal.type),
      slug: story.goal.slug ?? storyPattern,
      description: story.goal.description,
    },
    characters: bookCharacterIds,
    classification: story.classification,
    status: "prompt_ready",
    createdAt: today,
    updatedAt: today,
    authoring: {
      skill: "childrens-story-creator-v1",
      ageBand: ageRule.id,
      storyPattern,
      ...(story.visualStyle ? { visualStyle: story.visualStyle } : {}),
      externalReferences: story.externalReferences,
      outline: story.pages.map((page, index) => ({
        pageNumber: index + 1,
        beat: page.scene ?? (page.text || `Страница ${index + 1}`),
      })),
    },
    pages,
  });

  const prompts = new Map<number, string>();
  for (const page of book.pages) {
    const sourcePage = story.pages[page.number - 1]!;
    const characters = page.characters.map((id) => resolvedCharacters.get(id)!).filter(Boolean);
    const prompt = composeIllustrationPrompt({
      book,
      pageNumber: page.number,
      beat: sourcePage.scene ?? (sourcePage.text || `Страница ${page.number}`),
      sceneBrief: sourcePage.scene,
      pageText: sourcePage.text,
      environment: sourcePage.environment,
      composition: sourcePage.composition,
      continuityNotes: sourcePage.continuityNotes,
      ageRule,
      characters,
    });
    assertIllustrationPromptQuality(prompt, characters);
    prompts.set(page.number, prompt);
  }

  const booksRoot = path.join(contentRoot, "books");
  const charactersRoot = path.join(contentRoot, "characters");
  const targetBookRoot = path.join(booksRoot, story.id);
  const targetExists = await exists(targetBookRoot);
  if (story.mode === "create" && targetExists) {
    throw new Error(`Book "${story.id}" already exists. Use mode "replace" only for an intentional replacement.`);
  }
  if (story.mode === "replace" && !targetExists) {
    throw new Error(`Book "${story.id}" does not exist, so it cannot be replaced.`);
  }
  for (const character of newCharacters) {
    if (await exists(path.join(charactersRoot, character.id))) {
      throw new Error(`Character "${character.id}" appeared during materialization; retry after inspecting canonical content.`);
    }
  }

  const stagingRoot = path.join(contentRoot, ".agent-staging", randomUUID());
  const stagedBookRoot = path.join(stagingRoot, "books", story.id);
  try {
    await fs.mkdir(path.join(stagedBookRoot, "prompts"), { recursive: true });
    await fs.mkdir(path.join(stagedBookRoot, "authoring"), { recursive: true });
    await fs.writeFile(
      path.join(stagedBookRoot, "book.json"),
      `${JSON.stringify(book, null, 2)}\n`,
      "utf8",
    );
    for (const [pageNumber, prompt] of prompts) {
      await fs.writeFile(
        path.join(stagedBookRoot, "prompts", `${String(pageNumber).padStart(3, "0")}.md`),
        prompt,
        "utf8",
      );
    }
    await fs.writeFile(
      path.join(stagedBookRoot, "authoring", "approved-story.json"),
      `${JSON.stringify(story, null, 2)}\n`,
      "utf8",
    );

    for (const character of newCharacters) {
      const stagedCharacterRoot = path.join(stagingRoot, "characters", character.id);
      await fs.mkdir(stagedCharacterRoot, { recursive: true });
      await fs.writeFile(
        path.join(stagedCharacterRoot, "character.json"),
        `${JSON.stringify(character, null, 2)}\n`,
        "utf8",
      );
    }

    await fs.mkdir(booksRoot, { recursive: true });
    await fs.mkdir(charactersRoot, { recursive: true });
    for (const character of newCharacters) {
      await fs.rename(
        path.join(stagingRoot, "characters", character.id),
        path.join(charactersRoot, character.id),
      );
    }

    let archivedPreviousBook: string | undefined;
    let archivedPath: string | undefined;
    if (targetExists) {
      const archiveRoot = path.join(contentRoot, "archive", "agent-replaced-books");
      await fs.mkdir(archiveRoot, { recursive: true });
      const archivedName = `${story.id}-${safeTimestamp(options.now)}`;
      archivedPath = path.join(archiveRoot, archivedName);
      await fs.rename(targetBookRoot, archivedPath);
      archivedPreviousBook = path.relative(contentRoot, archivedPath).split(path.sep).join("/");
    }
    try {
      await fs.rename(stagedBookRoot, targetBookRoot);
    } catch (error) {
      if (archivedPath && !(await exists(targetBookRoot)) && (await exists(archivedPath))) {
        await fs.rename(archivedPath, targetBookRoot);
      }
      throw error;
    }

    const verified = await loadLibrary({ contentRoot });
    const savedBook = verified.books.find((item) => item.id === story.id);
    if (!savedBook) throw new Error("Materialized book failed canonical reload validation.");
    if (savedBook.pages.length !== story.pages.length) {
      throw new Error("Materialized page count does not match the approved story package.");
    }
    for (const [index, sourcePage] of story.pages.entries()) {
      if (savedBook.pages[index]?.text !== sourcePage.text) {
        throw new Error(`Approved text changed during materialization on page ${index + 1}.`);
      }
      const promptPath = path.join(targetBookRoot, "prompts", `${String(index + 1).padStart(3, "0")}.md`);
      if (!(await exists(promptPath))) throw new Error(`Prompt ${index + 1} was not saved.`);
    }

    const warnings = [...resolvedCharacters.values()]
      .filter((character) => character.references.length === 0)
      .map((character) => `Character "${character.id}" has no reference image yet; upload one manually when available.`);
    if (story.classification.meanings.length === 0) {
      warnings.push("Book classification has no meanings; the authoring agent should infer at least one when the story meaning is clear.");
    }
    if (story.classification.situations.length === 0) {
      warnings.push("Book classification has no situations; the authoring agent should infer at least one when the story situation is clear.");
    }
    const relatedDiagnostics = verified.diagnostics.filter(
      (item) => item.itemId === story.id || resolvedCharacters.has(item.itemId ?? ""),
    );
    for (const diagnostic of relatedDiagnostics) {
      if (diagnostic.severity === "warning") warnings.push(diagnostic.message);
    }

    const report: ApprovedStoryMaterializationReport = {
      bookId: story.id,
      title: story.title,
      pageCount: savedBook.pages.length,
      promptCount: prompts.size,
      status: "prompt_ready",
      storyPattern,
      ageBand: ageRule.id,
      classification: savedBook.classification,
      characters: [...resolvedCharacters.values()].map((character) => ({
        id: character.id,
        name: character.name,
        source: characterSources.get(character.id) ?? "reused",
        hasReferenceImage: character.references.length > 0,
      })),
      ...(archivedPreviousBook ? { archivedPreviousBook } : {}),
      warnings: [...new Set(warnings)],
    };
    await fs.writeFile(
      path.join(targetBookRoot, "authoring", "materialization-report.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
    return report;
  } finally {
    await fs.rm(stagingRoot, { recursive: true, force: true });
  }
}

