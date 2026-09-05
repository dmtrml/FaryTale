import { z } from "zod";

const contentIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Expected a lowercase kebab-case id");

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");

export const imageStatusSchema = z.enum([
  "missing",
  "prompt_ready",
  "generating",
  "ready",
  "failed",
]);

export const bookStatusSchema = z.enum([
  "draft",
  "text_ready",
  "prompt_ready",
  "illustrating",
  "ready",
  "archived",
]);

export const ageBandSchema = z.enum([
  "12-18m",
  "18-24m",
  "2-3y",
  "4-5y",
  "6-8y",
]);

export const storyPatternSchema = z.enum([
  "habit-routine",
  "independence-trying",
  "emotion-regulation",
  "fear-new-situation",
  "safety-rule",
  "social-skill",
  "curiosity-explanation",
  "family-memory",
]);

const classificationValueSchema = z.string().trim().min(1).max(120);
const classificationListSchema = z.array(classificationValueSchema).max(40).default([]);

export const bookClassificationSchema = z.object({
  meanings: classificationListSchema,
  situations: classificationListSchema,
  collections: classificationListSchema,
  tags: classificationListSchema,
  custom: z
    .record(z.string().trim().min(1).max(80), classificationListSchema)
    .default({}),
});

export function createEmptyBookClassification() {
  return {
    meanings: [],
    situations: [],
    collections: [],
    tags: [],
    custom: {},
  };
}

export const bookPageSchema = z.object({
  number: z.number().int().positive(),
  text: z.string(),
  image: z.string().optional(),
  prompt: z.string().optional(),
  characters: z.array(z.string()).default([]),
  imageStatus: imageStatusSchema,
});

const visualReferenceSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  role: z.string().min(1),
});

export const bookSchema = z.object({
  schemaVersion: z.literal(1),
  id: contentIdSchema,
  title: z.string().min(1),
  language: z.string().min(2),
  age: z
    .object({
      minMonths: z.number().int().nonnegative(),
      maxMonths: z.number().int().nonnegative(),
      label: z.string().min(1),
    })
    .refine((age) => age.minMonths <= age.maxMonths, {
      message: "minMonths must not exceed maxMonths",
      path: ["maxMonths"],
    }),
  goal: z.object({
    type: z.string().min(1),
    slug: z.string().min(1),
    description: z.string().min(1),
  }),
  characters: z.array(z.string()).default([]),
  classification: bookClassificationSchema.default(createEmptyBookClassification),
  references: z.array(visualReferenceSchema).default([]),
  status: bookStatusSchema,
  cover: z.string().optional(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  authoring: z
    .object({
      skill: z.literal("childrens-story-creator-v1"),
      ageBand: ageBandSchema,
      storyPattern: storyPatternSchema,
      visualStyle: z.string().optional(),
      externalReferences: z
        .array(
          z.object({
            id: contentIdSchema,
            label: z.string().trim().min(1).max(160),
            instruction: z.string().trim().min(1).max(1000).optional(),
          }),
        )
        .max(20)
        .optional(),
      outline: z.array(
        z.object({
          pageNumber: z.number().int().positive(),
          beat: z.string().min(1),
        }),
      ),
    })
    .optional(),
  pages: z.array(bookPageSchema),
});

export const characterSchema = z.object({
  schemaVersion: z.literal(1),
  id: contentIdSchema,
  name: z.string().min(1),
  type: z.string().min(1),
  species: z.string().optional(),
  narrativeDescription: z.string().min(1),
  visual: z.object({
    identity: z.string().min(1),
    palette: z.array(z.string()).default([]),
    fixedTraits: z.array(z.string()).default([]),
    doNotChange: z.array(z.string()).default([]),
  }),
  references: z.array(visualReferenceSchema).default([]),
});

export const libraryManifestEntrySchema = bookSchema.pick({
  id: true,
  title: true,
  language: true,
  age: true,
  goal: true,
  characters: true,
  classification: true,
  status: true,
  cover: true,
  updatedAt: true,
}).extend({
  pageCount: z.number().int().nonnegative(),
});

export const libraryManifestSchema = z.object({
  schemaVersion: z.literal(1),
  books: z.array(libraryManifestEntrySchema),
});

export type Book = z.infer<typeof bookSchema>;
export type BookPage = z.infer<typeof bookPageSchema>;
export type Character = z.infer<typeof characterSchema>;
export type LibraryManifest = z.infer<typeof libraryManifestSchema>;
export type AgeBand = z.infer<typeof ageBandSchema>;
export type StoryPattern = z.infer<typeof storyPatternSchema>;
export type BookClassification = z.infer<typeof bookClassificationSchema>;
