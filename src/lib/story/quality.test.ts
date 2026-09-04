import { describe, expect, it } from "vitest";
import type { Book, Character } from "../content/schemas";
import { selectCanonicalIdentityReference } from "../characters/identity";
import { composeIllustrationPrompt } from "./prompt";
import { assessIllustrationPrompt } from "./quality";
import { selectAgeBand } from "./rules";

const character: Character = {
  schemaVersion: 1,
  id: "miau",
  name: "Мяу",
  type: "animal",
  species: "kitten",
  narrativeDescription: "Котёнок.",
  visual: {
    identity: "Small cream kitten with round green eyes.",
    palette: ["cream"],
    fixedTraits: ["round green eyes"],
    doNotChange: ["Do not change fur color."],
  },
  references: [
    { id: "pose", path: "refs/pose.png", role: "pose" },
    { id: "canonical", path: "refs/canonical.png", role: "identity" },
  ],
};

const book: Book = {
  schemaVersion: 1,
  id: "quality-book",
  title: "Quality",
  language: "ru",
  age: { minMonths: 18, maxMonths: 24, label: "18–24" },
  goal: { type: "habit", slug: "quality", description: "Goal" },
  characters: ["miau"],
  classification: { meanings: [], situations: [], collections: [], tags: [], custom: {} },
  references: [],
  status: "prompt_ready",
  createdAt: "2026-08-29",
  updatedAt: "2026-08-29",
  authoring: {
    skill: "childrens-story-creator-v1",
    ageBand: "18-24m",
    storyPattern: "habit-routine",
    visualStyle: "Warm watercolor, simple uncluttered backgrounds.",
    outline: [{ pageNumber: 1, beat: "Miau washes paws." }],
  },
  pages: [{ number: 1, text: "Мяу моет лапки.", characters: ["miau"], imageStatus: "prompt_ready" }],
};

describe("character identity and prompt quality", () => {
  it("selects the explicit identity reference before other references", () => {
    expect(selectCanonicalIdentityReference(character)?.id).toBe("canonical");
  });

  it("composes a prompt with canonical identity exactly once", () => {
    const prompt = composeIllustrationPrompt({
      book,
      pageNumber: 1,
      beat: "Miau washes paws.",
      ageRule: selectAgeBand(18, 24),
      characters: [character],
    });
    expect(assessIllustrationPrompt(prompt, [character])).toEqual([]);
    expect(prompt.split(character.visual.identity).length - 1).toBe(1);
    expect(prompt).toContain("fixed trait: round green eyes");
    expect(prompt).toContain("../../../characters/miau/refs/canonical.png");
  });

  it("flags duplicated canonical identity text", () => {
    const prompt = composeIllustrationPrompt({
      book,
      pageNumber: 1,
      beat: "Miau washes paws.",
      ageRule: selectAgeBand(18, 24),
      characters: [character],
    });
    expect(assessIllustrationPrompt(`${prompt}\n${character.visual.identity}`, [character])[0]).toContain(
      "exactly once",
    );
  });
});
