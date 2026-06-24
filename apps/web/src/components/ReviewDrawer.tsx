import { useEffect } from 'react';
import type { PipelineState } from '../api';

interface Props {
  run: PipelineState;
  onClose: () => void;
}

export default function ReviewDrawer({ run, onClose }: Props) {
  const flagged = new Set(run.judge?.flagged ?? []);
  const conf = run.judge?.overall ?? 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true" aria-label="Human review">
        <div className="drawer-head">
          <button className="drawer-close" aria-label="Close review" onClick={onClose}>
            ✕
          </button>
          <div className="drawer-kicker">Human review · flagged by routing gate</div>
          <div className="drawer-title">{run.doc.fileName}</div>
          <div className="drawer-sub">
            {run.classification?.type} · {run.doc.pages} pages · from {run.doc.sender} ·{' '}
            {run.doc.patient}
          </div>
        </div>

        <div className="drawer-body">
          <div className="verdict">
            <div className="big">{conf.toFixed(2)}</div>
            <div className="why">
              <b>Below the 0.90 auto-route threshold.</b> {run.route?.reason}. The two OCR
              engines disagreed on {flagged.size} field{flagged.size === 1 ? '' : 's'}; a correction pass resolved the values, but doc-level confidence stayed under the gate — so a human
              decides, not the model.
            </div>
          </div>

          <h4>Extracted fields · engine attribution</h4>
          {run.fields.length === 0 ? (
            <div className="empty-state compact">
              <div className="empty-title">No fields extracted</div>
              <div className="empty-sub">This document produced no structured fields.</div>
            </div>
          ) : (
            run.fields.map((f) => (
              <div className={`field-row${f.repaired ? ' flagged' : ''}`} key={f.name}>
                <span className="fname">{f.name}</span>
                <span className="fval">
                  {f.repaired && <span className="repair-tag">CORRECTED</span>}
                  {f.value}
                </span>
                <span className="fengine">
                  {f.engine} · {f.confidence.toFixed(2)}
                </span>
              </div>
            ))
          )}

          <h4>Stage trace</h4>
          {run.stages.map((s) => (
            <div className="trace-line" key={s.stage}>
              <span className="ok">{s.status === 'skipped' ? '·' : '✓'}</span> {s.stage.padEnd(9, ' ')}{' '}
              {String(s.ms).padStart(5, ' ')}ms — {s.detail}
            </div>
          ))}
        </div>

        <div className="drawer-actions">
          <button className="btn approve">✓ Approve &amp; route to Utilization Mgmt</button>
          <button className="btn ghost">Reassign</button>
          <button className="btn reject">Reject</button>
        </div>
        <div className="drawer-note">
          review decision is written to the audit trail · PII redacted at ingest (
          {run.piiRedactedTokens} token{run.piiRedactedTokens === 1 ? '' : 's'})
        </div>
      </div>
    </>
  );
}
