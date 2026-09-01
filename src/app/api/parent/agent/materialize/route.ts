import { hasParentMode } from "@/lib/parent/access";
import { materializeApprovedStory } from "@/lib/agent/materialize";

const MAX_AGENT_PACKAGE_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  if (!(await hasParentMode())) return new Response("Not found", { status: 404 });
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_AGENT_PACKAGE_BYTES) {
    return Response.json({ error: "ApprovedStoryPackage exceeds 2 MB." }, { status: 413 });
  }

  let value: unknown;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > MAX_AGENT_PACKAGE_BYTES) {
      return Response.json({ error: "ApprovedStoryPackage exceeds 2 MB." }, { status: 413 });
    }
    value = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid ApprovedStoryPackage JSON." }, { status: 400 });
  }

  try {
    const report = await materializeApprovedStory(value);
    return Response.json(report, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to materialize story." },
      { status: 400 },
    );
  }
}

