import { describe, expect, it } from "vitest";
import { bookSchema, characterSchema } from "./schemas";

describe("canonical content schemas", () => {
  it("accepts a minimal valid v1 book", () => {
    const parsed = bookSchema.parse({
      schemaVersion: 1,
      id: "sample-book",
      title: "Sample Book",
      language: "en",
      age: { minMonths: 18, maxMonths: 24, label: "18–24 months" },
      goal: {
        type: "habit",
        slug: "sample-habit",
        description: "Show a simple routine.",
      },
      characters: [],
      classification: {
        meanings: ["hygiene"],
        situations: ["washing hands"],
        collections: [],
        tags: ["routine"],
        custom: { place: ["bathroom"] },
      },
      status: "draft",
      createdAt: "2026-08-29",
      updatedAt: "2026-08-29",
      pages: [],
    });

    expect(parsed.id).toBe("sample-book");
    expect(parsed.classification.custom.place).toEqual(["bathroom"]);
  });

  it("defaults classification for older v1 books that do not have it yet", () => {
    const parsed = bookSchema.parse({
      schemaVersion: 1,
      id: "legacy-book",
      title: "Legacy Book",
      language: "en",
      age: { minMonths: 18, maxMonths: 24, label: "18–24 months" },
      goal: { type: "habit", slug: "legacy", description: "Legacy content." },
      characters: [],
      status: "ready",
      createdAt: "2026-08-29",
      updatedAt: "2026-08-29",
      pages: [],
    });

    expect(parsed.classification).toEqual({
      meanings: [],
      situations: [],
      collections: [],
      tags: [],
      custom: {},
    });
  });

  it("rejects unsupported schema versions", () => {
    const result = characterSchema.safeParse({
      schemaVersion: 2,
      id: "sample",
      name: "Sample",
      type: "animal",
      narrativeDescription: "A sample character.",
      visual: {
        identity: "Stable sample identity.",
        palette: [],
        fixedTraits: [],
        doNotChange: [],
      },
      references: [],
    });

    expect(result.success).toBe(false);
  });
});
