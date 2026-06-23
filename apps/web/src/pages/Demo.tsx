import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import MarketingNav from '../components/MarketingNav';
import MarketingFooter from '../components/MarketingFooter';
import {
  api,
  type EngineCandidates,
  type Health,
  type MergedField,
  type PipelineState,
} from '../api';

/* ──────────────────────────────────────────────────────────────────────────
   /demo — the guided, public, single-flow walkthrough.

   One healthcare document is run through the REAL pipeline at runtime (the same
   ingest → dual-engine OCR merge → classify → judge → repair → route code the
   dashboard uses). This page animates through that result stage by stage and
   labels the technique behind each stage. Everything shown is computed —
   nothing here is hard-coded narrative.
   ────────────────────────────────────────────────────────────────────────── */

interface StageDef {
  key: string;
  /** Which pipeline stage(s) this rail node maps to. */
  stages: string[];
  label: string;
  /** The technique label — provider-neutral. */
  tech: string;
  blurb: string;
}

/* The rail. "Extract" is its own visible node even though the pipeline emits the
   merged fields under the `validate` stage — we split the story for the viewer. */
const RAIL: StageDef[] = [
  {
    key: 'ingest',
    stages: ['ingest'],
    label: 'Ingest',
    tech: 'Format detection · magic-byte sniff · PII redaction',
    blurb: 'The file is sniffed by its first bytes, the channel is recorded, and PII tokens are redacted before anything is logged.',
  },
  {
    key: 'ocr',
    stages: ['validate'],
    label: 'OCR',
    tech: 'Dual-engine OCR · layout + vision · field-level merge',
    blurb: 'Two independent engines read every page — a layout engine and a vision engine. Their outputs are reconciled field by field; the higher-confidence read wins and disagreements are recorded.',
  },
  {
    key: 'classify',
    stages: ['classify'],
    label: 'Classify',
    tech: 'Frontier vision LLM · schema-enforced output',
    blurb: 'A frontier vision LLM types the document and returns a confidence — constrained to a strict schema so the result is always machine-routable.',
  },
  {
    key: 'extract',
    stages: ['validate'],
    label: 'Extract',
    tech: 'Per-field values · confidence · source engine',
    blurb: 'Every extracted field carries its own confidence and the engine that produced it — not one document-level score.',
  },
  {
    key: 'judge',
    stages: ['judge'],
    label: 'Judge',
    tech: 'LLM self-critique · cross-engine disagreement',
    blurb: 'A judge pass scores the document and flags fields where the two engines disagreed beyond tolerance — the self-critique loop.',
  },
  {
    key: 'repair',
    stages: ['repair'],
    label: 'Repair',
    tech: 'Targeted re-extraction of flagged fields',
    blurb: 'Only the flagged fields are re-extracted and corrected, then merged back. Clean fields are never touched.',
  },
  {
    key: 'route',
    stages: ['route'],
    label: 'Route',
    tech: 'Confidence gate ≥ 0.90 · auto-route or human review',
    blurb: 'A single, unit-tested gate reads the judge score. At or above the threshold the document auto-routes; anything uncertain is held for a human.',
  },
];

const SAMPLES = [
  { id: 'Prior_Auth_017', label: 'Prior Authorization', note: 'MRI lumbar · handwritten amounts' },
  { id: 'Claim_2231', label: 'Insurance Claim', note: 'institutional claim form' },
  { id: 'Lab_Report_09', label: 'Lab Report', note: 'multi-analyte panel' },
];

const STEP_MS = 1150; // per-stage dwell while auto-playing

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function confClass(c: number) {
  if (c >= 0.9) return 'high';
  if (c >= 0.75) return 'mid';
  return 'low';
}

