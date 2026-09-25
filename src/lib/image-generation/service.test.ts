import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getCanonicalBook, readBookPagePrompt, replaceBookPageImage } from "../content/mutations";
import type { ImageGenerationRequest, ImageProvider } from "../providers/contracts";
import { ManualImageProvider } from "../providers/manual-image";
import {
  editBookPageImage,
  generateBookPageImage,
  listBookPageImageHistory,
  restoreBookPageImageVersion,
} from "./service";

const roots: string[] = [];

function generatedPng() {
  return new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10,
    0, 0, 0, 13, 73, 72, 68, 82,
    0, 0, 0, 16, 0, 0, 0, 9,
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
    expect(captured?.size).toEqual({ width: 1920, height: 1080 });
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

  it("sends the book environment reference after canonical character references", async () => {
    const root = await fixture();
    await fs.mkdir(path.join(root, "books", "image-book", "refs"), { recursive: true });
    await fs.writeFile(path.join(root, "books", "image-book", "refs", "room.png"), Buffer.from([4, 5, 6]));
    const bookPath = path.join(root, "books", "image-book", "book.json");
    const raw = JSON.parse(await fs.readFile(bookPath, "utf8"));
    raw.references = [{ id: "environment", path: "refs/room.png", role: "environment" }];
    await fs.writeFile(bookPath, JSON.stringify(raw));
    let captured: ImageGenerationRequest | undefined;
    const provider: ImageProvider = {
      id: "reference-check",
      async generate(request) {
        captured = request;
        return {
          kind: "deferred",
          imageStatus: "prompt_ready",
          prompt: request.prompt,
          metadata: { provider: "reference-check" },
        };
      },
    };
    const result = await generateBookPageImage({
      bookId: "image-book",
      pageNumber: 1,
      provider,
      contentRoot: root,
    });
    expect(result.referencePaths).toEqual([
      "characters/miau/refs/canonical.png",
      "books/image-book/refs/room.png",
    ]);
    expect(captured?.references?.map((item) => item.role)).toEqual(["identity", "environment"]);
  });

  it("adds stored external object references after character and environment in declared order", async () => {
    const root = await fixture();
    await fs.mkdir(path.join(root, "books", "image-book", "refs", "external"), { recursive: true });
    await fs.mkdir(path.join(root, "books", "image-book", "refs"), { recursive: true });
    await fs.writeFile(path.join(root, "books", "image-book", "refs", "room.png"), Buffer.from([4, 5, 6]));
    await fs.writeFile(path.join(root, "books", "image-book", "refs", "external", "spoon.png"), Buffer.from([1, 4, 7]));
    await fs.writeFile(path.join(root, "books", "image-book", "refs", "external", "plate.png"), Buffer.from([2, 5, 8]));
    const bookPath = path.join(root, "books", "image-book", "book.json");
    const raw = JSON.parse(await fs.readFile(bookPath, "utf8"));
    raw.references = [
      { id: "environment", path: "refs/room.png", role: "environment" },
      { id: "plate", path: "refs/external/plate.png", role: "external" },
      { id: "spoon", path: "refs/external/spoon.png", role: "external" },
    ];
    raw.authoring = {
      skill: "childrens-story-creator-v1",
      ageBand: "18-24m",
      storyPattern: "habit-routine",
      externalReferences: [
        { id: "spoon", label: "Spoon" },
        { id: "plate", label: "Plate" },
      ],
      outline: [
        { pageNumber: 1, beat: "One" },
        { pageNumber: 2, beat: "Two" },
      ],
    };
    await fs.writeFile(bookPath, JSON.stringify(raw));
    let captured: ImageGenerationRequest | undefined;
    const provider: ImageProvider = {
      id: "reference-check",
      async generate(request) {
        captured = request;
        return {
          kind: "deferred",
          imageStatus: "prompt_ready",
          prompt: request.prompt,
          metadata: { provider: "reference-check" },
        };
      },
    };

    const result = await generateBookPageImage({
      bookId: "image-book",
      pageNumber: 1,
      provider,
      contentRoot: root,
    });

    expect(result.referencePaths).toEqual([
      "characters/miau/refs/canonical.png",
      "books/image-book/refs/room.png",
      "books/image-book/refs/external/spoon.png",
      "books/image-book/refs/external/plate.png",
    ]);
    expect(captured?.references?.map((item) => item.role)).toEqual([
      "identity",
      "environment",
      "external:spoon",
      "external:plate",
    ]);
    expect(captured?.prompt).toContain("референс 1 — каноническая внешность персонажа Мяу");
    expect(captured?.prompt).toContain("референс 2 — каноническое окружение");
    expect(captured?.prompt).toContain("референс 3 — Spoon");
    expect(captured?.prompt).toContain("референс 4 — Plate");
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

  it("restores a previous version while archiving the current image first", async () => {
    const root = await fixture();
    const current = new Uint8Array([...generatedPng(), 88]);
    const previous = new Uint8Array([...generatedPng(), 77]);
    await replaceBookPageImage({
      bookId: "image-book",
      pageNumber: 1,
      bytes: current,
      mimeType: "image/png",
      contentRoot: root,
    });
    const historyPath = "pages/history/001-older.png";
    const absoluteHistory = path.join(root, "books", "image-book", ...historyPath.split("/"));
    await fs.mkdir(path.dirname(absoluteHistory), { recursive: true });
    await fs.writeFile(absoluteHistory, previous);

    const restored = await restoreBookPageImageVersion({
      bookId: "image-book",
      pageNumber: 1,
      historyPath,
      contentRoot: root,
      now: "2026-09-25T14:30:00.000Z",
    });

    expect(restored.restoredFrom).toBe(historyPath);
    expect(restored.archivedCurrentPath).toBe(
      "pages/history/001-2026-09-25T14-30-00-000Z.png",
    );
    expect(
      await fs.readFile(path.join(root, "books", "image-book", restored.relativePath)),
    ).toEqual(Buffer.from(previous));
    expect(
      await fs.readFile(
        path.join(root, "books", "image-book", restored.archivedCurrentPath!),
      ),
    ).toEqual(Buffer.from(current));
    const prompt = await readBookPagePrompt({
      bookId: "image-book",
      pageNumber: 1,
      contentRoot: root,
    });
    expect(prompt).toContain("- provider: history-restore");
    expect(prompt).toContain(`restored_from: ${historyPath}`);
  });

  it("rejects restoring a history image belonging to another page", async () => {
    const root = await fixture();
    await expect(
      restoreBookPageImageVersion({
        bookId: "image-book",
        pageNumber: 1,
        historyPath: "pages/history/002-wrong.png",
        contentRoot: root,
      }),
    ).rejects.toThrow("Invalid page-image history path");
  });

  it("edits the current image as reference 1 and archives it only after a successful edit", async () => {
    const root = await fixture();
    const current = new Uint8Array([...generatedPng(), 11]);
    const edited = new Uint8Array([...generatedPng(), 22]);
    await replaceBookPageImage({
      bookId: "image-book",
      pageNumber: 1,
      bytes: current,
      mimeType: "image/png",
      contentRoot: root,
    });
    let captured: ImageGenerationRequest | undefined;
    const provider: ImageProvider = {
      id: "edit-provider",
      async generate(request) {
        captured = request;
        return {
          kind: "generated",
          imageStatus: "ready",
          bytes: edited,
          mimeType: "image/png",
          metadata: { provider: "edit-provider", model: "edit-v1", seed: 42 },
        };
      },
    };

    const result = await editBookPageImage({
      bookId: "image-book",
      pageNumber: 1,
      instruction: "Сделай мяч немного меньше.",
      provider,
      contentRoot: root,
      now: "2026-09-25T15:00:00.000Z",
    });

    expect(captured?.mode).toBe("edit");
    expect(captured?.editInstruction).toBe("Сделай мяч немного меньше.");
    expect(captured?.sourceImage?.role).toBe("edit-source");
    expect(Array.from(captured?.sourceImage?.bytes ?? [])).toEqual(Array.from(current));
    expect(captured?.references?.map((item) => item.role)).toEqual(["identity"]);
    expect(captured?.prompt).toContain(
      "референс 1 — текущая иллюстрация страницы 1, которую нужно редактировать",
    );
    expect(captured?.prompt).toContain(
      "референс 2 — каноническая внешность персонажа Мяу",
    );
    expect(captured?.prompt).toContain("Требуемая правка: Сделай мяч немного меньше.");
    expect(result.referencePaths[0]).toBe("books/image-book/pages/001.png");
    const history = await listBookPageImageHistory({
      bookId: "image-book",
      pageNumber: 1,
      contentRoot: root,
    });
    expect(history).toContain("pages/history/001-2026-09-25T15-00-00-000Z.png");
    expect(
      await fs.readFile(path.join(root, "books", "image-book", "pages", "001.png")),
    ).toEqual(Buffer.from(edited));
    const prompt = await readBookPagePrompt({
      bookId: "image-book",
      pageNumber: 1,
      contentRoot: root,
    });
    expect(prompt).toContain("- provider: edit-provider");
    expect(prompt).toContain("- seed: 42");
    expect(prompt).toContain("edit_instruction: Сделай мяч немного меньше.");
  });

  it("keeps the current image ready when an edit provider fails", async () => {
    const root = await fixture();
    const current = new Uint8Array([...generatedPng(), 33]);
    await replaceBookPageImage({
      bookId: "image-book",
      pageNumber: 1,
      bytes: current,
      mimeType: "image/png",
      contentRoot: root,
    });
    const provider: ImageProvider = {
      id: "edit-failure",
      async generate() {
        throw new Error("Edit failed upstream");
      },
    };

    await expect(
      editBookPageImage({
        bookId: "image-book",
        pageNumber: 1,
        instruction: "Измени только мяч.",
        provider,
        contentRoot: root,
      }),
    ).rejects.toThrow("Edit failed upstream");

    const book = await getCanonicalBook("image-book", root);
    expect(book?.pages[0]?.imageStatus).toBe("ready");
    expect(
      await fs.readFile(path.join(root, "books", "image-book", "pages", "001.png")),
    ).toEqual(Buffer.from(current));
    expect(
      await listBookPageImageHistory({
        bookId: "image-book",
        pageNumber: 1,
        contentRoot: root,
      }),
    ).toEqual([]);
  });
});
