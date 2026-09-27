import { describe, expect, it } from "vitest";
import type { Book, Character } from "../content/schemas";
import {
  QWEN_BOOK_NEGATIVE_PROMPT,
  QWEN_CHILD_IDENTITY_NEGATIVE_PROMPT,
  composeQwenCharacterReferencePrompt,
  composeQwenEnvironmentReferencePrompt,
  composeQwenPagePrompt,
} from "./qwen-prompt";

const emi: Character = {
  schemaVersion: 1,
  id: "emi",
  name: "Эми",
  type: "human",
  species: "toddler girl",
  narrativeDescription: "Маленькая девочка.",
  visual: {
    identity: "Тёмные волосы, большие тёмные глаза, мягкие детские черты.",
    palette: ["cream", "soft pink"],
    fixedTraits: ["тёмные волосы", "детские пропорции"],
    doNotChange: ["не менять возраст"],
  },
  references: [],
};

const book: Book = {
  schemaVersion: 1,
  id: "cup-book",
  title: "Эми учится пить из чашки",
  language: "ru",
  age: { minMonths: 18, maxMonths: 24, label: "18–24 мес." },
  goal: {
    type: "independence",
    slug: "drink-from-open-cup",
    description: "Учиться пить из чашки.",
  },
  characters: ["emi"],
  classification: {
    meanings: [],
    situations: [],
    collections: [],
    tags: [],
    custom: {},
  },
  references: [],
  status: "prompt_ready",
  createdAt: "2026-09-25",
  updatedAt: "2026-09-25",
  pages: [
    {
      number: 1,
      text: "У Эми есть чашка.",
      prompt: "prompts/001.md",
      characters: ["emi"],
      imageStatus: "prompt_ready",
    },
  ],
};

const rawPrompt = [
  "## Scene",
  "Эми сидит за маленьким столом и смотрит на чашку.",
  "",
  "## Environment",
  "Светлая домашняя кухня, простой стол.",
  "",
  "## Composition",
  "- Page-specific composition: Средний план, чашка хорошо видна.",
  "",
  "## Continuity",
  "- Page-specific continuity note: Та же одежда и та же чашка.",
  "",
  "## Style lock",
  "Тёплая мягкая книжная иллюстрация.",
].join("\n");

describe("Qwen prompt layer", () => {
  it("uses English-first character instructions and biases a toddler reference toward a warm expression", () => {
    const prompt = composeQwenCharacterReferencePrompt(emi);
    expect(prompt).toContain("Create one canonical character identity reference");
    expect(prompt).toContain("small natural smile");
    expect(prompt).toContain("bright attentive friendly eyes");
    expect(prompt).toContain("Canonical identity source: Тёмные волосы");
  });

  it("wraps the canonical environment source in English Qwen instructions", () => {
    const prompt = composeQwenEnvironmentReferencePrompt({
      book,
      pagePrompts: [rawPrompt],
    });
    expect(prompt).toContain("Create one canonical environment reference");
    expect(prompt).toContain("horizontal 16:9");
    expect(prompt).toContain("Светлая домашняя кухня");
    expect(prompt).toContain("Do not include characters");
  });

  it("wraps a page source brief in English and adds a default warm child expression", () => {
    const prompt = composeQwenPagePrompt({
      book,
      page: book.pages[0]!,
      rawPrompt,
      characters: [emi],
      referenceItems: [
        {
          kind: "environment",
          id: "environment",
          label: "canonical kitchen",
          role: "environment",
        },
        {
          kind: "external",
          id: "cup",
          label: "exact cup",
          role: "external",
        },
        {
          kind: "character",
          id: "emi",
          label: "canonical Emi identity",
          role: "identity",
        },
      ],
    });
    expect(prompt).toContain("Create one separate children's picture-book illustration");
    expect(prompt).toContain("Эми сидит за маленьким столом");
    expect(prompt).toContain("subtle natural smile");
    expect(prompt).toContain("SCENE ACTION IS THE HIGHEST PRIORITY");
    expect(prompt).toContain("<image1> is the canonical ENVIRONMENT/STYLE anchor");
    expect(prompt).toContain("<image2> is an EXACT OBJECT identity anchor (exact cup)");
    expect(prompt).toContain("<image3> is a CHARACTER IDENTITY-ONLY anchor");
    expect(prompt).toContain("DO NOT copy its pose, stance, hand position");
    expect(prompt).toContain("Do not fall back to a neutral front-facing standing pose");
    expect(prompt).toContain("No visible text");
  });

  it("keeps story-page negative conditioning structural and child identity conditioning stronger", () => {
    expect(QWEN_BOOK_NEGATIVE_PROMPT).toContain("duplicate character");
    expect(QWEN_BOOK_NEGATIVE_PROMPT).not.toContain("sad expression");
    expect(QWEN_BOOK_NEGATIVE_PROMPT).toContain("character pasted over background");
    expect(QWEN_CHILD_IDENTITY_NEGATIVE_PROMPT).toContain("sad expression");
    expect(QWEN_CHILD_IDENTITY_NEGATIVE_PROMPT).toContain("crying");
    expect(QWEN_CHILD_IDENTITY_NEGATIVE_PROMPT).toContain("underwear-only outfit");
  });
});
