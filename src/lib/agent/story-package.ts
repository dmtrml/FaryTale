import { z } from "zod";
import { MAX_BOOK_PAGES } from "../content/authoring";
import {
  bookClassificationSchema,
  createEmptyBookClassification,
  storyPatternSchema,
} from "../content/schemas";

const contentIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Expected a lowercase kebab-case id");

export const approvedStoryCharacterSchema = z.object({
  id: contentIdSchema,
  name: z.string().trim().min(1).max(160).optional(),
  type: z.string().trim().min(1).max(80).optional(),
  species: z.string().trim().min(1).max(120).optional(),
  narrativeDescription: z.string().trim().min(1).max(1000).optional(),
  identity: z.string().trim().min(1).max(2000).optional(),
  palette: z.array(z.string().trim().min(1).max(160)).max(40).default([]),
  fixedTraits: z.array(z.string().trim().min(1).max(300)).max(60).default([]),
  doNotChange: z.array(z.string().trim().min(1).max(300)).max(60).default([]),
});

export const approvedStoryPageSchema = z.object({
  text: z.string().max(2000),
  scene: z.string().trim().min(1).max(4000).optional(),
  characterIds: z.array(contentIdSchema).max(30).optional(),
  environment: z.string().trim().min(1).max(2000).optional(),
  composition: z.string().trim().min(1).max(2000).optional(),
  continuityNotes: z.string().trim().min(1).max(2000).optional(),
});

export const approvedStoryPackageSchema = z
  .object({
    schemaVersion: z.literal(1),
    mode: z.enum(["create", "replace"]).default("create"),
    id: contentIdSchema,
    title: z.string().trim().min(1).max(160),
    language: z.string().trim().min(2).max(35).default("ru"),
    age: z
      .object({
        minMonths: z.number().int().min(0).max(144),
        maxMonths: z.number().int().min(0).max(144),
      })
      .refine((age) => age.minMonths <= age.maxMonths, {
        message: "minMonths must not exceed maxMonths",
        path: ["maxMonths"],
      }),
    goal: z.object({
      description: z.string().trim().min(1).max(500),
      type: z.string().trim().min(1).max(80).optional(),
      slug: z.string().trim().min(1).max(120).optional(),
    }),
    classification: bookClassificationSchema.default(createEmptyBookClassification),
    storyPattern: storyPatternSchema.optional(),
    visualStyle: z.string().trim().min(1).max(1200).optional(),
    characters: z.array(approvedStoryCharacterSchema).max(50).default([]),
    pages: z.array(approvedStoryPageSchema).min(1).max(MAX_BOOK_PAGES),
  })
  .superRefine((value, context) => {
    const characterIds = new Set<string>();
    for (const [index, character] of value.characters.entries()) {
      if (characterIds.has(character.id)) {
        context.addIssue({
          code: "custom",
          path: ["characters", index, "id"],
          message: `Duplicate character id "${character.id}".`,
        });
      }
      characterIds.add(character.id);
    }
  });

export type ApprovedStoryPackage = z.infer<typeof approvedStoryPackageSchema>;
export type ApprovedStoryPage = z.infer<typeof approvedStoryPageSchema>;
export type ApprovedStoryCharacter = z.infer<typeof approvedStoryCharacterSchema>;

