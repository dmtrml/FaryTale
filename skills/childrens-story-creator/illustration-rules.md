# Illustration Rules

## Primary principle

Every illustration must communicate the page's main action quickly to a child.

## Composition

- One dominant story event.
- Keep the key character and key object/action easy to find.
- Avoid clutter for toddler books.
- Use environment only when it helps explain the action.
- Vary camera distance and pose across pages.
- Avoid repeated front-facing portrait compositions.
- Avoid selfie/passport/bust-shot framing unless the page specifically needs a close emotional portrait.
- No text, letters, logos, watermarks, UI, or frames inside generated art unless explicitly required.

## Continuity

Use:
1. canonical character identity;
2. book-level visual style;
3. page scene;
4. page composition.

Do not let a page prompt override canonical identity accidentally.

Preserve:
- fur/skin/hair colors;
- face shape;
- eye characteristics;
- body proportions;
- recurring clothing when locked;
- recurring props when relevant;
- room/location anchors when story continuity needs them.

## Toddler visual rules

For roughly 1–3 years:
- fewer objects;
- larger subjects;
- clear gestures;
- clear action direction;
- warm readable expressions;
- no visually confusing background action;
- avoid tiny important objects.

## Prompt structure

Recommended:

```text
SCENE
Exact visible event.

CHARACTERS
Who is present, canonical identities, page-specific expression/action.

ENVIRONMENT
Only relevant fixed room/location/props.

COMPOSITION
Camera distance, pose, dominant action, subject scale.

STYLE LOCK
Canonical book style and palette.

CONTINUITY
What must not change.

NEGATIVE CONSTRAINTS
No text, watermark, duplicate limbs, accidental extra characters, clutter, etc.
```

## Reference selection

Send only references needed for the current page.

For recurring characters:
- canonical reference first;
- optional book-specific outfit reference second;
- avoid unrelated references.

For recurring real-world props whose exact appearance matters:
- keep them as a separate book/external object reference rather than folding them into the character identity;
- when a parent says they will attach a photo/reference of that object, explicitly enumerate it in the ready-to-copy prompt alongside the usual character and environment references;
- preserve the object's relevant stable traits from the supplied reference across every page where it appears.

## Generation metadata

Record, when available:
- provider;
- model;
- timestamp;
- size;
- seed;
- reference paths;
- retry count;
- notes.

## Regeneration

Regenerate one page independently.

Do not regenerate the whole book merely because one page is wrong.
