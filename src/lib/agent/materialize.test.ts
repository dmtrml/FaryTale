import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadLibrary } from "../content/loader";
import { materializeApprovedStory } from "./materialize";

const roots: string[] = [];

async function makeRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "farytale-agent-"));
  roots.push(root);
  await fs.mkdir(path.join(root, "books"), { recursive: true });
  await fs.mkdir(path.join(root, "characters", "miau"), { recursive: true });
  await fs.writeFile(
    path.join(root, "characters", "miau", "character.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        id: "miau",
        name: "Котёнок Мяу",
        type: "animal",
        species: "kitten",
        narrativeDescription: "Добрый любопытный котёнок.",
        visual: {
          identity: "CANONICAL MIAU IDENTITY",
          palette: ["warm"],
          fixedTraits: ["small kitten"],
          doNotChange: ["do not redesign Miau"],
        },
        references: [],
      },
      null,
      2,
    )}\n`,
  );
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

function basicPackage() {
  return {
    schemaVersion: 1 as const,
    id: "miau-brushes-teeth",
    title: "Мяу чистит зубки",
    age: { minMonths: 18, maxMonths: 24 },
    goal: { description: "Показать спокойную вечернюю чистку зубов." },
    visualStyle: "Тёплая простая иллюстрация для малыша, крупные формы.",
    characters: [{ id: "miau" }],
    pages: [
      {
        text: "  Мяу посмотрел на свою щётку.  ",
        scene: "Мяу стоит у низкой раковины и смотрит на маленькую зубную щётку.",
        characterIds: ["miau"],
        environment: "Та же уютная ванная, только раковина и нужные предметы.",
        composition: "Средний план, Мяу и щётка крупные.",
      },
      {
        text: "Мяу чистит зубки.",
        scene: "Мяу аккуратно чистит зубы щёткой перед зеркалом.",
        characterIds: ["miau"],
      },
    ],
  };
}

describe("approved-story materialization", () => {
  it("preserves approved page text exactly and saves one prompt per scene", async () => {
    const root = await makeRoot();
    const input = basicPackage();
    const report = await materializeApprovedStory(input, {
      contentRoot: root,
      today: "2026-08-29",
      now: "2026-08-29T20:00:00.000Z",
    });

    expect(report).toMatchObject({
      bookId: "miau-brushes-teeth",
      pageCount: 2,
      promptCount: 2,
      status: "prompt_ready",
      characters: [{ id: "miau", source: "reused", hasReferenceImage: false }],
    });
    expect(report.warnings.join(" ")).toContain("no reference image");

    const saved = JSON.parse(
      await fs.readFile(path.join(root, "books", input.id, "book.json"), "utf8"),
    ) as { pages: Array<{ text: string; prompt: string; imageStatus: string }> };
    expect(saved.pages[0]?.text).toBe(input.pages[0]?.text);
    expect(saved.pages[1]?.text).toBe(input.pages[1]?.text);
    expect(saved.pages.every((page) => page.imageStatus === "prompt_ready")).toBe(true);

    const firstPrompt = await fs.readFile(
      path.join(root, "books", input.id, "prompts", "001.md"),
      "utf8",
    );
    const secondPrompt = await fs.readFile(
      path.join(root, "books", input.id, "prompts", "002.md"),
      "utf8",
    );
    expect(firstPrompt).toContain(input.pages[0]!.scene);
    expect(firstPrompt).toContain("CANONICAL MIAU IDENTITY");
    expect(firstPrompt).toContain("Средний план");
    expect(secondPrompt).toContain(input.pages[1]!.scene);
    expect(secondPrompt).not.toBe(firstPrompt);
  });

  it("materializes an 80-page approved story through one workflow", async () => {
    const root = await makeRoot();
    const pages = Array.from({ length: 80 }, (_, index) => ({
      text: `Утверждённый текст страницы ${index + 1}.`,
      scene: `Уникальная видимая сцена ${index + 1}: Мяу выполняет действие ${index + 1}.`,
      characterIds: ["miau"],
    }));
    const report = await materializeApprovedStory(
      {
        ...basicPackage(),
        id: "long-approved-story",
        title: "Длинная утверждённая история",
        pages,
      },
      { contentRoot: root, today: "2026-08-29" },
    );

    expect(report.pageCount).toBe(80);
    expect(report.promptCount).toBe(80);
    const library = await loadLibrary({ contentRoot: root });
    const book = library.books.find((item) => item.id === "long-approved-story");
    expect(book?.pages).toHaveLength(80);
    expect(book?.pages[79]?.text).toBe("Утверждённый текст страницы 80.");
    expect(
      await fs.readFile(path.join(root, "books", "long-approved-story", "prompts", "080.md"), "utf8"),
    ).toContain("Уникальная видимая сцена 80");
  });

  it("reuses an existing canonical character even if the package contains conflicting identity fields", async () => {
    const root = await makeRoot();
    const report = await materializeApprovedStory(
      {
        ...basicPackage(),
        characters: [
          {
            id: "miau",
            name: "Wrong replacement",
            type: "robot",
            narrativeDescription: "Should not replace canonical Miau.",
            identity: "WRONG IDENTITY",
          },
        ],
      },
      { contentRoot: root, today: "2026-08-29" },
    );

    expect(report.characters[0]?.source).toBe("reused");
    const canonical = await fs.readFile(path.join(root, "characters", "miau", "character.json"), "utf8");
    expect(canonical).toContain("CANONICAL MIAU IDENTITY");
    expect(canonical).not.toContain("WRONG IDENTITY");
    const prompt = await fs.readFile(
      path.join(root, "books", "miau-brushes-teeth", "prompts", "001.md"),
      "utf8",
    );
    expect(prompt).toContain("CANONICAL MIAU IDENTITY");
    expect(prompt).not.toContain("WRONG IDENTITY");
  });

  it("creates a complete textual canonical definition for a new character", async () => {
    const root = await makeRoot();
    const report = await materializeApprovedStory(
      {
        schemaVersion: 1,
        id: "miau-meets-owl",
        title: "Мяу встречает Сову",
        age: { minMonths: 24, maxMonths: 36 },
        goal: { description: "Познакомить с новой спокойной ситуацией." },
        characters: [
          { id: "miau" },
          {
            id: "doctor-owl",
            name: "Доктор Сова",
            type: "animal",
            species: "owl",
            narrativeDescription: "Спокойная доброжелательная взрослая сова-врач.",
            identity: "Small friendly owl doctor with round glasses and stable proportions.",
            palette: ["soft brown", "cream"],
            fixedTraits: ["round glasses"],
            doNotChange: ["keep round glasses"],
          },
        ],
        pages: [
          {
            text: "Мяу увидел Доктора Сову.",
            scene: "Мяу спокойно встречает Доктора Сову в светлом кабинете.",
            characterIds: ["miau", "doctor-owl"],
          },
        ],
      },
      { contentRoot: root, today: "2026-08-29" },
    );

    expect(report.characters.find((item) => item.id === "doctor-owl")?.source).toBe("created");
    expect(report.warnings.join(" ")).toContain("doctor-owl");
    const character = JSON.parse(
      await fs.readFile(path.join(root, "characters", "doctor-owl", "character.json"), "utf8"),
    ) as { visual: { identity: string; fixedTraits: string[] }; references: unknown[] };
    expect(character.visual.identity).toContain("friendly owl doctor");
    expect(character.visual.fixedTraits).toEqual(["round glasses"]);
    expect(character.references).toEqual([]);
  });

  it("archives an existing book before an intentional replace", async () => {
    const root = await makeRoot();
    const input = basicPackage();
    await materializeApprovedStory(input, {
      contentRoot: root,
      today: "2026-08-29",
      now: "2026-08-29T20:00:00.000Z",
    });

    const replacement = {
      ...input,
      mode: "replace" as const,
      pages: [
        {
          text: "Новый утверждённый текст.",
          scene: "Новая утверждённая сцена.",
          characterIds: ["miau"],
        },
      ],
    };
    const report = await materializeApprovedStory(replacement, {
      contentRoot: root,
      today: "2026-08-30",
      now: "2026-08-30T10:11:12.000Z",
    });

    expect(report.archivedPreviousBook).toBe(
      "archive/agent-replaced-books/miau-brushes-teeth-2026-08-30T10-11-12-000Z",
    );
    expect(
      await fs.readFile(
        path.join(root, report.archivedPreviousBook!, "book.json"),
        "utf8",
      ),
    ).toContain("Мяу чистит зубки");
    const current = JSON.parse(
      await fs.readFile(path.join(root, "books", input.id, "book.json"), "utf8"),
    ) as { pages: Array<{ text: string }> };
    expect(current.pages).toHaveLength(1);
    expect(current.pages[0]?.text).toBe("Новый утверждённый текст.");
  });

  it("rejects an unknown new character before creating the book when its canonical definition is incomplete", async () => {
    const root = await makeRoot();
    await expect(
      materializeApprovedStory(
        {
          ...basicPackage(),
          id: "broken-character-story",
          characters: [{ id: "new-friend" }],
          pages: [
            {
              text: "Новый друг пришёл.",
              scene: "Новый друг рядом.",
              characterIds: ["new-friend"],
            },
          ],
        },
        { contentRoot: root },
      ),
    ).rejects.toThrow("needs name, type, narrativeDescription and identity");

    await expect(fs.access(path.join(root, "books", "broken-character-story"))).rejects.toThrow();
  });
});

