/**
 * DocFlow AI — end-to-end demo run.
 *
 *   npm run demo
 *
 * Drains the mock inbound channels (email / SMS / upload), walks every seed
 * document through Ingest → Validate → Classify → Judge → Repair → Route,
 * prints the per-stage trace with token cost, then the routing summary, the
 * human-review queue, and the 30-day KPIs computed from the corpus fixture.
 *
 * Deterministic fixture run #042 — no API keys, no network, no GPU.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { mockChannels } from '../apps/api/src/ingest/channels.js';
import { mockDeps, runPipeline } from '../apps/api/src/pipeline/graph.js';
import { computeKpis } from '../apps/api/src/metrics/kpi.service.js';
import { AUTO_ROUTE_THRESHOLD } from '../apps/api/src/pipeline/router.js';
import { formatUsd } from '../apps/api/src/cost/token-meter.js';
import type { IncomingDoc, PipelineState } from '../apps/api/src/types.js';

const line = (c = '─') => console.log(c.repeat(78));

async function main() {
  console.log('\nDocFlow AI — deterministic fixture run #042 (mock engines, zero keys)\n');

  const deps = await mockDeps();
  const states: PipelineState[] = [];

  // 1 ── Inbox ingestion
  line('═');
  console.log('INBOUND CHANNELS');
  line('═');
  const queue: { channel: string; docs: IncomingDoc[] }[] = [];
  for (const channel of mockChannels()) {
    const docs = await channel.fetch();
    console.log(`  ${channel.label.padEnd(42)} ${docs.length} document(s)`);
    queue.push({ channel: channel.label, docs });
  }

  // 2 ── Pipeline runs
  for (const { docs } of queue) {
    for (const doc of docs) {
      console.log('');
      line();
      console.log(`▶ ${doc.fileName}`);
      console.log(`  from ${doc.sender} · ${doc.patient}`);
      line();
      const state = await runPipeline(doc, deps);
      states.push(state);
      for (const s of state.stages) {
        const tag = s.status === 'skipped' ? '·' : '✓';
        const cost = s.costUsd !== undefined ? `  ${formatUsd(s.costUsd)}` : '';
        const model = s.model ? `  [${s.model}]` : '';
        console.log(
          `  ${tag} ${s.stage.padEnd(9)} ${String(s.ms).padStart(5)}ms  ${s.detail}${model}${cost}`,
        );
      }
      const checkpoints = await deps.store.checkpointsFor(doc.id);
      const decision = state.route!;
      const flag = decision.decision === 'auto-routed' ? '🟢' : '🟡';
      console.log(
        `  ${flag} ${decision.decision.toUpperCase()} → ${decision.assignee}  (${decision.reason})`,
      );
      console.log(
        `     doc cost ${formatUsd(state.costUsd)} · ${checkpoints.length} checkpoints persisted · format ${state.format}`,
      );
    }
  }

  // 3 ── Routing summary
  console.log('');
  line('═');
  console.log(`ROUTING SUMMARY  (gate: confidence ≥ ${AUTO_ROUTE_THRESHOLD.toFixed(2)} auto-routes)`);
  line('═');
  for (const s of states) {
    const mark = s.route!.decision === 'auto-routed' ? '🟢 auto ' : '🟡 review';
    console.log(
      `  ${mark}  ${s.doc.id.padEnd(20)} ${s.classification!.type.padEnd(13)} conf ${s
        .judge!.overall.toFixed(2)}  → ${s.route!.assignee}`,
    );
  }
  const auto = states.filter((s) => s.route!.decision === 'auto-routed').length;
  console.log(`\n  ${auto}/${states.length} auto-routed · ${states.length - auto} escalated to human review`);

  // 4 ── Review queue (the imperfection is the point)
  const review = await deps.store.reviewQueue();
  console.log('');
  line('═');
  console.log('HUMAN REVIEW QUEUE');
  line('═');
  for (const r of review) {
    console.log(`  ⚠ ${r.doc.fileName} — ${r.classification!.type} @ ${r.judge!.overall.toFixed(2)}`);
    for (const f of r.fields.filter((f) => f.repaired)) {
      console.log(`      repaired field: ${f.name} → "${f.value}" (${f.engine})`);
    }
  }

  // 5 ── KPIs computed from the committed corpus
  const kpis = computeKpis();
  console.log('');
  line('═');
  console.log(`30-DAY KPIs — computed from fixtures/corpus/corpus-30d.json`);
  line('═');
  console.log(`  documents processed   ${kpis.docsProcessed.toLocaleString('en-US')}   (▲ ${kpis.deltas.volumePct}% vs prior period)`);
  console.log(`  extraction accuracy   ${kpis.accuracyPct}%   (▲ ${kpis.deltas.accuracyPts} pts)`);
  console.log(`  auto-routed           ${kpis.autoRoutedPct}%    (▲ ${kpis.deltas.autoRoutedPts} pts — review queue shrinking)`);
  console.log(`  avg cost per doc      $${kpis.avgCostUsd.toFixed(3)} (▼ ${Math.abs(kpis.deltas.costPct)}% via model routing)`);

  const totalDemoCost = states.reduce((a, s) => a + s.costUsd, 0);
  console.log(`\n  this demo run: ${states.length} documents · total LLM cost ${formatUsd(totalDemoCost)} (computed from mock token usage)`);

  // 6 ── Artifact for the dashboard / CI
  mkdirSync(new URL('../out', import.meta.url).pathname, { recursive: true });
  const outPath = new URL('../out/demo-run.json', import.meta.url).pathname;
  writeFileSync(outPath, JSON.stringify({ kpis, runs: states }, null, 2));
  console.log(`\n  full run artifact → out/demo-run.json`);
  console.log('\nDone. Start the dashboard with: npm run serve  →  http://localhost:4810\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
