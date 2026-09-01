import { hasParentMode } from "@/lib/parent/access";
import { buildBookExport } from "@/lib/export/package";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  if (!(await hasParentMode())) return new Response("Not found", { status: 404 });
  const { bookId } = await params;
  try {
    const zip = await buildBookExport(bookId);
    const body = new Uint8Array(zip.byteLength);
    body.set(zip);
    return new Response(body.buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${bookId}.farytale.zip"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Export failed.", { status: 404 });
  }
}
