import { useEffect, useState } from 'react';
import type { PipelineState } from '../api';

const STAGE_LABELS: Record<string, string> = {
  ingest: 'Ingest & Decode',
  validate: 'Read — OCR Merge',
  classify: 'Classify & Extract',
  judge: 'Quality Check',
  repair: 'Correct',
  route: 'Route or Flag for Review',
};

/** 12s looping replay of the recorded fixture run. Freeze pins it mid-Quality-Check. */
const LOOP_MS = 12_000;
const FREEZE_PROGRESS = 0.74; // mid-Quality-Check on the seed run

interface Props {
  run: PipelineState;
  freeze: boolean;
}

export default function PipelinePanel({ run, freeze }: Props) {
  const [progress, setProgress] = useState(freeze ? FREEZE_PROGRESS : 0);

  useEffect(() => {
    if (freeze) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setProgress(((now - start) % LOOP_MS) / LOOP_MS);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [freeze]);

  const totalMs = run.stages.reduce((a, s) => a + s.ms, 0);
  // Map loop progress (with a small hold at the end) onto cumulative stage time.
  const replayMs = Math.min(progress / 0.88, 1) * totalMs;

  let elapsed = 0;
  const annotated = run.stages.map((s) => {
    const startMs = elapsed;
    elapsed += s.ms;
    const done = replayMs >= elapsed;
    const active = !done && replayMs >= startMs && s.ms > 0;
    return { ...s, done, active };
  });

  const shownMs = Math.min(replayMs, totalMs);

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Pipeline — {run.doc.id}</h3>
        <div className="hint">replay · {(shownMs / 1000).toFixed(1)}s / {(totalMs / 1000).toFixed(1)}s</div>
      </div>
      <div className="pipeline">
        {annotated.map((s, i) => (
          <div
            key={s.stage}
            className={`stage${s.done ? ' done' : ''}${s.active ? ' active' : ''}${
              s.status === 'skipped' ? ' skipped' : ''
            }`}
          >
            <div className="stage-rail">
              {s.done && <div className="rail-fill" />}
            </div>
            <div className="stage-icon">{s.done ? '✓' : s.active ? '●' : i + 1}</div>
            <div>
              <div className="stage-name">{STAGE_LABELS[s.stage] ?? s.stage}</div>
              <div className="stage-detail">{s.detail}{s.model ? ` · ${s.model}` : ''}</div>
            </div>
            <div className="stage-time">
              {s.status === 'skipped' ? 'skip' : s.done || s.active ? `${(s.ms / 1000).toFixed(1)}s` : '—'}
            </div>
          </div>
        ))}
      </div>
      <div className="pipeline-foot">
        <span>checkpointed after every stage · resumes on restart</span>
        <span className="cost">doc cost ${run.costUsd.toFixed(4)}</span>
      </div>
    </div>
  );
}
