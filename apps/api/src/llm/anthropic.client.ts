import type { IncomingDoc, MergedField } from '../types.js';
import type {
  ClassifyResult,
  JudgeResult,
  LLMClient,
  RepairResult,
} from './llm-client.interface.js';

/**
 * AnthropicClient — real Claude API implementation of the LLMClient seam.
 *
 * Import-guarded: constructing it without ANTHROPIC_API_KEY throws a clear
 * setup message. The demo never constructs this class — MockLLMClient is the
 * default — so the repo runs end-to-end with zero keys.
 */
export class AnthropicClient implements LLMClient {
  constructor(private readonly apiKey = process.env.ANTHROPIC_API_KEY) {
    if (!this.apiKey) {
      throw new Error(
        'AnthropicClient requires ANTHROPIC_API_KEY. The demo runs MockLLMClient by default — set MOCK_MODE=false and provide the key to call the live API.',
      );
    }
  }

  async classify(_doc: IncomingDoc, _fields: MergedField[]): Promise<ClassifyResult> {
    throw new Error(
      'AnthropicClient: live API calls are intentionally not wired in this demo repo. See README — "What runs locally vs what is mocked".',
    );
  }

  async judge(): Promise<JudgeResult> {
    throw new Error('AnthropicClient: live API calls are not wired in this demo repo.');
  }

  async repair(): Promise<RepairResult> {
    throw new Error('AnthropicClient: live API calls are not wired in this demo repo.');
  }
}
