import type { Character } from "../content/schemas";

const requiredSections = [
  "## Scene",
  "## Characters",
  "## Environment",
  "## Composition",
  "## Style lock",
  "## Continuity",
  "## Negative constraints",
  "## Generation metadata",
];

function countExact(haystack: string, needle: string) {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

export function assessIllustrationPrompt(prompt: string, characters: Character[]) {
  const issues: string[] = [];
  for (const section of requiredSections) {
    if (!prompt.includes(section)) issues.push(`Missing prompt section: ${section}`);
  }
  for (const character of characters) {
    const count = countExact(prompt, character.visual.identity);
    if (count !== 1) {
      issues.push(`Canonical identity for ${character.id} must appear exactly once; found ${count}.`);
    }
  }
  if (!prompt.includes("No text, letters, logos, watermarks")) {
    issues.push("Missing no-text/watermark constraint.");
  }
  return issues;
}

export function assertIllustrationPromptQuality(prompt: string, characters: Character[]) {
  const issues = assessIllustrationPrompt(prompt, characters);
  if (issues.length) throw new Error(`Illustration prompt quality check failed: ${issues.join(" ")}`);
}
