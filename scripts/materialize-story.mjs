import { readFile } from "node:fs/promises";
import process from "node:process";

function usage() {
  console.error(
    "Usage: node scripts/materialize-story.mjs <approved-story.json> [--base-url http://127.0.0.1:3000]",
  );
}

const args = process.argv.slice(2);
const inputPath = args[0];
if (!inputPath) {
  usage();
  process.exit(2);
}
const baseUrlIndex = args.indexOf("--base-url");
const baseUrl =
  (baseUrlIndex >= 0 ? args[baseUrlIndex + 1] : undefined) ??
  process.env.FARYTALE_AGENT_BASE_URL ??
  "http://127.0.0.1:3000";

const payload = await readFile(inputPath, "utf8");
let parsed;
try {
  parsed = JSON.parse(payload);
} catch {
  console.error(`Invalid JSON: ${inputPath}`);
  process.exit(2);
}

let response;
try {
  response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/parent/agent/materialize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: "farytale-parent=1",
    },
    body: JSON.stringify(parsed),
  });
} catch (error) {
  console.error(
    `Unable to reach FaryTale at ${baseUrl}. Start the local app first (the agent should do this, not the parent).`,
  );
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const body = await response.text();
if (!response.ok) {
  console.error(`Materialization failed with HTTP ${response.status}: ${body}`);
  process.exit(1);
}

try {
  console.log(JSON.stringify(JSON.parse(body), null, 2));
} catch {
  console.log(body);
}

