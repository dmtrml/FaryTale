import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { TextProvider } from "../providers/contracts";
import { getCanonicalBook, readBookPagePrompt } from "../content/mutations";
import { runStudioMessage } from "./orchestrator";

const roots: string[] = [];

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "farytale-studio-"));
  roots.push(root);
  await fs.mkdir(path.join(root, "books"), { recursive: true });
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
      visual: { identity: "Stable Miau.", palette: [], fixedTraits: [], doNotChange: [] },
      references: [],
    }),
  );
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("Studio local orchestrator", () => {
  it("creates and revises canonical book state through explicit tools", async () => {
    const root = await fixture();
    const options = { contentRoot: root, today: "2026-08-29" };

    const created = await runStudioMessage(
      "/create bath-time | Мяу и ванна | Спокойная вечерняя рутина | 18 | 24 | 5",
      options,
    );
    expect(created.tool).toBe("create_book");

    await runStudioMessage("/page bath-time 1 Мяу идёт в ванную.", options);
    await runStudioMessage("/outline bath-time habit-routine miau", options);
    await runStudioMessage("/prompt bath-time 1", options);

    const book = await getCanonicalBook("bath-time", root);
    expect(book?.pages[0]?.text).toBe("Мяу идёт в ванную.");
    expect(book?.authoring?.storyPattern).toBe("habit-routine");
    expect(book?.pages[0]?.imageStatus).toBe("prompt_ready");
    expect(await readBookPagePrompt({ bookId: "bath-time", pageNumber: 1, contentRoot: root })).toContain(
      "Stable Miau.",
    );
  });

  it("does not expose a filesystem/path command", async () => {
    const root = await fixture();
    const result = await runStudioMessage("/read ../../AGENTS.md", { contentRoot: root });
    expect(result.tool).toBe("unrecognized");
  });

  it("accepts simple parent-facing natural-language list requests without a text provider", async () => {
    const root = await fixture();
    const result = await runStudioMessage("Покажи мои книги", { contentRoot: root });
    expect(result.tool).toBe("list_books");
  });

  it("gives a friendly setup explanation for creative requests when no text provider is configured", async () => {
    const root = await fixture();
    const result = await runStudioMessage("Хочу создать новую сказку про уборку игрушек", {
      contentRoot: root,
    });
    expect(result.tool).toBe("conversation_unavailable");
    expect(result.text).toContain("текстовая модель");
    expect(result.text).toContain("ChatGPT");
  });

  it("exposes long-book and character authoring through explicit Studio tools", async () => {
    const root = await fixture();
    const options = { contentRoot: root, today: "2026-08-29" };
    await runStudioMessage(
      "/create long-book | Большая книга | Семейная история | 18 | 60 | 80",
      options,
    );
    await runStudioMessage("/insert long-book 41", options);
    await runStudioMessage("/duplicate long-book 1", options);
    await runStudioMessage("/move long-book 82 2", options);
    await runStudioMessage("/page-characters long-book 1 miau", options);
    await runStudioMessage(
      "/book-meta long-book | Большая семейная книга | ru | Новая цель | 12 | 72 | draft | miau",
      options,
    );
    const createdCharacter = await runStudioMessage(
      "/character-create luna | Луна | animal | kitten | Спокойная кошечка. | Белая кошечка.",
      options,
    );
    const updatedCharacter = await runStudioMessage(
      "/character-update luna | Луна | animal | kitten | Любопытная кошечка. | Белая кошечка с голубыми глазами.",
      options,
    );

    const book = await getCanonicalBook("long-book", root);
    expect(book?.pages).toHaveLength(82);
    expect(book?.title).toBe("Большая семейная книга");
    expect(book?.language).toBe("ru");
    expect(book?.characters).toContain("miau");
    expect(book?.pages[0]?.characters).toContain("miau");
    expect(createdCharacter.tool).toBe("create_character");
    expect(updatedCharacter.tool).toBe("update_character");
  });

  it("can use a configured text provider only to choose an allowed project command", async () => {
    const root = await fixture();
    const fakeProvider: TextProvider = {
      id: "fake-intent",
      async generate() {
        return {
          text: '{"command":"/characters"}',
          structured: { command: "/characters" },
          metadata: { provider: "fake-intent" },
        };
      },
    };

    const result = await runStudioMessage("Покажи персонажей", {
      contentRoot: root,
      textProvider: fakeProvider,
    });
    expect(result.tool).toBe("list_characters");
    expect(result.text).toContain("miau");
  });

  it("materializes a complete approved story through one high-level Studio command", async () => {
    const root = await fixture();
    const approvedStory = {
      schemaVersion: 1,
      id: "approved-studio-story",
      title: "Утверждённая история",
      age: { minMonths: 18, maxMonths: 24 },
      goal: { description: "Показать понятную последовательность действий." },
      characters: [{ id: "miau" }],
      pages: [
        {
          text: "Мяу увидел коробку.",
          scene: "Мяу стоит рядом с голубой коробкой и смотрит на неё.",
          characterIds: ["miau"],
        },
        {
          text: "Мяу положил игрушку внутрь.",
          scene: "Мяу аккуратно кладёт игрушку в голубую коробку.",
          characterIds: ["miau"],
        },
      ],
    };

    const result = await runStudioMessage(
      `/materialize-json ${JSON.stringify(approvedStory)}`,
      { contentRoot: root, today: "2026-08-29" },
    );
    const book = await getCanonicalBook("approved-studio-story", root);

    expect(result.tool).toBe("materialize_approved_story");
    expect(result.text).toContain("Промптов: 2/2");
    expect(book?.pages.map((page) => page.text)).toEqual([
      "Мяу увидел коробку.",
      "Мяу положил игрушку внутрь.",
    ]);
    expect(
      await readBookPagePrompt({
        bookId: "approved-studio-story",
        pageNumber: 2,
        contentRoot: root,
      }),
    ).toContain("Мяу аккуратно кладёт игрушку в голубую коробку.");
  });
});
