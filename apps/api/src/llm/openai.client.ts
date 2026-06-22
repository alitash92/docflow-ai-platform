import type { Classification, DocType, IncomingDoc, MergedField } from '../types.js';
import type {
  ClassifyResult,
  JudgeResult,
  LLMClient,
  RepairResult,
} from './llm-client.interface.js';
import { createOpenAIClient, withConnectionRetry } from './openai-transport.js';

/**
 * OpenAIClient — real implementation of the LLMClient seam, backed by a
 * frontier vision LLM over the chat-completions API.
 *
 * Schema-enforced output: every stage requests `response_format` with a strict
 * JSON schema so the model returns parseable, typed JSON (falls back to plain
 * json_object mode if a model rejects strict schemas). temperature is pinned
 * to 0 for deterministic extraction.
 *
 * Import-guarded: constructing it without OPENAI_API_KEY throws a clear setup
 * message. The demo never constructs this class — MockLLMClient is the default —
 * so the repo runs end-to-end with zero keys. Enable real mode with
 * MOCK_MODE=false and a valid key.
 */

const DOC_TYPES: DocType[] = [
  'Referral',
  'Prior Authorization',
  'Insurance Claim',
  'Discharge Summary',
  'Lab Report',
  'Patient Intake',
];

/** Cheap stage model (classify/judge) and the vision-capable model (extract/repair). */
function defaultModel(): string {
  return process.env.OPENAI_MODEL?.trim() || 'gpt-4o';
}
function cheapModel(): string {
  return process.env.OPENAI_MODEL_CHEAP?.trim() || 'gpt-4o-mini';
}

interface ChatJsonOptions {
  model: string;
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
}

interface ChatJsonResult<T> {
  data: T;
  model: string;
  tokensIn: number;
  tokensOut: number;
}

export class OpenAIClient implements LLMClient {
  private clientPromise: Promise<import('openai').default> | null = null;

  constructor(private readonly apiKey = process.env.OPENAI_API_KEY) {
    if (!this.apiKey) {
      throw new Error(
        'OpenAIClient requires OPENAI_API_KEY. The demo runs MockLLMClient by default — set MOCK_MODE=false and provide a key to call the live vision LLM.',
      );
    }
  }

  /** Lazily import the SDK so the package is only required in real mode. */
  private async client(): Promise<import('openai').default> {
    if (!this.clientPromise) {
      this.clientPromise = createOpenAIClient(this.apiKey as string);
    }
    return this.clientPromise;
  }

