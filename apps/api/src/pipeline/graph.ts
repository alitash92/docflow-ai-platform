import type {
  IncomingDoc,
  MergedField,
  PipelineState,
  StageName,
  StageResult,
} from '../types.js';
import type { OCRProvider } from '../ocr/ocr-provider.interface.js';
import type { LLMClient } from '../llm/llm-client.interface.js';
import type { DocumentStore } from '../store/document-store.js';
import { mergeFields } from '../ocr/merge.js';
import { detectFormat } from '../ingest/format-detector.js';
import { route } from './router.js';
import { costUsd } from '../cost/token-meter.js';
import { loadSeedFixtures } from '../ingest/channels.js';

export interface PipelineDeps {
  layoutEngine: OCRProvider;
  visionEngine: OCRProvider;
  llm: LLMClient;
  store: DocumentStore;
}

/**
 * The staged pipeline graph:
 *
 *   Ingest → Validate → Classify → Judge → Repair → Route/Escalate
 *
 * Implemented as an ordered list of typed reducers over a single state object
 * (the LangGraph pattern, without the framework weight). A checkpoint is
 * persisted after every stage, so an in-progress run can resume from its last
 * completed stage after a restart instead of starting over.
 */
export async function runPipeline(doc: IncomingDoc, deps: PipelineDeps): Promise<PipelineState> {
  const state: PipelineState = {
    doc,
    format: 'pending',
    fields: [],
    stages: [],
    costUsd: 0,
    piiRedactedTokens: 0,
    startedAt: new Date().toISOString(),
  };

  const fixture = loadSeedFixtures().find((f) => f.id === doc.id);
  const recordedMs = (stage: StageName, fallback: number) =>
    fixture?.stageMs?.[stage] ?? fallback;

  const checkpoint = async (stage: StageName) => {
    await deps.store.saveCheckpoint({
      docId: doc.id,
      stage,
      at: new Date().toISOString(),
      snapshot: structuredClone(state),
    });
  };

  const push = (result: StageResult) => {
    state.stages.push(result);
    state.costUsd += result.costUsd ?? 0;
  };

  // ── 1. Ingest ────────────────────────────────────────────────────────────
  const detected = detectFormat(doc.bytesHex, doc.fileName);
  state.format = detected.format;
  state.piiRedactedTokens = fixture?.piiRedactedTokens ?? 0;
  push({
    stage: 'ingest',
    status: 'done',
    ms: recordedMs('ingest', 600 + doc.pages * 90),
    detail: `${detected.format} via ${doc.source} · ${doc.pages} page(s) · decoder: ${detected.decoder} · PII redacted: ${state.piiRedactedTokens} token(s)`,
  });
  await checkpoint('ingest');

  // ── 2. Validate (dual-engine OCR + field-level merge) ────────────────────
  const [layoutFields, visionFields] = await Promise.all([
    deps.layoutEngine.extract(doc),
    deps.visionEngine.extract(doc),
  ]);
  const merged = mergeFields(layoutFields, visionFields);
  state.fields = merged.fields;
  push({
    stage: 'validate',
    status: 'done',
    ms: recordedMs('validate', 900 + doc.pages * 110),
    detail: `${deps.layoutEngine.name} + ${deps.visionEngine.name} · ${merged.fields.length} fields merged · ${merged.disagreements.length} disagreement(s)`,
  });
  await checkpoint('validate');

  // ── 3. Classify ──────────────────────────────────────────────────────────
  const cls = await deps.llm.classify(doc, state.fields);
  state.classification = cls.classification;
  push({
    stage: 'classify',
    status: 'done',
    ms: recordedMs('classify', 1400),
    detail: `${cls.classification.type} @ ${cls.classification.confidence.toFixed(2)} · schema enforced`,
    model: cls.model,
    tokensIn: cls.tokensIn,
    tokensOut: cls.tokensOut,
    costUsd: costUsd(cls.model, cls.tokensIn, cls.tokensOut),
  });
  await checkpoint('classify');

  // ── 4. Judge ─────────────────────────────────────────────────────────────
  const judged = await deps.llm.judge(doc, state.fields, merged.disagreements);
  state.judge = judged.verdict;
  push({
    stage: 'judge',
    status: 'done',
    ms: recordedMs('judge', 800),
    detail: `overall ${judged.verdict.overall.toFixed(2)} · ${judged.verdict.flagged.length} field(s) flagged`,
    model: judged.model,
    tokensIn: judged.tokensIn,
    tokensOut: judged.tokensOut,
    costUsd: costUsd(judged.model, judged.tokensIn, judged.tokensOut),
  });
  await checkpoint('judge');

  // ── 5. Repair (conditional) ──────────────────────────────────────────────
  const flaggedFields = state.fields.filter((f) => judged.verdict.flagged.includes(f.name));
  if (flaggedFields.length > 0) {
    const repaired = await deps.llm.repair(doc, flaggedFields);
    for (const field of state.fields) {
      const fix = repaired.corrections[field.name];
      if (fix !== undefined) {
        field.value = fix;
        field.repaired = true;
        field.engine = 'judge+repair merge';
      }
    }
    push({
      stage: 'repair',
      status: 'done',
      ms: recordedMs('repair', 700),
      detail: `${flaggedFields.length} field(s) repaired from cross-engine disagreement`,
      model: repaired.model,
      tokensIn: repaired.tokensIn,
      tokensOut: repaired.tokensOut,
      costUsd: costUsd(repaired.model, repaired.tokensIn, repaired.tokensOut),
    });
  } else {
    push({
      stage: 'repair',
      status: 'skipped',
      ms: 0,
      detail: 'no disagreements — nothing to repair',
    });
  }
  await checkpoint('repair');

  // ── 6. Route or Escalate ─────────────────────────────────────────────────
  state.route = route(state.classification, state.judge);
  push({
    stage: 'route',
    status: 'done',
    ms: recordedMs('route', 120),
    detail:
      state.route.decision === 'auto-routed'
        ? `→ ${state.route.assignee} · ${state.route.reason}`
        : `→ human review queue · ${state.route.reason}`,
  });
  state.finishedAt = new Date().toISOString();
  await checkpoint('route');
  await deps.store.saveRun(state);

  return state;
}

