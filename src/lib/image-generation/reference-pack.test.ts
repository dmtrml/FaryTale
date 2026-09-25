import { describe, expect, it } from "vitest";
import { bookSchema, characterSchema } from "../content/schemas";
import {
  assertQwenReferenceLimit,
  availableReferencePackItems,
  buildReferencePackPlan,
} from "./reference-pack";

function character(id: string) {
  return characterSchema.parse({
    schemaVersion: 1,
    id,
    name: id.toUpperCase(),
    type: "human",
    narrativeDescription: "Character.",
    visual: { identity: "Stable.", palette: [], fixedTraits: [], doNotChange: [] },
    references: [{ id: "canonical", path: "refs/canonical.png", role: "identity" }],
  });
}

function book() {
  return bookSchema.parse({
    schemaVersion: 1,
    id: "sample",
    title: "Sample",
    language: "ru",
    age: { minMonths: 18, maxMonths: 24, label: "18–24" },
    goal: { type: "habit", slug: "sample", description: "Sample" },
    characters: ["emi"],
    references: [
      { id: "environment", path: "refs/environment.png", role: "environment" },
      { id: "spoon", path: "refs/external/spoon.png", role: "external" },
    ],
    status: "prompt_ready",
    createdAt: "2026-09-25",
    updatedAt: "2026-09-25",
    authoring: {
      skill: "childrens-story-creator-v1",
      ageBand: "18-24m",
      storyPattern: "habit-routine",
      externalReferences: [
        { id: "plate", label: "точная детская тарелка" },
        { id: "spoon", label: "точная детская ложка", instruction: "Не менять форму." },
      ],
      outline: [{ pageNumber: 1, beat: "Scene" }],
    },
    pages: [{ number: 1, text: "Scene", characters: ["emi"], imageStatus: "prompt_ready" }],
  });
}

describe("reference pack", () => {
  it("keeps character, environment and declared external references in deterministic order", () => {
    const plan = buildReferencePackPlan({ book: book(), characters: [character("emi")] });
    expect(plan.map((item) => [item.kind, item.id])).toEqual([
      ["character", "emi"],
      ["environment", "environment"],
      ["external", "plate"],
      ["external", "spoon"],
    ]);
    expect(plan[2]?.storage).toBeUndefined();
    expect(plan[3]?.storage?.providerPath).toBe("books/sample/refs/external/spoon.png");
    expect(availableReferencePackItems(plan).map((item) => item.id)).toEqual([
      "emi",
      "environment",
      "spoon",
    ]);
  });

  it("rejects more than ten available references instead of silently dropping them", () => {
    const sample = book();
    sample.references = [];
    const characters = Array.from({ length: 11 }, (_, index) => character(`c${index + 1}`));
    expect(() => assertQwenReferenceLimit(buildReferencePackPlan({ book: sample, characters }))).toThrow(
      "at most 10",
    );
  });
});
