import { useEffect, useRef, useState } from 'react';
import type { Kpis } from '../api';

/** Eased count-up that snaps to the final value in freeze mode. */
function useCountUp(target: number, freeze: boolean, durationMs = 1400): number {
  const [value, setValue] = useState(freeze ? target : 0);
  const raf = useRef<number>();
  useEffect(() => {
    if (freeze) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current!);
  }, [target, freeze, durationMs]);
  return value;
}

interface Props {
  kpis: Kpis;
  freeze: boolean;
}

export default function KpiCards({ kpis, freeze }: Props) {
  const docs = useCountUp(kpis.docsProcessed, freeze);
  const acc = useCountUp(kpis.accuracyPct, freeze);
  const auto = useCountUp(kpis.autoRoutedPct, freeze);
  const cost = useCountUp(kpis.avgCostUsd * 1000, freeze); // animate in tenths of a cent

  const cards = [
    {
      label: `Documents processed (${kpis.windowDays}d)`,
      value: Math.round(docs).toLocaleString('en-US'),
      delta: `▲ ${kpis.deltas.volumePct}% vs prior period`,
      dir: 'up' as const,
    },
    {
      label: 'Avg extraction accuracy',
      value: `${acc.toFixed(1)}%`,
      delta: `▲ ${kpis.deltas.accuracyPts} pts vs prior period`,
      dir: 'up' as const,
    },
    {
      label: 'Auto-routed, zero human touch',
      value: `${Math.round(auto)}%`,
      delta: `▲ ${kpis.deltas.autoRoutedPts} pts — review queue shrinking`,
      dir: 'up' as const,
    },
    {
      label: 'Avg cost per document',
      value: `$${(cost / 1000).toFixed(3)}`,
      delta: `▼ ${Math.abs(kpis.deltas.costPct)}% via model routing`,
      dir: 'down' as const,
    },
  ];

  return (
    <section className="kpis">
      {cards.map((c, i) => (
        <div className="kpi rise" style={{ animationDelay: `${i * 90}ms` }} key={c.label}>
          <div className="label">{c.label}</div>
          <div className="value">{c.value}</div>
          <div className={`delta ${c.dir}`}>{c.delta}</div>
        </div>
      ))}
    </section>
  );
}
