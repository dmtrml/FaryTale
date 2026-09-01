# Children's Story Creator Skill

## Purpose

Use this skill whenever creating, revising, evaluating, or illustrating a child-facing FaryTale book.

The goal is not merely to produce entertaining prose. The goal is to create a developmentally appropriate, visually understandable story that a parent can comfortably read aloud.

## Required inputs

Resolve from the book, parent request, or safe defaults:

- child age or age range;
- story goal;
- story type/pattern;
- recurring characters;
- language;
- desired page count;
- visual style/references if available.

If exact age is missing, infer only when the surrounding book/project context makes it safe. Otherwise use a broad neutral age group and record that assumption in parent-facing metadata, not child text.

## Required companion files

Read as needed:

- `age-rules.md`
- `illustration-rules.md`
- `story-patterns.md`
- `safety-rules.md`

## Core workflow

1. Identify the developmental goal.
2. Choose the closest story pattern.
3. Apply age rules.
4. Create a page-by-page beat outline.
5. Ensure each page has one visually clear event.
6. Write read-aloud text.
7. Resolve recurring characters from the character library.
8. Create an illustration prompt for each page.
9. Add continuity constraints and references.
10. Save structured story + prompts.
11. Generate images only when the active workflow/provider calls for it.

## Story quality rules

- Prefer concrete action over explanation.
- Show cause and effect through events.
- For toddlers, repetition is useful.
- Avoid lectures and explicit moralizing when the lesson can be shown.
- Keep emotional stakes proportional to age.
- Do not create unnecessary danger just to make the story exciting.
- Preserve a warm, secure ending for routine/habit stories.
- A page should advance the story; avoid filler pages.
- Text and illustration must describe the same event.

## Page design

For the youngest groups:
- one main event per page;
- one dominant visual subject/action;
- little background clutter;
- short text;
- clear sequencing.

For older groups:
- richer scenes are allowed, but the main action must still be readable.

## Character continuity

When a recurring character exists:
- load canonical `character.json`;
- use canonical references;
- do not silently redesign identity;
- book-specific clothing or props must be explicit overrides;
- keep identity constraints separate from scene composition.

## Output discipline

Never place important generation state only in chat text.

Write:
- story structure to the canonical book file;
- illustration prompts to page prompt files;
- generation metadata to prompt/provenance sections;
- reusable identity information to character files.

## Manual image mode

If no image provider is configured, do not fail the book creation workflow.

Instead:
- save each final prompt;
- set page image state to `prompt_ready`;
- leave image path empty or placeholder;
- allow later upload/replacement.
