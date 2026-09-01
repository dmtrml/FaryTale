import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function walkTypeScriptFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(root, entry.name);
      if (entry.isDirectory()) return walkTypeScriptFiles(full);
      return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
    }),
  );
  return files.flat();
}

describe("provider server boundary", () => {
  it("marks environment configuration as server-only", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "src", "lib", "providers", "server-config.ts"),
      "utf8",
    );
    expect(source).toContain('import "server-only"');
    expect(source).toContain("process.env.FARYTALE_IMAGE_PROVIDER");
    expect(source).toContain("process.env.FARYTALE_TEXT_API_KEY");
  });

  it("does not import server provider configuration from client components", async () => {
    const files = await walkTypeScriptFiles(path.join(process.cwd(), "src"));
    for (const file of files) {
      const source = await fs.readFile(file, "utf8");
      if (!source.trimStart().startsWith('"use client"') && !source.trimStart().startsWith("'use client'")) {
        continue;
      }
      expect(source, file).not.toContain("providers/server-config");
      expect(source, file).not.toContain("process.env.FARYTALE_");
      expect(source, file).not.toMatch(/process\.env\.[A-Z0-9_]*API_KEY/);
    }
  });
});
