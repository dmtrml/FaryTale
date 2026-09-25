import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getCanonicalCharacter } from "../content/authoring";
import { getCanonicalBook } from "../content/mutations";
import type { ImageGenerationRequest, ImageProvider } from "../providers/contracts";
import {
  generateBookEnvironmentReference,
  generateCharacterIdentityReference,
} from "./reference-service";

const roots: string[] = [];

const squarePng = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10,
  0, 0, 0, 13, 73, 72, 68, 82,
  0, 0, 0, 16, 0, 0, 0, 16,
]);

const widePng = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10,
  0, 0, 0, 13, 73, 72, 68, 82,
  0, 0, 0, 16, 0, 0, 0, 9,
]);

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "farytale-reference-generation-"));
  roots.push(root);
  await fs.mkdir(path.join(root, "characters", "emi"), { recursive: true });
  await fs.mkdir(path.join(root, "books", "cup-book", "prompts"), { recursive: true });
  await fs.writeFile(
    path.join(root, "characters", "emi", "character.json"),
    JSON.stringify({
      schemaVersion: 1,
      id: "emi",
      name: "Эми",
      type: "human-child",
      species: "toddler girl",
      narrativeDescription: "Маленькая девочка.",
      visual: {
        identity: "Тёмные волосы, большие тёмные глаза, мягкие детские черты.",
        palette: ["cream", "soft pink"],
        fixedTraits: ["тёмные волосы"],
        doNotChange: ["не менять возраст"],
      },
      references: [],
    }),
  );
  await fs.writeFile(
    path.join(root, "books", "cup-book", "book.json"),
    JSON.stringify({
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
      references: [],
      status: "prompt_ready",
      createdAt: "2026-09-25",
      updatedAt: "2026-09-25",
      authoring: {
        skill: "childrens-story-creator-v1",
        ageBand: "18-24m",
        storyPattern: "independence-trying",
        visualStyle: "Тёплая мягкая книжная иллюстрация.",
        outline: [{ pageNumber: 1, beat: "Эми сидит за столом с чашкой." }],
      },
      pages: [
        {
          number: 1,
          text: "У Эми есть чашка.",
          prompt: "prompts/001.md",
          characters: ["emi"],
          imageStatus: "prompt_ready",
        },
      ],
    }),
  );
  await fs.writeFile(
    path.join(root, "books", "cup-book", "prompts", "001.md"),
    "# Illustration prompt\n\n## Environment\nСветлая домашняя кухня и небольшой стол.\n",
  );
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("canonical reference generation", () => {
  it("generates a square character image and makes it the canonical identity reference", async () => {
    const root = await fixture();
    let captured: ImageGenerationRequest | undefined;
    const provider: ImageProvider = {
      id: "fake",
      async generate(request) {
        captured = request;
        return {
          kind: "generated",
          imageStatus: "ready",
          bytes: squarePng,
          mimeType: "image/png",
          metadata: { provider: "fake", requestId: "character-ref" },
        };
      },
    };

    const generated = await generateCharacterIdentityReference({
      characterId: "emi",
      provider,
      contentRoot: root,
    });

    expect(captured?.mode).toBe("generate");
    expect(captured?.size).toEqual({ width: 1024, height: 1024 });
    expect(captured?.references).toBeUndefined();
    expect(captured?.prompt).toContain("каноническое изображение персонажа «Эми»");
    const character = await getCanonicalCharacter("emi", root);
    const identity = character?.references.find((reference) => reference.role === "identity");
    expect(identity?.id).toBe(generated.referenceId);
    expect(identity?.path).toBe(generated.relativePath);
    await expect(
      fs.access(path.join(root, "characters", "emi", ...generated.relativePath.split("/"))),
    ).resolves.toBeUndefined();
  });

  it("generates and saves a canonical 16:9 environment reference", async () => {
    const root = await fixture();
    let captured: ImageGenerationRequest | undefined;
    const provider: ImageProvider = {
      id: "fake",
      async generate(request) {
        captured = request;
        return {
          kind: "generated",
          imageStatus: "ready",
          bytes: widePng,
          mimeType: "image/png",
          metadata: { provider: "fake", requestId: "environment-ref" },
        };
      },
    };

    const generated = await generateBookEnvironmentReference({
      bookId: "cup-book",
      provider,
      contentRoot: root,
    });

    expect(captured?.mode).toBe("generate");
    expect(captured?.size).toEqual({ width: 1024, height: 576 });
    expect(captured?.prompt).toContain("канонический референс окружения");
    expect(captured?.prompt).toContain("Светлая домашняя кухня");
    const book = await getCanonicalBook("cup-book", root);
    expect(book?.references).toContainEqual({
      id: "environment",
      path: generated.relativePath,
      role: "environment",
    });
  });

  it("rejects a provider that only defers instead of returning image bytes", async () => {
    const root = await fixture();
    const provider: ImageProvider = {
      id: "manual-like",
      async generate(request) {
        return {
          kind: "deferred",
          imageStatus: "prompt_ready",
          prompt: request.prompt,
          metadata: { provider: "manual-like" },
        };
      },
    };

    await expect(
      generateCharacterIdentityReference({
        characterId: "emi",
        provider,
        contentRoot: root,
      }),
    ).rejects.toThrow("returns image bytes");
  });
});
