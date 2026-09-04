import { describe, expect, it } from "vitest";
import type { Book, Character } from "../content/schemas";
import { composeChatBookPrompt, composeChatEnvironmentPrompt, composeChatPagePrompt } from "./chat-image-prompt";

const character: Character = {
  schemaVersion: 1,
  id: "emi",
  name: "Эми",
  type: "human",
  narrativeDescription: "История не должна попадать в визуальный промпт.",
  visual: {
    identity: "Тёмноволосая маленькая девочка.",
    palette: [],
    fixedTraits: ["тёмные волосы"],
    doNotChange: ["не менять возраст"],
  },
  references: [{ id: "identity", path: "refs/emi.png", role: "identity" }],
};

const book: Book = {
  schemaVersion: 1,
  id: "emi-book",
  title: "Эми и её горшок",
  language: "ru",
  age: { minMonths: 18, maxMonths: 24, label: "18–24 мес." },
  goal: { type: "habit", slug: "potty", description: "Горшок" },
  characters: ["emi"],
  classification: { meanings: [], situations: [], collections: [], tags: [], custom: {} },
  references: [{ id: "environment", path: "refs/room.png", role: "environment" }],
  status: "prompt_ready",
  createdAt: "2026-09-01",
  updatedAt: "2026-09-03",
  pages: [
    { number: 1, text: "Эми играет.", characters: ["emi"], imageStatus: "prompt_ready" },
    { number: 2, text: "Эми идёт к горшку.", characters: ["emi"], imageStatus: "prompt_ready" },
  ],
};

const prompt = `# Illustration prompt

## Scene
Эми играет с крупными кубиками.

Read-aloud text already approved for this page: “Эми играет.”

## Environment
Та же уютная детская комната, кубики рядом.

## Composition
- One dominant event.
- Page-specific composition: Эми и кубики крупные, один главный фокус.

## Style lock
Тёплая мягкая иллюстрация для ребёнка 1–3 лет.

## Continuity
- Preserve identity.
- Page-specific continuity note: тот же красный кубик слева.

## Negative constraints
- No text.
`;

describe("manual ChatGPT Image prompts", () => {
  it("creates a separate canonical environment-reference prompt", () => {
    const result = composeChatEnvironmentPrompt({ book, pagePrompts: [prompt, null] });
    expect(result).toContain("канонический референс окружения");
    expect(result).toContain("горизонтальный 16:9");
    expect(result).toContain("кубики рядом");
    expect(result).toContain("не изображай персонажей");
    expect(result).not.toContain("## Environment");
  });

  it("flattens technical page markdown and explains attached references", () => {
    const result = composeChatPagePrompt({ book, page: book.pages[0]!, rawPrompt: prompt, characters: [character] });
    expect(result).toContain("референс 1 — каноническая внешность персонажа Эми");
    expect(result).toContain("референс 2 — каноническое окружение");
    expect(result).toContain("Сцена: Эми играет с крупными кубиками.");
    expect(result).toContain("горизонтальный 16:9");
    expect(result).toContain("Композиция: Эми и кубики крупные");
    expect(result).not.toContain("## Scene");
    expect(result).not.toContain("Generation metadata");
  });

  it("adds a neutral child-safe visual instruction for child characters", () => {
    const childCharacter = { ...character, type: "human-child" };
    const result = composeChatPagePrompt({ book, page: book.pages[0]!, rawPrompt: prompt, characters: [childCharacter] });
    expect(result).toContain("нейтральном бытовом контексте");
    expect(result).toContain("Композиция должна быть простой и учебной");
    expect(result).toContain("фокус на лице, волосах и ключевом предмете действия");
  });

  it("creates one copyable whole-book request for separate images", () => {
    const result = composeChatBookPrompt({ book, characters: [character], pagePrompts: [prompt, null] });
    expect(result).toContain("2 отдельных иллюстраций");
    expect(result).toContain("Не объединяй сцены в коллаж");
    expect(result).toContain("Каждое из 2 изображений должно быть строго в горизонтальном формате 16:9");
    expect(result).toContain("СТРАНИЦА 1.");
    expect(result).toContain("СТРАНИЦА 2.");
  });

  it("uses a minimal page-only prompt for the hair-wash routine", () => {
    const hairBook = {
      ...book,
      title: "Эми моет голову в душе",
      goal: { ...book.goal, slug: "wash-hair-in-shower" },
    };
    const hairPrompt = prompt
      .replace("Эми играет с крупными кубиками.", "Эми наклоняет голову назад. Рядом видна ручная лейка.")
      .replace("Та же уютная детская комната, кубики рядом.", "Светлый плиточный фон, ручная лейка на гибком шланге.")
      .replace("Эми и кубики крупные, один главный фокус.", "Кадр от плеч и выше, лицо, волосы и лейка крупные.");
    const result = composeChatPagePrompt({
      book: hairBook,
      page: hairBook.pages[0]!,
      rawPrompt: hairPrompt,
      characters: [character],
    });
    expect(result).toContain("горизонтальную книжную иллюстрацию 16:9");
    expect(result).toContain("Используй приложенный референс Эми");
    expect(result).toContain("ручная лейка");
    expect(result).not.toContain("детской книги");
    expect(result).not.toContain("ребён");
    expect(result).not.toContain("душ");
    expect(result).not.toContain("мама");
  });
});

