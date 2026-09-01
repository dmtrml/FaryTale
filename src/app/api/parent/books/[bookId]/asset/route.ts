import { promises as fs } from "node:fs";
import path from "node:path";
import { hasParentMode } from "@/lib/parent/access";
import { isSafeContentPath } from "@/lib/content/loader";
import { getCanonicalBook } from "@/lib/content/mutations";

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
  if (!(await hasParentMode())) return new Response("Not found", { status: 404 });
  const { bookId } = await params;
  const assetPath = new URL(request.url).searchParams.get("path");
  if (!assetPath || !isSafeContentPath(assetPath)) return new Response("Not found", { status: 404 });
  const book = await getCanonicalBook(bookId);
  if (!book) return new Response("Not found", { status: 404 });
  const allowedAssets = new Set([
    ...(book.cover ? [book.cover] : []),
    ...book.pages.flatMap((page) => page.image ? [page.image] : []),
  ]);
  if (!allowedAssets.has(assetPath)) return new Response("Not found", { status: 404 });
  const contentType = mimeTypes[path.extname(assetPath).toLowerCase()];
  if (!contentType) return new Response("Unsupported asset type", { status: 415 });
  try {
    const bytes = await fs.readFile(
      path.join(process.cwd(), "content", "books", bookId, ...assetPath.split("/")),
    );
    return new Response(bytes, {
      headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=300" },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Response("Not found", { status: 404 });
    return new Response("Unable to read asset", { status: 500 });
  }
}
