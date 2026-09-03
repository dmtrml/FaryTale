import { describe, expect, it } from "vitest";
import { composeCharacterGenerationPrompt } from "./prompt";

describe("composeCharacterGenerationPrompt", () => {
  it("turns structured character data into one copyable generation prompt", () => {
    const prompt = composeCharacterGenerationPrompt({
      schemaVersion: 1,
      id: "emi",
      name: "Эми",
      type: "human",
      species: "toddler girl",
      narrativeDescription: "Спокойная маленькая девочка учится пользоваться горшком",
      visual: {
        identity: "Тёмные волосы и большие тёмные глаза",
        palette: ["cream", "pink"],
        fixedTraits: ["тёмные волосы", "детские пропорции"],
        doNotChange: ["не менять цвет волос."],
      },
      references: [],
    });

    expect(prompt).toContain("Создай каноническое изображение персонажа «Эми».");
    expect(prompt).toContain("Тёмные волосы и большие тёмные глаза.");
    expect(prompt).toContain("Цветовая палитра: cream, pink.");
    expect(prompt).toContain("тёмные волосы; детские пропорции.");
    expect(prompt).toContain("не менять цвет волос.");
    expect(prompt).not.toContain("пользоваться горшком");
    expect(prompt).not.toContain(".;");
    expect(prompt).not.toContain("\n");
  });
});
