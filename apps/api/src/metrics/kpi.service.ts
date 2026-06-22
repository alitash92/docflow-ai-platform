import { readFileSync } from 'node:fs';
import type { CorpusBucket } from '../types.js';

const CORPUS_PATH = new URL('../../../../fixtures/corpus/corpus-30d.json', import.meta.url)
  .pathname;

export interface Corpus {
  windowDays: number;
  note: string;
  buckets: CorpusBucket[];
  priorPeriod: {
    count: number;
    accuracyPct: number;
    autoRoutedPct: number;
    avgCostUsd: number;
  };
}

export interface Kpis {
  windowDays: number;
  docsProcessed: number;
  accuracyPct: number;
  autoRoutedPct: number;
  avgCostUsd: number;
  deltas: {
    volumePct: number;
    accuracyPts: number;
    autoRoutedPts: number;
    costPct: number;
  };
  byType: CorpusBucket[];
}

export function loadCorpus(path = CORPUS_PATH): Corpus {
  return JSON.parse(readFileSync(path, 'utf8')) as Corpus;
}

/**
 * Every headline KPI on the dashboard is computed here, from the committed
 * 30-day corpus fixture — summed and divided at runtime, never hardcoded.
 * README section "How these numbers are produced" walks through the math.
 */
export function computeKpis(corpus = loadCorpus()): Kpis {
  const sum = (pick: (b: CorpusBucket) => number) =>
    corpus.buckets.reduce((acc, b) => acc + pick(b), 0);

  const docsProcessed = sum((b) => b.count);
  const autoRouted = sum((b) => b.autoRouted);
  const fieldsExtracted = sum((b) => b.fieldsExtracted);
  const fieldsValidated = sum((b) => b.fieldsValidated);
  const totalCost = sum((b) => b.costUsd);

  const accuracyPct = Number(((fieldsValidated / fieldsExtracted) * 100).toFixed(1));
  const autoRoutedPct = Math.round((autoRouted / docsProcessed) * 100);
  const avgCostUsd = Number((totalCost / docsProcessed).toFixed(3));

  const prior = corpus.priorPeriod;
  return {
    windowDays: corpus.windowDays,
    docsProcessed,
    accuracyPct,
    autoRoutedPct,
    avgCostUsd,
    deltas: {
      volumePct: Math.round(((docsProcessed - prior.count) / prior.count) * 100),
      accuracyPts: Number((accuracyPct - prior.accuracyPct).toFixed(1)),
      autoRoutedPts: autoRoutedPct - prior.autoRoutedPct,
      costPct: Math.round(((avgCostUsd - prior.avgCostUsd) / prior.avgCostUsd) * 100),
    },
    byType: corpus.buckets,
  };
}
