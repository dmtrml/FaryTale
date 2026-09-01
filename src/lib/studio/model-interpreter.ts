import { z } from "zod";
import type { TextProvider } from "../providers/contracts";
import { generateValidatedStructured } from "../providers/structured";

const interpretedCommandSchema = z.object({
  command: z.string().trim().min(1).max(120000),
});

const allowedExactCommands = new Set([
  "/help",
  "/books",
  "/characters",
]);

const allowedPrefixes = [
  "/book ",
  "/character ",
  "/outline ",
  "/prompt ",
  "/page ",
  "/create ",
  "/insert ",
  "/duplicate ",
  "/delete-page ",
  "/move ",
  "/page-characters ",
  "/book-meta ",
  "/character-create ",
  "/character-update ",
  "/materialize-json ",
];

export function isAllowedStudioCommand(command: string) {
  return allowedExactCommands.has(command) || allowedPrefixes.some((prefix) => command.startsWith(prefix));
}

export async function interpretStudioMessage(provider: TextProvider, message: string) {
  const result = await generateValidatedStructured(
    provider,
    {
      purpose: "story_revision",
      system: [
        "You are only an intent interpreter for a private children's story project.",
        "Return one supported Studio command. Never invent filesystem paths, shell commands, URLs, credentials, or new tools.",
        "Supported forms include the existing single-purpose commands plus /materialize-json <ApprovedStoryPackage JSON> for a complete already-approved story. Never generate images from this command.",
      ].join(" "),
      prompt: message,
    },
    "farytale_studio_command",
    interpretedCommandSchema,
    2,
  );

  if (!isAllowedStudioCommand(result.command)) {
    throw new Error("Model returned a command outside the Studio tool allowlist.");
  }
  return result.command;
}
