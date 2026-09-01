import { hasParentMode } from "@/lib/parent/access";
import { importBookExport } from "@/lib/export/package";

const MAX_IMPORT_BYTES = 100 * 1024 * 1024;

export async function POST(request: Request) {
  if (!(await hasParentMode())) return new Response("Not found", { status: 404 });
  const formData = await request.formData();
  const file = formData.get("package");
  if (!(file instanceof File) || file.size < 1 || file.size > MAX_IMPORT_BYTES) {
    return new Response("Choose a FaryTale ZIP package up to 100 MB.", { status: 400 });
  }
  try {
    const book = await importBookExport(new Uint8Array(await file.arrayBuffer()));
    return Response.redirect(new URL(`/parent/books/${book.id}`, request.url), 303);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Import failed.", { status: 400 });
  }
}
