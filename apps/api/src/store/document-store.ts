import type { PipelineState, StageName } from '../types.js';

export interface Checkpoint {
  docId: string;
  stage: StageName;
  at: string;
  snapshot: PipelineState;
}

/**
 * DocumentStore — persistence seam.
 * InMemoryStore (DEFAULT) keeps the demo zero-infra; MongoStore is the
 * import-guarded production implementation (set MONGO_URL).
 *
 * Checkpoints are written after every pipeline stage so an in-progress run
 * can resume from its last completed stage after a restart.
 */
export interface DocumentStore {
  saveRun(state: PipelineState): Promise<void>;
  getRun(docId: string): Promise<PipelineState | undefined>;
  listRuns(): Promise<PipelineState[]>;
  saveCheckpoint(cp: Checkpoint): Promise<void>;
  checkpointsFor(docId: string): Promise<Checkpoint[]>;
  reviewQueue(): Promise<PipelineState[]>;
}

export class InMemoryStore implements DocumentStore {
  private runs = new Map<string, PipelineState>();
  private checkpoints = new Map<string, Checkpoint[]>();

  async saveRun(state: PipelineState): Promise<void> {
    this.runs.set(state.doc.id, state);
  }
  async getRun(docId: string): Promise<PipelineState | undefined> {
    return this.runs.get(docId);
  }
  async listRuns(): Promise<PipelineState[]> {
    return [...this.runs.values()].sort(
      (a, b) => a.doc.receivedAgoMin - b.doc.receivedAgoMin,
    );
  }
  async saveCheckpoint(cp: Checkpoint): Promise<void> {
    const list = this.checkpoints.get(cp.docId) ?? [];
    list.push(cp);
    this.checkpoints.set(cp.docId, list);
  }
  async checkpointsFor(docId: string): Promise<Checkpoint[]> {
    return this.checkpoints.get(docId) ?? [];
  }
  async reviewQueue(): Promise<PipelineState[]> {
    return (await this.listRuns()).filter((r) => r.route?.decision === 'human-review');
  }
}

/** Import-guarded production store. The demo never constructs this. */
export class MongoStore implements DocumentStore {
  constructor(url = process.env.MONGO_URL) {
    if (!url) {
      throw new Error(
        'MongoStore requires MONGO_URL. The demo runs InMemoryStore by default.',
      );
    }
    throw new Error(
      'MongoStore: the mongodb driver is intentionally not bundled in this demo repo. npm install mongodb and wire the client here for production persistence.',
    );
  }
  saveRun(): Promise<void> { return Promise.reject(new Error('not wired')); }
  getRun(): Promise<PipelineState | undefined> { return Promise.reject(new Error('not wired')); }
  listRuns(): Promise<PipelineState[]> { return Promise.reject(new Error('not wired')); }
  saveCheckpoint(): Promise<void> { return Promise.reject(new Error('not wired')); }
  checkpointsFor(): Promise<Checkpoint[]> { return Promise.reject(new Error('not wired')); }
  reviewQueue(): Promise<PipelineState[]> { return Promise.reject(new Error('not wired')); }
}