  /** chat.completions with strict JSON-schema output, temp 0, 429 retry/backoff. */
  private async chatJson<T>(opts: ChatJsonOptions): Promise<ChatJsonResult<T>> {
    const client = await this.client();
    const backoff = [1000, 2000, 4000];

    const request = (strict: boolean) =>
      // Retry connection-class failures ("Premature close", socket resets) that
      // arise from stale keep-alive sockets on some cloud hosts.
      withConnectionRetry(() =>
        client.chat.completions.create({
          model: opts.model,
          temperature: 0,
          response_format: strict
            ? {
                type: 'json_schema',
                json_schema: { name: opts.schemaName, schema: opts.schema, strict: true },
              }
            : { type: 'json_object' },
          messages: [
            { role: 'system', content: `${opts.system}\nRespond with a single JSON object.` },
            { role: 'user', content: opts.user },
          ],
        }),
      );

    let lastErr: unknown;
    let strict = true;
    for (let attempt = 0; attempt <= backoff.length; attempt++) {
      try {
        const resp = await request(strict);
        const content = resp.choices[0]?.message?.content ?? '{}';
        return {
          data: JSON.parse(content) as T,
          model: resp.model || opts.model,
          tokensIn: resp.usage?.prompt_tokens ?? 0,
          tokensOut: resp.usage?.completion_tokens ?? 0,
        };
      } catch (err) {
        lastErr = err;
        const status = (err as { status?: number })?.status;
        // Some models reject strict json_schema — retry once in json_object mode.
        if (status === 400 && strict) {
          strict = false;
          continue;
        }
        if (status === 429 && attempt < backoff.length) {
          await new Promise((r) => setTimeout(r, backoff[attempt]));
          continue;
        }
        throw err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('OpenAIClient: request failed');
  }

  async classify(doc: IncomingDoc, fields: MergedField[]): Promise<ClassifyResult> {
    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'confidence'],
      properties: {
        type: { type: 'string', enum: DOC_TYPES },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
    };
    const system =
      'You classify inbound healthcare documents for a provider-network intake pipeline. ' +
      `Choose exactly one document type from: ${DOC_TYPES.join(', ')}. ` +
      'Return the type and a calibrated confidence in [0,1]. Be conservative: when the ' +
      'evidence is ambiguous, lower the confidence so the document is routed to human review.';
    const user = JSON.stringify({
      fileName: doc.fileName,
      extractedFields: fields.map((f) => ({ name: f.name, value: f.value })),
      text: doc.extractText.slice(0, 4000),
    });

    const { data, model, tokensIn, tokensOut } = await this.chatJson<Classification>({
      model: cheapModel(),
      system,
      user,
      schemaName: 'document_classification',
      schema,
    });
    const type = DOC_TYPES.includes(data.type) ? data.type : 'Discharge Summary';
    return {
      model,
      tokensIn,
      tokensOut,
      classification: { type, confidence: clamp01(data.confidence) },
    };
  }

  async judge(
    doc: IncomingDoc,
    fields: MergedField[],
    flagged: string[],
  ): Promise<JudgeResult> {
    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['overall', 'flagged'],
      properties: {
        overall: { type: 'number', minimum: 0, maximum: 1 },
        flagged: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'reason'],
            properties: {
              name: { type: 'string' },
              reason: { type: 'string' },
            },
          },
        },
      },
    };
    const system =
      'You are an extraction validator (LLM-as-judge). Re-score the extracted fields for a ' +
      'healthcare document and assign an overall document confidence in [0,1]. Flag any field ' +
      'that is low-confidence, internally inconsistent, or not supported by the document text, ' +
      'with a short reason. A field already marked as a cross-engine disagreement should be ' +
      'scrutinised especially closely.';
    const user = JSON.stringify({
      text: doc.extractText.slice(0, 4000),
      fields: fields.map((f) => ({ name: f.name, value: f.value, confidence: f.confidence })),
      crossEngineDisagreements: flagged,
    });

    const { data, model, tokensIn, tokensOut } = await this.chatJson<{
      overall: number;
      flagged: Array<{ name: string; reason: string }>;
    }>({
      model: cheapModel(),
      system,
      user,
      schemaName: 'judge_verdict',
      schema,
    });

    // Union the model's flagged fields with the cross-engine disagreements so the
    // existing Repair stage (which keys off names) stays consistent with DocFlow.
    const names = new Set<string>(flagged);
    for (const f of data.flagged ?? []) if (f?.name) names.add(f.name);
    return {
      model,
      tokensIn,
      tokensOut,
      verdict: { overall: round2(clamp01(data.overall)), flagged: [...names] },
    };
  }

  async repair(doc: IncomingDoc, flagged: MergedField[]): Promise<RepairResult> {
    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['corrections'],
      properties: {
        corrections: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'value'],
            properties: {
              name: { type: 'string' },
              value: { type: 'string' },
            },
          },
        },
      },
    };
    const system =
      'You repair specific extracted fields that a validator flagged. Re-read the document text ' +
      'and return the corrected value for each flagged field, grounded strictly in the document. ' +
      'Do not invent values; if the document does not support a field, return its existing value.';
    const user = JSON.stringify({
      text: doc.extractText.slice(0, 4000),
      flaggedFields: flagged.map((f) => ({ name: f.name, currentValue: f.value })),
    });

    const { data, model, tokensIn, tokensOut } = await this.chatJson<{
      corrections: Array<{ name: string; value: string }>;
    }>({
      model: defaultModel(),
      system,
      user,
      schemaName: 'field_repairs',
      schema,
    });

    const corrections: Record<string, string> = {};
    for (const c of data.corrections ?? []) {
      if (c?.name) corrections[c.name] = String(c.value ?? '');
    }
    // Ensure every flagged field has an entry (fall back to current value).
    for (const f of flagged) if (!(f.name in corrections)) corrections[f.name] = f.value;
    return { model, tokensIn, tokensOut, corrections };
  }
}

function clamp01(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(1, v));
}
function round2(n: number): number {
  return Number(n.toFixed(2));
}
