/** Shared domain types for the DocFlow AI pipeline. */

export type DocSource = 'email' | 'sms' | 'upload';

export type DocType =
  | 'Referral'
  | 'Prior Authorization'
  | 'Insurance Claim'
  | 'Discharge Summary'
  | 'Lab Report'
  | 'Patient Intake';

export type StageName =
  | 'ingest'
  | 'validate'
  | 'classify'
  | 'judge'
  | 'repair'
  | 'route';

/** A single field as reported by one OCR engine. */
export interface FieldCandidate {
  name: string;
  value: string;
  confidence: number;
  engine: string;
}

/** A field after the dual-engine merge. */
export interface MergedField {
  name: string;
  value: string;
  confidence: number;
  engine: string;
  /** True when the Judge flagged a cross-engine disagreement and Repair resolved it. */
  repaired: boolean;
}

export interface StageResult {
  stage: StageName;
  status: 'done' | 'skipped';
  ms: number;
  detail: string;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
}

export interface Classification {
  type: DocType;
  confidence: number;
}

export interface JudgeVerdict {
  /** Overall document confidence — the value the routing gate reads. */
  overall: number;
  /** Field names where the two engines disagreed beyond tolerance. */
  flagged: string[];
}

export interface RouteDecision {
  decision: 'auto-routed' | 'human-review';
  assignee: string;
  reason: string;
}

export interface IncomingDoc {
  id: string;
  fileName: string;
  source: DocSource;
  sender: string;
  pages: number;
  receivedAgoMin: number;
  /** First bytes of the file, hex-encoded — drives the format detector. */
  bytesHex: string;
  /** Short synthetic body used for token metering. */
  extractText: string;
  /** Patient context (synthetic — fictional names, no real PHI). */
  patient: string;
}

export interface PipelineState {
  doc: IncomingDoc;
  format: string;
  fields: MergedField[];
  classification?: Classification;
  judge?: JudgeVerdict;
  route?: RouteDecision;
  stages: StageResult[];
  costUsd: number;
  piiRedactedTokens: number;
  startedAt: string;
  finishedAt?: string;
}

/** Layout fixture: what each (mocked) OCR engine returns for a document. */
export interface LayoutFixture {
  docId: string;
  layoutEngine: FieldCandidate[];
  visionEngine: FieldCandidate[];
}

/** Aggregate corpus record used by the KPI service (30-day window, per doc type). */
export interface CorpusBucket {
  type: DocType;
  count: number;
  autoRouted: number;
  fieldsExtracted: number;
  fieldsValidated: number;
  costUsd: number;
}
