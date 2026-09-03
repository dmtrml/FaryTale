import { describe, expect, it } from "vitest";
import type { Book, Character } from "../content/schemas";
import { composeChatBookPrompt, composeChatPagePrompt } from "./chat-image-prompt";

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
  it("flattens technical page markdown and explains attached references", () => {
    const result = composeChatPagePrompt({ book, page: book.pages[0]!, rawPrompt: prompt, characters: [character] });
    expect(result).toContain("референс 1 — каноническая внешность персонажа Эми");
    expect(result).toContain("референс 2 — каноническое окружение");
    expect(result).toContain("Сцена: Эми играет с крупными кубиками.");
    expect(result).toContain("Композиция: Эми и кубики крупные");
    expect(result).not.toContain("## Scene");
    expect(result).not.toContain("Generation metadata");
  });

  it("creates one copyable whole-book request for separate images", () => {
    const result = composeChatBookPrompt({ book, characters: [character], pagePrompts: [prompt, null] });
    expect(result).toContain("2 отдельных иллюстраций");
    expect(result).toContain("Не объединяй сцены в коллаж");
    expect(result).toContain("СТРАНИЦА 1.");
    expect(result).toContain("СТРАНИЦА 2.");
  });
});

