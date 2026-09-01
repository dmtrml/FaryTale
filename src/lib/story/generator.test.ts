import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadLibrary } from "../content/loader";
import { prepareManualStoryDraft } from "./generator";
import { recommendStoryPattern, selectAgeBand } from "./rules";

const roots: string[] = [];

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "farytale-story-"));
  roots.push(root);
  await fs.mkdir(path.join(root, "books", "wash-book"), { recursive: true });
  await fs.mkdir(path.join(root, "characters", "miau"), { recursive: true });
  await fs.writeFile(
    path.join(root, "characters", "miau", "character.json"),
    JSON.stringify({
      schemaVersion: 1,
      id: "miau",
      name: "Котёнок Мяу",
      type: "animal",
      species: "kitten",
      narrativeDescription: "Добрый маленький котёнок.",
      visual: {
        identity: "Canonical Miau identity.",
        palette: [],
        fixedTraits: [],
        doNotChange: ["Do not redesign Miau."],
      },
      references: [],
    }),
  );
  await fs.writeFile(
    path.join(root, "books", "wash-book", "book.json"),
    JSON.stringify({
      schemaVersion: 1,
      id: "wash-book",
      title: "Мяу моет лапки",
      language: "ru",
      age: { minMonths: 18, maxMonths: 24, label: "18–24 мес." },
      goal: { type: "habit", slug: "wash", description: "Мыть лапки перед едой." },
      characters: [],
      status: "draft",
      createdAt: "2026-08-29",
      updatedAt: "2026-08-29",
      pages: Array.from({ length: 5 }, (_, index) => ({
        number: index + 1,
        text: "",
        characters: [],
        imageStatus: "missing",
      })),
    }),
  );
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("story skill rules", () => {
  it("selects the simpler toddler band and habit pattern for the sample goal", () => {
    expect(selectAgeBand(18, 24).id).toBe("18-24m");
    expect(recommendStoryPattern("habit", "Мыть лапки перед едой")).toBe("habit-routine");
  });
});

describe("prepareManualStoryDraft", () => {
  it("saves outline, reuses canonical character, and writes one prompt per page", async () => {
    const root = await fixture();
    const book = await prepareManualStoryDraft({
      contentRoot: root,
      bookId: "wash-book",
      storyPattern: "habit-routine",
      characterId: "miau",
      visualStyle: "Warm simple picture-book style.",
      today: "2026-08-29",
    });

    expect(book.authoring?.ageBand).toBe("18-24m");
    expect(book.authoring?.storyPattern).toBe("habit-routine");
    expect(book.authoring?.outline).toHaveLength(5);
    expect(book.characters).toEqual(["miau"]);
    expect(book.pages.every((page) => page.imageStatus === "prompt_ready")).toBe(true);
    expect(book.pages.every((page) => page.characters.includes("miau"))).toBe(true);

    const prompt = await fs.readFile(path.join(root, "books", "wash-book", "prompts", "001.md"), "utf8");
    expect(prompt).toContain("Canonical Miau identity.");
    expect(prompt).toContain("No text, letters, logos, watermarks");
    expect(prompt).toContain("provider: manual");

    const library = await loadLibrary({ contentRoot: root });
    expect(library.books.find((item) => item.id === "wash-book")?.authoring?.skill).toBe(
      "childrens-story-creator-v1",
    );
  });
});
