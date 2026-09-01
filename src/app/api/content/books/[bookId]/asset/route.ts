import { promises as fs } from "node:fs";
import path from "node:path";
import { loadLibrary, isSafeContentPath } from "@/lib/content/loader";

const mimeTypes: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await params;
  const assetPath = new URL(request.url).searchParams.get("path");

  if (!assetPath || !isSafeContentPath(assetPath)) {
    return new Response("Not found", { status: 404 });
  }

  const extension = path.extname(assetPath).toLowerCase();
  const contentType = mimeTypes[extension];
  if (!contentType) {
    return new Response("Unsupported asset type", { status: 415 });
  }

  const { books } = await loadLibrary();
  const book = books.find((item) => item.id === bookId && item.status === "ready");
  if (!book) {
    return new Response("Not found", { status: 404 });
  }

  const allowedAssets = new Set([
    ...(book.cover ? [book.cover] : []),
    ...book.pages.flatMap((page) => (page.image ? [page.image] : [])),
  ]);

  if (!allowedAssets.has(assetPath)) {
    return new Response("Not found", { status: 404 });
  }

  const absolutePath = path.join(
    process.cwd(),
    "content",
    "books",
    book.id,
    ...assetPath.split("/"),
  );

  try {
    const bytes = await fs.readFile(absolutePath);
    return new Response(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Response("Not found", { status: 404 });
    }
    return new Response("Unable to read asset", { status: 500 });
  }
}
