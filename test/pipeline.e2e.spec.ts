import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { mockDeps, runPipeline, type PipelineDeps } from '../apps/api/src/pipeline/graph.js';
import { loadSeedFixtures } from '../apps/api/src/ingest/channels.js';
import { computeKpis } from '../apps/api/src/metrics/kpi.service.js';

describe('pipeline end-to-end (mock engines, fixture replay)', () => {
  let deps: PipelineDeps;
  before(async () => {
    deps = await mockDeps();
  });

  it('auto-routes Referral_0482 at 0.98 with no repairs', async () => {
    const doc = loadSeedFixtures().find((d) => d.id === 'Referral_0482')!;
    const state = await runPipeline(doc, deps);
    assert.equal(state.format, 'PDF');
    assert.equal(state.classification?.type, 'Referral');
    assert.equal(state.route?.decision, 'auto-routed');
    assert.equal(state.stages.find((s) => s.stage === 'repair')?.status, 'skipped');
    assert.ok(state.costUsd > 0, 'token cost must be computed, not zero');
  });

  it('escalates Prior_Auth_017 at 0.81 after repairing both flagged fields', async () => {
    const doc = loadSeedFixtures().find((d) => d.id === 'Prior_Auth_017')!;
    const state = await runPipeline(doc, deps);
    assert.equal(state.route?.decision, 'human-review');
    assert.equal(state.judge?.overall, 0.81);
    const repaired = state.fields.filter((f) => f.repaired).map((f) => f.name).sort();
    assert.deepEqual(repaired, ['authorized_amount', 'valid_through_days']);
    assert.equal(state.fields.find((f) => f.name === 'authorized_amount')?.value, '$48,210.00');
  });

  it('detects the HEIC intake photo and the TNEF claim from magic bytes', async () => {
    const photo = loadSeedFixtures().find((d) => d.id === 'Intake_Scan_44')!;
    const claim = loadSeedFixtures().find((d) => d.id === 'Claim_2231')!;
    assert.equal((await runPipeline(photo, deps)).format, 'HEIC');
    assert.equal((await runPipeline(claim, deps)).format, 'TNEF (legacy Outlook)');
  });

  it('persists a checkpoint after every stage (restart recovery)', async () => {
    const doc = loadSeedFixtures().find((d) => d.id === 'Discharge_Summary_3')!;
    await runPipeline(doc, deps);
    const checkpoints = await deps.store.checkpointsFor(doc.id);
    assert.deepEqual(
      checkpoints.map((c) => c.stage),
      ['ingest', 'validate', 'classify', 'judge', 'repair', 'route'],
    );
  });

  it('computes the headline KPIs from the corpus fixture', () => {
    const kpis = computeKpis();
    assert.equal(kpis.docsProcessed, 4287);
    assert.equal(kpis.accuracyPct, 97.4);
    assert.equal(kpis.autoRoutedPct, 86);
    assert.equal(kpis.avgCostUsd, 0.041);
    assert.equal(kpis.deltas.volumePct, 18);
    assert.equal(kpis.deltas.costPct, -34);
  });

  it('routes exactly 5 of 6 seed docs automatically (one honest escalation)', async () => {
    const freshDeps = await mockDeps();
    for (const doc of loadSeedFixtures()) await runPipeline(doc, freshDeps);
    const runs = await freshDeps.store.listRuns();
    const auto = runs.filter((r) => r.route?.decision === 'auto-routed');
    assert.equal(runs.length, 6);
    assert.equal(auto.length, 5);
    assert.equal((await freshDeps.store.reviewQueue())[0]?.doc.id, 'Prior_Auth_017');
  });
});