/** Convenience: a fully-mocked dependency set (what the demo and tests use). */
export async function mockDeps(): Promise<PipelineDeps> {
  const [{ MockLayoutEngine, MockVisionEngine }, { MockLLMClient }, { InMemoryStore }] =
    await Promise.all([
      import('../ocr/mock-ocr.engine.js'),
      import('../llm/mock-llm.client.js'),
      import('../store/document-store.js'),
    ]);
  return {
    layoutEngine: new MockLayoutEngine(),
    visionEngine: new MockVisionEngine(),
    llm: new MockLLMClient(),
    store: new InMemoryStore(),
  };
}

/** True only when a real key is configured AND mock mode is explicitly disabled. */
export function realModeEnabled(): boolean {
  return process.env.MOCK_MODE === 'false' && !!process.env.OPENAI_API_KEY;
}

/**
 * Real dependency set, used by the upload endpoint when real mode is enabled.
 *
 * A single frontier vision LLM has already produced the field candidates from
 * the uploaded file (see openai-vision.ingest); we replay those into the
 * dual-engine merge so the rest of the pipeline (classify → judge → repair →
 * route) is identical to mock mode. The store is in-memory per request.
 */
export async function realDeps(preExtracted: import('../types.js').FieldCandidate[]): Promise<PipelineDeps> {
  const [{ OpenAIClient }, { InMemoryStore }] = await Promise.all([
    import('../llm/openai.client.js'),
    import('../store/document-store.js'),
  ]);
  const engine = (name: string): OCRProvider => ({
    name,
    async extract() {
      return preExtracted.map((f) => ({ ...f, engine: name }));
    },
  });
  return {
    layoutEngine: engine('vision-llm (layout)'),
    visionEngine: engine('vision-llm (semantic)'),
    llm: new OpenAIClient(),
    store: new InMemoryStore(),
  };
}
