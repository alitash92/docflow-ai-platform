import type { Classification, DocType, IncomingDoc, MergedField } from '../types.js';
import type {
  ClassifyResult,
  JudgeResult,
  LLMClient,
  RepairResult,
} from './llm-client.interface.js';
import { loadSeedFixtures } from '../ingest/channels.js';

/** Rough but consistent token estimate: ~4 chars per token. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

const KEYWORD_TYPES: Array<[RegExp, DocType, number]> = [
  [/prior[\s_-]?auth|\bpa[-_ ]?\d/i, 'Prior Authorization', 0.92],
  [/referral|consult/i, 'Referral', 0.94],
  [/claim|cms[-_ ]?1500|eob|remit/i, 'Insurance Claim', 0.93],
  [/discharge|summary/i, 'Discharge Summary', 0.92],
  [/lab|panel|result|analyte/i, 'Lab Report', 0.91],
  [/intake|registration|photo|\.heic|\.jpg/i, 'Patient Intake', 0.9],
];

/**
 * MockLLMClient — deterministic replay of recorded model behaviour.
 *
 * For the six seed documents it returns the committed fixture responses
 * (classification, judge confidence, repair corrections). For documents POSTed
 * at runtime it falls back to a keyword heuristic so the API stays usable
 * without a key. Token counts are estimated from the actual prompt text, so
 * per-document cost is computed, not hardcoded.
 */
export class MockLLMClient implements LLMClient {
  private readonly fixtures = loadSeedFixtures();

  private fixtureFor(doc: IncomingDoc) {
    return this.fixtures.find((f) => f.id === doc.id);
  }

  async classify(doc: IncomingDoc, fields: MergedField[]): Promise<ClassifyResult> {
    const fixture = this.fixtureFor(doc);
    const classification: Classification =
      fixture?.classification ?? this.heuristicClassify(doc);
    const prompt = doc.extractText + JSON.stringify(fields.map((f) => f.name));
    return {
      model: 'claude-haiku (mock replay)',
      tokensIn: estimateTokens(prompt) + 180, // + system prompt
      tokensOut: 42,
      classification,
    };
  }

  async judge(doc: IncomingDoc, fields: MergedField[], flagged: string[]): Promise<JudgeResult> {
    const fixture = this.fixtureFor(doc);
    // Doc-level confidence: fixture replay for seed docs; otherwise the
    // classification heuristic minus a penalty per unresolved disagreement.
    const overall =
      fixture?.classification.confidence ??
      Math.max(0.5, this.heuristicClassify(doc).confidence - 0.04 * flagged.length);
    const prompt = JSON.stringify(fields) + doc.extractText.slice(0, 400);
    return {
      model: 'claude-sonnet (mock replay)',
      tokensIn: estimateTokens(prompt) + 260,
      tokensOut: 96,
      verdict: { overall: Number(overall.toFixed(2)), flagged },
    };
  }

  async repair(doc: IncomingDoc, flagged: MergedField[]): Promise<RepairResult> {
    const fixture = this.fixtureFor(doc);
    const corrections: Record<string, string> = {};
    for (const field of flagged) {
      corrections[field.name] = fixture?.repairs?.[field.name] ?? field.value;
    }
    const prompt = JSON.stringify(flagged) + doc.extractText.slice(0, 400);
    return {
      model: 'claude-sonnet (mock replay)',
      tokensIn: estimateTokens(prompt) + 220,
      tokensOut: estimateTokens(JSON.stringify(corrections)) + 24,
      corrections,
    };
  }

  private heuristicClassify(doc: IncomingDoc): Classification {
    const haystack = `${doc.fileName} ${doc.extractText}`;
    for (const [pattern, type, confidence] of KEYWORD_TYPES) {
      if (pattern.test(haystack)) return { type, confidence };
    }
    return { type: 'Discharge Summary', confidence: 0.74 }; // unsure → below gate → human review
  }
}
