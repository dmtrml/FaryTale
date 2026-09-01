import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getCanonicalBook, readBookPagePrompt, replaceBookPageImage } from "../content/mutations";
import type { ImageGenerationRequest, ImageProvider } from "../providers/contracts";
import { ManualImageProvider } from "../providers/manual-image";
import { generateBookPageImage, listBookPageImageHistory } from "./service";

const roots: string[] = [];

function generatedPng() {
  return new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10,
    0, 0, 0, 13, 73, 72, 68, 82,
    0, 0, 4, 0, 0, 0, 4, 0,
  ]);
}

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "farytale-image-"));
  roots.push(root);
  await fs.mkdir(path.join(root, "books", "image-book", "prompts"), { recursive: true });
  await fs.mkdir(path.join(root, "characters", "miau", "refs"), { recursive: true });
  await fs.writeFile(path.join(root, "characters", "miau", "refs", "canonical.png"), Buffer.from([7, 8, 9]));
  await fs.writeFile(
    path.join(root, "characters", "miau", "character.json"),
    JSON.stringify({
      schemaVersion: 1,
      id: "miau",
      name: "Мяу",
      type: "animal",
      species: "kitten",
      narrativeDescription: "Котёнок.",
      visual: { identity: "Stable Miau.", palette: [], fixedTraits: [], doNotChange: [] },
      references: [{ id: "canonical", path: "refs/canonical.png", role: "identity" }],
    }),
  );
  const pages = [1, 2].map((number) => ({
    number,
    text: `Page ${number}`,
    prompt: `prompts/00${number}.md`,
    characters: ["miau"],
    imageStatus: "prompt_ready",
  }));
  await fs.writeFile(
    path.join(root, "books", "image-book", "book.json"),
    JSON.stringify({
      schemaVersion: 1,
      id: "image-book",
      title: "Image book",
      language: "ru",
      age: { minMonths: 18, maxMonths: 24, label: "18–24" },
      goal: { type: "habit", slug: "test", description: "Test" },
      characters: ["miau"],
      status: "prompt_ready",
      createdAt: "2026-08-29",
      updatedAt: "2026-08-29",
      pages,
    }),
  );
  await fs.writeFile(path.join(root, "books", "image-book", "prompts", "001.md"), "# Prompt one\n");
  await fs.writeFile(path.join(root, "books", "image-book", "prompts", "002.md"), "# Prompt two\n");
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("generateBookPageImage", () => {
  it("transitions only one page through generating to ready and sends canonical identity ref", async () => {
    const root = await fixture();
    let captured: ImageGenerationRequest | undefined;
    const provider: ImageProvider = {
      id: "fake-image",
      async generate(request) {
        captured = request;
        const during = await getCanonicalBook("image-book", root);
        expect(during?.pages[0]?.imageStatus).toBe("generating");
        expect(during?.pages[1]?.imageStatus).toBe("prompt_ready");
        return {
          kind: "generated",
          imageStatus: "ready",
          bytes: generatedPng(),
          mimeType: "image/png",
          metadata: { provider: "fake-image", model: "fake-v1", requestId: "req-7" },
        };
      },
    };

    const result = await generateBookPageImage({
      bookId: "image-book",
      pageNumber: 1,
      provider,
      contentRoot: root,
      now: "2026-08-29T18:00:00.000Z",
    });

    expect(result.referencePaths).toEqual(["characters/miau/refs/canonical.png"]);
    expect(captured?.references).toHaveLength(1);
    expect(Array.from(captured?.references?.[0]?.bytes ?? [])).toEqual([7, 8, 9]);
    const book = await getCanonicalBook("image-book", root);
    expect(book?.pages[0]?.imageStatus).toBe("ready");
    expect(book?.pages[0]?.image).toBe("pages/001.png");
    expect(book?.pages[1]?.imageStatus).toBe("prompt_ready");
    expect(book?.pages[1]?.image).toBeUndefined();
    const prompt = await readBookPagePrompt({ bookId: "image-book", pageNumber: 1, contentRoot: root });
    expect(prompt).toContain("- provider: fake-image");
    expect(prompt).toContain("- request_id: req-7");
  });

  it("marks only the requested page failed and leaves other pages recoverable", async () => {
    const root = await fixture();
    const provider: ImageProvider = {
      id: "failing-image",
      async generate() {
        throw new Error("HTTP 503");
      },
    };
    await expect(
      generateBookPageImage({ bookId: "image-book", pageNumber: 1, provider, contentRoot: root }),
    ).rejects.toThrow("HTTP 503");
    const book = await getCanonicalBook("image-book", root);
    expect(book?.pages[0]?.imageStatus).toBe("failed");
    expect(book?.pages[1]?.imageStatus).toBe("prompt_ready");
  });

  it("keeps manual mode prompt_ready without producing image bytes", async () => {
    const root = await fixture();
    await generateBookPageImage({
      bookId: "image-book",
      pageNumber: 1,
      provider: new ManualImageProvider(),
      contentRoot: root,
    });
    const book = await getCanonicalBook("image-book", root);
    expect(book?.pages[0]?.imageStatus).toBe("prompt_ready");
    expect(book?.pages[0]?.image).toBeUndefined();
  });

  it("archives the previous ready image before a successful regeneration", async () => {
    const root = await fixture();
    await replaceBookPageImage({
      bookId: "image-book",
      pageNumber: 1,
      bytes: generatedPng(),
      mimeType: "image/png",
      contentRoot: root,
    });
    const provider: ImageProvider = {
      id: "replacement",
      async generate() {
        return {
          kind: "generated",
          imageStatus: "ready",
          bytes: generatedPng(),
          mimeType: "image/png",
          metadata: { provider: "replacement" },
        };
      },
    };
    await generateBookPageImage({
      bookId: "image-book",
      pageNumber: 1,
      provider,
      contentRoot: root,
      now: "2026-08-29T18:15:00.000Z",
    });
    const history = await listBookPageImageHistory({ bookId: "image-book", pageNumber: 1, contentRoot: root });
    expect(history).toEqual(["pages/history/001-2026-08-29T18-15-00-000Z.png"]);
    expect(await fs.readFile(path.join(root, "books", "image-book", history[0]!))).toEqual(Buffer.from(generatedPng()));
    const prompt = await readBookPagePrompt({ bookId: "image-book", pageNumber: 1, contentRoot: root });
    expect(prompt).toContain(`- previous_image: ${history[0]}`);
  });
});
