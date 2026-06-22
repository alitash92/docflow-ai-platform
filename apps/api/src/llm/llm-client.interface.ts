import type { Classification, IncomingDoc, JudgeVerdict, MergedField } from '../types.js';

export interface LLMUsage {
  model: string;
  tokensIn: number;
  tokensOut: number;
}

export interface ClassifyResult extends LLMUsage {
  classification: Classification;
}

export interface JudgeResult extends LLMUsage {
  verdict: JudgeVerdict;
}

export interface RepairResult extends LLMUsage {
  /** fieldName → corrected value (only for fields the judge flagged). */
  corrections: Record<string, string>;
}

/**
 * LLMClient — the seam between pipeline stages and any model provider.
 *
 * MockLLMClient (DEFAULT) replays committed fixture responses so every demo
 * run is deterministic and key-free. AnthropicClient is the import-guarded
 * real implementation (set ANTHROPIC_API_KEY + MOCK_MODE=false).
 */
export interface LLMClient {
  classify(doc: IncomingDoc, fields: MergedField[]): Promise<ClassifyResult>;
  judge(doc: IncomingDoc, fields: MergedField[], flagged: string[]): Promise<JudgeResult>;
  repair(doc: IncomingDoc, flagged: MergedField[]): Promise<RepairResult>;
}
