import type { FieldCandidate, MergedField } from '../types.js';

/** Engines disagreeing by more than this confidence delta — or on value — get flagged. */
export const DISAGREEMENT_TOLERANCE = 0.15;

export interface MergeOutcome {
  fields: MergedField[];
  /** Field names where the engines disagreed on value — candidates for Repair. */
  disagreements: string[];
}

/**
 * Field-level dual-engine merge.
 *
 * For every field name present in either engine's output:
 *  - both engines agree on value  → keep the higher-confidence candidate
 *  - engines disagree on value    → keep the higher-confidence candidate,
 *    record a disagreement (Judge will flag it, Repair will resolve it)
 *  - only one engine saw the field → keep it as-is
 *
 * This is the only honest framing of "multi-engine OCR" in a key-free demo:
 * the merge logic is real and unit-tested; the engines behind it are mocks
 * replaying committed fixtures.
 */
export function mergeFields(a: FieldCandidate[], b: FieldCandidate[]): MergeOutcome {
  const byName = new Map<string, FieldCandidate[]>();
  for (const candidate of [...a, ...b]) {
    const list = byName.get(candidate.name) ?? [];
    list.push(candidate);
    byName.set(candidate.name, list);
  }

  const fields: MergedField[] = [];
  const disagreements: string[] = [];

  for (const [name, candidates] of byName) {
    const winner = [...candidates].sort((x, y) => y.confidence - x.confidence)[0];
    const valueDisagreement =
      candidates.length > 1 && new Set(candidates.map((c) => c.value)).size > 1;
    const confidenceGap =
      candidates.length > 1 &&
      Math.max(...candidates.map((c) => c.confidence)) -
        Math.min(...candidates.map((c) => c.confidence)) >
        DISAGREEMENT_TOLERANCE;

    if (valueDisagreement || confidenceGap) disagreements.push(name);

    fields.push({
      name,
      value: winner.value,
      confidence: winner.confidence,
      engine: winner.engine,
      repaired: false,
    });
  }

  return { fields, disagreements };
}