export default function Demo() {
  const freeze = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('screenshot') === '1' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }, []);
  const startStage = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const s = Number(params.get('stage'));
    return Number.isFinite(s) && s >= 0 && s < RAIL.length ? s : null;
  }, []);

  const [docId, setDocId] = useState(SAMPLES[0].id);
  const [run, setRun] = useState<PipelineState | null>(null);
  const [engines, setEngines] = useState<EngineCandidates | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // How far through the rail the walkthrough has revealed.
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(!freeze);
  const timer = useRef<number | null>(null);

  const realMode = health?.mode === 'real';

  // ── load the real pipeline result for the chosen document ────────────────
  const load = useCallback((id: string) => {
    setLoading(true);
    setError(null);
    setRun(null);
    setEngines(null);
    Promise.all([api.document(id), api.engines(id)])
      .then(([r, e]) => {
        setRun(r);
        setEngines(e);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
  }, []);

  useEffect(() => {
    load(docId);
  }, [docId, load]);

  // ── auto-advance the walkthrough ─────────────────────────────────────────
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (freeze) {
      setActive(startStage ?? RAIL.length - 1);
      setPlaying(false);
      return;
    }
    if (!playing || loading || !run) return;
    if (active >= RAIL.length - 1) {
      setPlaying(false);
      return;
    }
    timer.current = window.setTimeout(() => setActive((a) => a + 1), STEP_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [active, playing, loading, run, freeze, startStage]);

  function replay() {
    setActive(0);
    setPlaying(true);
  }

  function pickSample(id: string) {
    setDocId(id);
    setActive(0);
    setPlaying(!freeze);
  }

  const sample = SAMPLES.find((s) => s.id === docId) ?? SAMPLES[0];
  const reachedExtract = active >= RAIL.findIndex((r) => r.key === 'extract');
  const reachedRoute = active >= RAIL.length - 1;

  // Stage timing/detail by pipeline stage name, for the active rail node.
  const stageByName = useMemo(() => {
    const m = new Map<string, PipelineState['stages'][number]>();
    run?.stages.forEach((s) => m.set(s.stage, s));
    return m;
  }, [run]);

  const flagged = new Set(run?.judge?.flagged ?? []);

  return (
    <div className={`mkt demo-page paper-grain${freeze ? ' freeze' : ''}`}>
      <MarketingNav />

      <main id="main">
        {/* Header band */}
        <section className="demo-head">
          <div className="demo-head-glow" aria-hidden="true" />
          <div className="mkt-container demo-head-inner">
            <span className="demo-eyebrow">▶ Live demo · no signup needed</span>
            <h1 className="demo-title">Watch the pipeline run on a real document</h1>
            <p className="demo-sub">
              One synthetic healthcare document, run through the actual pipeline at runtime —
              ingestion, dual-engine OCR, a frontier vision LLM, a judge/repair loop, and a
              confidence-gated routing decision. This is a minimal version of a production system;
              every value below is computed live, not scripted.
            </p>

            <div className="demo-doc-picker" role="group" aria-label="Choose a sample document">
              {SAMPLES.map((s) => (
                <button
                  key={s.id}
                  className={`demo-doc-chip${s.id === docId ? ' on' : ''}`}
                  aria-pressed={s.id === docId}
                  onClick={() => pickSample(s.id)}
                >
                  <span className="demo-doc-chip-label">{s.label}</span>
                  <span className="demo-doc-chip-note">{s.note}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mkt-container demo-body">
          {error && (
            <div className="demo-error" role="alert">
              Could not reach the live pipeline ({error}). Make sure the API is running.
            </div>
          )}

          <div className="demo-grid">
            {/* ── Stage rail ─────────────────────────────────────────────── */}
            <aside className="demo-rail" aria-label="Pipeline stages">
              <ol>
                {RAIL.map((node, i) => {
                  const state =
                    i < active ? 'done' : i === active ? 'active' : 'pending';
                  const s = stageByName.get(node.stages[0]);
                  const skipped = node.key === 'repair' && s?.status === 'skipped';
                  return (
                    <li key={node.key} className={`demo-rail-node ${state}`}>
                      <div className="demo-rail-marker" aria-hidden="true">
                        {i < active ? '✓' : i + 1}
                      </div>
                      <div className="demo-rail-text">
                        <div className="demo-rail-label">
                          {node.label}
                          {skipped && i <= active && (
                            <span className="demo-rail-skip">skipped</span>
                          )}
                        </div>
                        <div className="demo-rail-tech">{node.tech}</div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </aside>

            {/* ── Stage detail / live result ─────────────────────────────── */}
            <div className="demo-stage" aria-live="polite">
              {loading || !run ? (
                <div className="demo-stage-card demo-skel">
                  <div className="demo-skel-line w60" />
                  <div className="demo-skel-line w40" />
                  <div className="demo-skel-block" />
                </div>
              ) : (
                <StagePanel
                  node={RAIL[active]}
                  index={active}
                  run={run}
                  engines={engines}
                  sample={sample}
                  flagged={flagged}
                  reachedExtract={reachedExtract}
                />
              )}

              {/* Controls */}
              <div className="demo-controls">
                <button className="btn" onClick={replay} disabled={loading}>
                  ↻ {reachedRoute ? 'Run again' : 'Restart'}
                </button>
                {!reachedRoute && (
                  <button
                    className="btn ghost"
                    onClick={() => (playing ? setPlaying(false) : setPlaying(true))}
                    disabled={loading}
                  >
                    {playing ? 'Pause' : 'Resume'}
                  </button>
                )}
                <button
                  className="btn ghost"
                  onClick={() => {
                    setPlaying(false);
                    setActive((a) => Math.min(a + 1, RAIL.length - 1));
                  }}
                  disabled={loading || reachedRoute}
                >
                  Step →
                </button>
                <div className="demo-controls-spacer" />
                <Link to="/signup" className="btn ghost">Open full dashboard</Link>
              </div>
            </div>
          </div>

          {/* ── Final result summary (revealed at Route) ─────────────────── */}
          {run && reachedExtract && (
            <ResultSummary run={run} flagged={flagged} reachedRoute={reachedRoute} />
          )}

          {/* ── "What you're seeing" + upload ─────────────────────────────── */}
          <div className="demo-explain-grid">
            <div className="demo-explain">
              <h2>What you’re seeing</h2>
              <p>
                This is a minimal, honest version of a production document-intelligence
                pipeline. The orchestration, merge logic, confidence gate, and cost metering
                are real, unit-tested code; in this key-free build the OCR engines and the
                LLM replay committed fixtures, so the same flow runs fully offline.
              </p>
              <ul className="demo-explain-list">
                <li><b>Dual-engine OCR</b> — two engines per page, reconciled field by field.</li>
                <li><b>Frontier vision LLM</b> — classification &amp; extraction, schema-enforced (provider-neutral).</li>
                <li><b>Judge / repair loop</b> — self-critique flags disagreements; only flagged fields are re-extracted.</li>
                <li><b>Confidence-gated routing</b> — one pure gate decides auto-route vs. human review.</li>
                <li><b>Per-document cost tracking</b> — token usage metered and rolled into KPIs.</li>
              </ul>
            </div>

            <div className="demo-upload">
              <h2>Try your own document</h2>
              {realMode ? (
                <UploadPanel onResult={(r) => { setRun(r); setEngines(null); setActive(0); setPlaying(!freeze); }} />
              ) : (
                <div className="demo-upload-locked">
                  <div className="demo-upload-lock" aria-hidden="true">🔒</div>
                  <p>
                    Uploading your own file runs it through a live frontier vision LLM. That’s
                    available in the full version with an API key configured. This public demo
                    runs key-free on committed synthetic fixtures.
                  </p>
                  <button className="btn" disabled>Upload a document — full version</button>
                  <p className="demo-upload-honest">
                    Honest by design: no key here means no real model call, so this stays
                    disabled rather than faking a result.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

/* ── Per-stage content panel ─────────────────────────────────────────────── */
function StagePanel({
  node,
  index,
  run,
  engines,
  sample,
  flagged,
  reachedExtract,
}: {
  node: StageDef;
  index: number;
  run: PipelineState;
  engines: EngineCandidates | null;
  sample: { id: string; label: string; note: string };
  flagged: Set<string>;
  reachedExtract: boolean;
}) {
  const s = run.stages.find((x) => x.stage === node.stages[0]);
  const ms = s?.ms ?? 0;

  return (
    <div className="demo-stage-card rise" key={node.key}>
      <div className="demo-stage-top">
        <div>
          <div className="demo-stage-kicker">Stage {index + 1} / {RAIL.length}</div>
          <h2 className="demo-stage-name">{node.label}</h2>
        </div>
        <div className="demo-stage-time">
          {s?.status === 'skipped' ? 'skipped' : ms ? `${(ms / 1000).toFixed(1)}s` : ''}
        </div>
      </div>

      <div className="demo-tech-pill">{node.tech}</div>
      <p className="demo-stage-blurb">{node.blurb}</p>

      {/* Live, computed detail straight from the pipeline run. */}
      {s && (
        <div className="demo-stage-detail">
          <span className="demo-detail-dot" aria-hidden="true" />
          {s.detail}
          {s.model ? ` · ${s.model}` : ''}
        </div>
      )}

      {/* Stage-specific live visualization */}
      {node.key === 'ingest' && (
        <div className="demo-kv">
          <div><span>Document</span><b>{run.doc.fileName}</b></div>
          <div><span>Channel</span><b>{run.doc.source}</b></div>
          <div><span>Pages</span><b>{run.doc.pages}</b></div>
          <div><span>Format</span><b>{run.format}</b></div>
          <div><span>Patient</span><b>{run.doc.patient}</b></div>
          <div><span>PII redacted</span><b>{run.piiRedactedTokens} token(s)</b></div>
        </div>
      )}

      {node.key === 'ocr' && engines && (
        <EngineMerge engines={engines} merged={run.fields} flagged={flagged} />
      )}

      {node.key === 'classify' && run.classification && (
        <div className="demo-classify">
          <div className="demo-classify-type">{run.classification.type}</div>
          <ConfBar c={run.classification.confidence} label="type confidence" />
        </div>
      )}

      {node.key === 'extract' && (
        <FieldTable fields={run.fields} flagged={flagged} repaired={false} />
      )}

      {node.key === 'judge' && run.judge && (
        <div className="demo-judge">
          <ConfBar c={run.judge.overall} label="overall document confidence" />
          {run.judge.flagged.length > 0 ? (
            <div className="demo-flag-list">
              <span className="demo-flag-head">Flagged by judge</span>
              {run.judge.flagged.map((f) => (
                <span key={f} className="demo-flag-chip">⚑ {f}</span>
              ))}
            </div>
          ) : (
            <div className="demo-judge-clean">No cross-engine disagreements — nothing flagged.</div>
          )}
        </div>
      )}

      {node.key === 'repair' && (
        s?.status === 'skipped' ? (
          <div className="demo-judge-clean">No fields needed repair on this document.</div>
        ) : (
          <FieldTable
            fields={run.fields.filter((f) => f.repaired)}
            flagged={flagged}
            repaired
            emptyNote="No repairs were required."
          />
        )
      )}

      {node.key === 'route' && run.route && (
        <RouteCard route={run.route} />
      )}

      {!reachedExtract && node.key === 'extract' && (
        <div className="demo-skel-block" />
      )}
    </div>
  );
}

/* ── Dual-engine merge visualization ─────────────────────────────────────── */
function EngineMerge({
  engines,
  merged,
  flagged,
}: {
  engines: EngineCandidates;
  merged: MergedField[];
  flagged: Set<string>;
}) {
  const byName = (list: { name: string; value: string; confidence: number }[]) =>
    new Map(list.map((f) => [f.name, f]));
  const layout = byName(engines.layoutEngine);
  const vision = byName(engines.visionEngine);
  const names = merged.map((f) => f.name);

  return (
    <div className="demo-merge">
      <div className="demo-merge-head">
        <span>Field</span>
        <span>Layout engine</span>
        <span>Vision engine</span>
        <span>Merged →</span>
      </div>
      {names.map((name) => {
        const l = layout.get(name);
        const v = vision.get(name);
        const m = merged.find((f) => f.name === name)!;
        const disagree = l && v && l.value !== v.value;
        return (
          <div key={name} className={`demo-merge-row${disagree ? ' disagree' : ''}`}>
            <span className="demo-merge-field">{name}{flagged.has(name) && ' ⚑'}</span>
            <span className={`demo-merge-cell ${l ? confClass(l.confidence) : ''}`}>
              {l ? `${l.value}` : '—'}
              {l && <i>{pct(l.confidence)}</i>}
            </span>
            <span className={`demo-merge-cell ${v ? confClass(v.confidence) : ''}`}>
              {v ? `${v.value}` : '—'}
              {v && <i>{pct(v.confidence)}</i>}
            </span>
            <span className={`demo-merge-cell win ${confClass(m.confidence)}`}>
              {m.value}
              <i>{pct(m.confidence)}</i>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Field table with confidence bars ────────────────────────────────────── */
function FieldTable({
  fields,
  flagged,
  repaired,
  emptyNote,
}: {
  fields: MergedField[];
  flagged: Set<string>;
  repaired: boolean;
  emptyNote?: string;
}) {
  if (fields.length === 0) {
    return <div className="demo-judge-clean">{emptyNote ?? 'No fields.'}</div>;
  }
  return (
    <div className="demo-fields">
      {fields.map((f) => (
        <div key={f.name} className="demo-field-row">
          <div className="demo-field-meta">
            <span className="demo-field-name">
              {f.name}
              {f.repaired && <span className="demo-tag repaired">repaired</span>}
              {!f.repaired && flagged.has(f.name) && <span className="demo-tag flagged">flagged</span>}
            </span>
            <span className="demo-field-engine">{f.engine}</span>
          </div>
          <div className="demo-field-val">{f.value}</div>
          <ConfBar c={f.confidence} compact />
        </div>
      ))}
      {repaired && (
        <p className="demo-fields-foot">
          Only flagged fields were re-extracted and merged back; clean fields were left untouched.
        </p>
      )}
    </div>
  );
}

function ConfBar({ c, label, compact }: { c: number; label?: string; compact?: boolean }) {
  return (
    <div className={`demo-conf${compact ? ' compact' : ''}`}>
      <div className="demo-conf-track">
        <div className={`demo-conf-fill ${confClass(c)}`} style={{ width: pct(c) }} />
      </div>
      <span className="demo-conf-val">{pct(c)}{label ? ` · ${label}` : ''}</span>
    </div>
  );
}

function RouteCard({ route }: { route: NonNullable<PipelineState['route']> }) {
  const auto = route.decision === 'auto-routed';
  return (
    <div className={`demo-route ${auto ? 'auto' : 'review'}`}>
      <div className="demo-route-badge">{auto ? '✓ Auto-routed' : '⚑ Human review'}</div>
      <div className="demo-route-assignee">→ {route.assignee}</div>
      <div className="demo-route-reason">{route.reason}</div>
    </div>
  );
}

/* ── Final result summary card ───────────────────────────────────────────── */
function ResultSummary({
  run,
  flagged,
  reachedRoute,
}: {
  run: PipelineState;
  flagged: Set<string>;
  reachedRoute: boolean;
}) {
  const totalMs = run.stages.reduce((a, s) => a + s.ms, 0);
  const repairedCount = run.fields.filter((f) => f.repaired).length;
  return (
    <div className="demo-summary rise">
      <div className="demo-summary-head">
        <h2>Extraction result</h2>
        <div className="demo-summary-stats">
          <span><b>{run.fields.length}</b> fields</span>
          <span><b>{flagged.size}</b> flagged</span>
          <span><b>{repairedCount}</b> repaired</span>
          <span><b>{(totalMs / 1000).toFixed(1)}s</b> total</span>
          <span><b>${run.costUsd.toFixed(4)}</b> cost</span>
        </div>
      </div>
      <FieldTable fields={run.fields} flagged={flagged} repaired={false} />
      {reachedRoute && run.route && <RouteCard route={run.route} />}
    </div>
  );
}

/* ── Real-mode upload panel ──────────────────────────────────────────────── */
function UploadPanel({ onResult }: { onResult: (r: PipelineState) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const r = await api.upload(file);
      onResult(r);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="demo-upload-real">
      <div className="demo-mode-pill live">● Real mode active — live vision LLM</div>
      <p>
        Upload a document (PDF or image, ≤ 20&nbsp;MB) and it runs through the live pipeline.
        Use synthetic test data only — never real PHI.
      </p>
      <label className="btn btn-block">
        {busy ? 'Extracting…' : 'Upload a document'}
        <input type="file" accept=".pdf,image/*" onChange={onPick} disabled={busy} hidden />
      </label>
      {err && <div className="demo-upload-err" role="alert">{err}</div>}
    </div>
  );
}
