/** Typed client for the DocFlow API (mirrors apps/api/src/types.ts). */

export interface MergedField {
  name: string;
  value: string;
  confidence: number;
  engine: string;
  repaired: boolean;
}

export interface StageResult {
  stage: string;
  status: 'done' | 'skipped';
  ms: number;
  detail: string;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
}

export interface PipelineState {
  doc: {
    id: string;
    fileName: string;
    source: string;
    sender: string;
    pages: number;
    receivedAgoMin: number;
    patient: string;
  };
  format: string;
  fields: MergedField[];
  classification?: { type: string; confidence: number };
  judge?: { overall: number; flagged: string[] };
  route?: { decision: 'auto-routed' | 'human-review'; assignee: string; reason: string };
  stages: StageResult[];
  costUsd: number;
  piiRedactedTokens: number;
}

export interface FieldCandidate {
  name: string;
  value: string;
  confidence: number;
  engine: string;
}

export interface EngineCandidates {
  docId: string;
  layoutEngine: FieldCandidate[];
  visionEngine: FieldCandidate[];
}

export interface Kpis {
  windowDays: number;
  docsProcessed: number;
  accuracyPct: number;
  autoRoutedPct: number;
  avgCostUsd: number;
  deltas: { volumePct: number; accuracyPts: number; autoRoutedPts: number; costPct: number };
}

export interface Health {
  ok: boolean;
  mode: 'mock' | 'real';
  threshold: number;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

/** Upload a real file for live extraction (real mode only). */
async function uploadDocument(file: File): Promise<PipelineState> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/documents/upload', { method: 'POST', body: form });
  const body = (await res.json().catch(() => ({}))) as PipelineState & { error?: string };
  if (!res.ok) throw new Error(body.error || `upload → ${res.status}`);
  return body;
}

export const api = {
  health: () => get<Health>('/api/health'),
  kpis: () => get<Kpis>('/api/kpis'),
  documents: () => get<PipelineState[]>('/api/documents'),
  document: (id: string) => get<PipelineState>(`/api/documents/${id}`),
  engines: (id: string) => get<EngineCandidates>(`/api/documents/${id}/engines`),
  review: () => get<PipelineState[]>('/api/review'),
  upload: uploadDocument,
};
