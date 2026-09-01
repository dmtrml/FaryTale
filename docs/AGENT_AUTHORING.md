# Agent-first authoring

This is the primary creation workflow for FaryTale. The parent should not need to fill technical web forms after a story has been approved in chat.

## User-facing workflow

Typical conversation:

1. Parent: describes the story goal and desired idea.
2. Agent: proposes/revises a page-by-page story.
3. Parent: approves the final story.
4. Parent: says “занеси эту сказку в FaryTale” (or equivalent).
5. Agent: builds one `ApprovedStoryPackage`, materializes it, validates it and reports the result.

The agent should not ask the parent to choose internal fields such as `ageBand`, `storyPattern`, goal slug, page image status or page-character checkboxes when those values are safely derivable.

## Approved text is source-of-truth

Materialization is a persistence step, not another creative rewrite pass.

- Page `text` is stored exactly as supplied in the approved package.
- The materializer verifies after canonical reload that the saved text is byte-for-byte the same JavaScript string.
- If the story needs creative revision, revise it with the parent **before** materialization or explicitly replace the book with another approved package.

## `ApprovedStoryPackage` v1

Minimum practical shape:

```json
{
  "schemaVersion": 1,
  "mode": "create",
  "id": "miau-brushes-teeth",
  "title": "Мяу чистит зубки",
  "language": "ru",
  "age": {
    "minMonths": 18,
    "maxMonths": 24
  },
  "goal": {
    "description": "Показать спокойную последовательность чистки зубов."
  },
  "visualStyle": "Тёплая простая иллюстрация для ребёнка 1–3 лет, крупные формы, минимум деталей.",
  "characters": [
    { "id": "miau" }
  ],
  "pages": [
    {
      "text": "Мяу взял свою щётку.",
      "scene": "Котёнок Мяу стоит у низкой раковины и берёт маленькую зубную щётку.",
      "characterIds": ["miau"],
      "environment": "Та же уютная ванная, только предметы, нужные для действия.",
      "composition": "Средний план; Мяу и щётка крупные и сразу заметны."
    }
  ]
}
```

Supported book size is 1–200 pages. A package with 80 pages is a normal supported case.

### Fields the agent normally infers

The parent does not need to specify these directly:

- canonical kebab-case book id;
- language when obvious from the approved story;
- `storyPattern` — inferred from goal when omitted;
- age band — deterministically derived from the age range;
- goal type/slug — derived when omitted;
- page numbers and prompt paths;
- lifecycle/image status — materialization sets the book/pages to `prompt_ready`;
- page character membership — the agent should fill `characterIds` from the approved scene.

## Characters

### Existing recurring character

Use only its id:

```json
{ "id": "miau" }
```

If an existing canonical character is found, its canonical visual identity wins. Even if a package accidentally contains conflicting replacement fields, materialization reuses the saved canonical character rather than silently redesigning it.

### New character

A genuinely new character needs a complete textual canonical definition:

```json
{
  "id": "doctor-owl",
  "name": "Доктор Сова",
  "type": "animal",
  "species": "owl",
  "narrativeDescription": "Спокойная доброжелательная взрослая сова-врач.",
  "identity": "Stable visual identity description...",
  "palette": ["soft brown", "cream"],
  "fixedTraits": ["round glasses"],
  "doNotChange": ["keep round glasses"]
}
```

Binary reference art is **not required** to create the textual character. If none exists, the materialization report warns that the reference image is pending. The parent can upload the reference manually later.

## Illustration prompts

Materialization creates exactly one prompt file per page:

```text
prompts/001.md
prompts/002.md
...
```

Every prompt contains:

- the page-specific visible scene;
- the approved read-aloud text as alignment context;
- canonical character identity;
- relevant existing character reference paths;
- page-specific environment/composition when supplied;
- book style lock;
- continuity constraints;
- negative constraints (no text, watermarks, accidental characters, etc.);
- manual generation metadata.

The Parent page editor already displays/copies these prompt files.

## No automatic image generation

The approved-story workflow must **not** call an image provider.

After materialization:

- book status: `prompt_ready`;
- every page has `imageStatus: prompt_ready`;
- every page has a prompt path;
- no page image path is created;
- the parent generates illustrations separately in chat and uploads them manually.

## Safe create/replace behavior

`mode: "create"` refuses to overwrite an existing book id.

`mode: "replace"` is explicit. Before replacement, the existing whole book directory is moved to:

```text
content/archive/agent-replaced-books/<book-id>-<timestamp>/
```

This preserves previous prompts/assets instead of silently destroying them.

## Local external-agent handoff

An external coding/chat agent with access to the project should:

1. Build the approved package from the already-approved conversation/story.
2. Save it temporarily, preferably under `.scratch/farytale-agent/<book-id>.json`.
3. Ensure the local FaryTale server is running (the **agent** does this; the parent should not need to).
4. Materialize it:

```bash
npm run agent:materialize -- .scratch/farytale-agent/<book-id>.json
```

If the server uses another port:

```bash
npm run agent:materialize -- .scratch/farytale-agent/<book-id>.json --base-url http://127.0.0.1:3010
```

The CLI calls the parent-gated local endpoint and prints the validation report.

The same high-level operation is available inside Studio as:

```text
/materialize-json <ApprovedStoryPackage JSON>
```

The structured command limit is intentionally large enough for long books; the old 2500-character message ceiling no longer applies to this path.

## Completion report

Successful materialization reports at least:

- book id/title;
- page count;
- prompt count;
- `prompt_ready` status;
- selected age band and story pattern;
- reused/created characters;
- whether characters have reference images;
- archived previous book path for an intentional replace;
- warnings requiring later attention.

The agent should summarize this report to the parent and should not dump technical JSON unless requested.

