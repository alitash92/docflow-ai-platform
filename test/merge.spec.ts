import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeFields } from '../apps/api/src/ocr/merge.js';
import type { FieldCandidate } from '../apps/api/src/types.js';

const f = (name: string, value: string, confidence: number, engine: string): FieldCandidate => ({
  name,
  value,
  confidence,
  engine,
});

describe('field-level dual-engine merge', () => {
  it('keeps the higher-confidence candidate when engines agree', () => {
    const { fields, disagreements } = mergeFields(
      [f('total', '$100.00', 0.95, 'layout')],
      [f('total', '$100.00', 0.91, 'vision')],
    );
    assert.equal(fields.length, 1);
    assert.equal(fields[0].engine, 'layout');
    assert.equal(fields[0].confidence, 0.95);
    assert.deepEqual(disagreements, []);
  });

  it('flags a value disagreement and keeps the higher-confidence value', () => {
    const { fields, disagreements } = mergeFields(
      [f('amount', '$46,210.00', 0.71, 'layout')],
      [f('amount', '$48,210.00', 0.88, 'vision')],
    );
    assert.equal(fields[0].value, '$48,210.00');
    assert.deepEqual(disagreements, ['amount']);
  });

  it('flags a large confidence gap even when values match', () => {
    const { disagreements } = mergeFields(
      [f('date', '2026-06-18', 0.55, 'layout')],
      [f('date', '2026-06-18', 0.95, 'vision')],
    );
    assert.deepEqual(disagreements, ['date']);
  });

  it('passes through fields only one engine saw', () => {
    const { fields, disagreements } = mergeFields(
      [f('only_layout', 'x', 0.9, 'layout')],
      [f('only_vision', 'y', 0.92, 'vision')],
    );
    assert.equal(fields.length, 2);
    assert.deepEqual(disagreements, []);
  });
});
