import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Health, type PipelineState } from '../api';
import { FaxHeader } from './parts';

/* The interactive moment of the paper landing: an "intake tray" sheet.
   The visitor feeds the machine a document (sample chip, or a real upload in
   real mode) and the ACTUAL pipeline answers — fields, confidences, and the
   routing decision — typed back onto the paper. Nothing is hard-coded. */

const SAMPLES = [
  { id: 'Prior_Auth_017', label: 'PRIOR AUTHORIZATION', note: 'MRI lumbar · handwritten amounts' },
  { id: 'Claim_2231', label: 'INSURANCE CLAIM', note: 'institutional claim form' },
  { id: 'Lab_Report_09', label: 'LAB REPORT', note: 'multi-analyte panel' },
];

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export default function PaperTryIt() {
  const [docId, setDocId] = useState(SAMPLES[0].id);
  const [run, setRun] = useState<PipelineState | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(0); // re-triggers the reveal animation
  const fileRef = useRef<HTMLInputElement | null>(null);

  const realMode = health?.mode === 'real';
  const threshold = health?.threshold ?? 0.9;

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    setBusy(true);
    setError(null);
    api
      .document(docId)
      .then((r) => {
        if (!alive) return;
        setRun(r);
        setRunKey((k) => k + 1);
        setBusy(false);
      })
      .catch((e: Error) => {
        if (!alive) return;
        setError(e.message);
        setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [docId]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.upload(file);
      setRun(r);
      setRunKey((k) => k + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const flagged = new Set(run?.judge?.flagged ?? []);
  const decision = run?.route?.decision;

  return (
    <div className="pp-page pp-tray">
      <FaxHeader page={4} />
      <div className="pp-doc-head">
        <div>
          <div className="pp-doc-title">INTAKE TRAY — RUN A DOCUMENT YOURSELF</div>
          <div className="pp-doc-sub">
            the actual pipeline answers below · nothing pre-written
          </div>
        </div>
      </div>
      <div className="pp-rule" aria-hidden="true" />

      {/* feed the machine */}
      <div className="pp-tray-feed" role="group" aria-label="Choose a sample document">
        {SAMPLES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`pp-tray-chip${s.id === docId ? ' is-active' : ''}`}
            onClick={() => setDocId(s.id)}
            disabled={busy}
          >
            <b>{s.label}</b>
            <span>{s.note}</span>
          </button>
        ))}
        {realMode ? (
          <label className={`pp-tray-chip pp-tray-upload${busy ? ' is-busy' : ''}`}>
            <b>⇪ FEED YOUR OWN PAGE</b>
            <span>PDF · PNG · JPG — live extraction</span>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.csv,.xlsx"
              onChange={onUpload}
              disabled={busy}
            />
          </label>
        ) : (
          <span className="pp-tray-mocknote">
            live upload runs on the deployed demo — the samples below run the same pipeline
          </span>
        )}
      </div>

      {/* the machine's typed-back answer */}
      <div className="pp-tray-out" key={runKey} aria-live="polite">
        {busy && <div className="pp-tray-reading">READING<span className="pp-cursor">▊</span></div>}
        {error && <div className="pp-tray-error">✗ {error} — is the pipeline awake? try again.</div>}
        {!busy && !error && run && (
          <>
            <div className="pp-tray-meta">
              <span>
                {run.doc.fileName} · {run.doc.pages} page(s) · via {run.doc.source}
              </span>
              <span>
                classified: <b>{run.classification?.type ?? '—'}</b>{' '}
                {run.classification ? `@ ${run.classification.confidence.toFixed(2)}` : ''}
              </span>
            </div>
            <table className="pp-tray-table">
              <thead>
                <tr>
                  <th>FIELD</th>
                  <th>MACHINE READ</th>
                  <th>CONF</th>
                  <th>ENGINE</th>
                </tr>
              </thead>
              <tbody>
                {run.fields.map((f, i) => {
                  const isFlagged = flagged.has(f.name) || f.confidence < threshold;
                  return (
                    <tr
                      key={f.name}
                      className={`pp-tray-row${isFlagged ? ' is-flagged' : ''}`}
                      style={{ '--d': `${i * 90}ms` } as React.CSSProperties}
                    >
                      <td className="pp-tray-name">{f.name}</td>
                      <td>
                        <span className="pp-tray-read">{f.value || '—'}</span>
                        {f.repaired && <span className="pp-tray-repaired">corrected</span>}
                      </td>
                      <td className="pp-tray-conf">
                        {pct(f.confidence)}
                        {isFlagged ? ' ⚑' : ' ✓'}
                      </td>
                      <td className="pp-tray-engine">{f.engine}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="pp-tray-verdict">
              {decision === 'human-review' ? (
                <span className="pp-stamp pp-stamp-amber" style={{ '--tilt': '-4deg' } as React.CSSProperties}>
                  ⚑ HELD FOR HUMAN REVIEW
                </span>
              ) : (
                <span className="pp-stamp pp-stamp-green" style={{ '--tilt': '-4deg' } as React.CSSProperties}>
                  AUTO-ROUTED → {run.route?.assignee ?? 'DOWNSTREAM'}
                </span>
              )}
              <span className="pp-tray-cost">
                quality {run.judge ? run.judge.overall.toFixed(2) : '—'} · gate ≥ {threshold} · cost $
                {run.costUsd.toFixed(4)} · PII tokens redacted: {run.piiRedactedTokens}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="pp-tray-foot">
        <Link to="/demo/live" className="pp-pencil-link">
          want the stage-by-stage walkthrough? → full live demo
        </Link>
      </div>
    </div>
  );
}
