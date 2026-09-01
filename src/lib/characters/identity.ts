import type { Character } from "../content/schemas";

export function selectCanonicalIdentityReference(character: Character) {
  return (
    character.references.find((reference) => reference.role === "identity") ??
    character.references[0] ??
    null
  );
}

export function canonicalCharacterIdentityLine(character: Character) {
  return `- ${character.id} — ${character.name}: ${character.visual.identity}`;
}

export function canonicalCharacterContinuityLines(character: Character) {
  return [
    `- Preserve canonical identity for ${character.id}.`,
    ...character.visual.fixedTraits.map((rule) => `- ${character.id} fixed trait: ${rule}`),
    ...character.visual.doNotChange.map((rule) => `- ${character.id}: ${rule}`),
  ];
}
