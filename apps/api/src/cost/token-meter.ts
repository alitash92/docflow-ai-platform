/**
 * Token cost meter — per-stage, per-model accounting.
 *
 * Prices are USD per million tokens. The demo's per-document cost is computed
 * from the tokens the (mocked) model calls actually report — never hardcoded.
 */

export interface ModelPrice {
  inPerMTok: number;
  outPerMTok: number;
}

const PRICES: Record<string, ModelPrice> = {
  // Mock-replay model labels (key-free demo default).
  'claude-haiku': { inPerMTok: 0.8, outPerMTok: 4.0 },
  'claude-sonnet': { inPerMTok: 3.0, outPerMTok: 15.0 },
  // Real-mode frontier vision-LLM price table (USD per million tokens).
  'gpt-4o-mini': { inPerMTok: 0.15, outPerMTok: 0.6 },
  'gpt-4o': { inPerMTok: 2.5, outPerMTok: 10.0 },
};

function priceFor(model: string): ModelPrice {
  const key = Object.keys(PRICES).find((k) => model.startsWith(k));
  if (!key) throw new Error(`token-meter: no price entry for model "${model}"`);
  return PRICES[key];
}

export function costUsd(model: string, tokensIn: number, tokensOut: number): number {
  const p = priceFor(model);
  return (tokensIn * p.inPerMTok + tokensOut * p.outPerMTok) / 1_000_000;
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}
