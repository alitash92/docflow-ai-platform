import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AUTO_ROUTE_THRESHOLD, route } from '../apps/api/src/pipeline/router.js';

describe('confidence routing gate', () => {
  it('auto-routes at exactly the threshold', () => {
    const d = route({ type: 'Referral', confidence: 0.9 }, { overall: AUTO_ROUTE_THRESHOLD, flagged: [] });
    assert.equal(d.decision, 'auto-routed');
    assert.equal(d.assignee, 'Cardiology Intake');
  });

  it('auto-routes well above the threshold', () => {
    const d = route({ type: 'Insurance Claim', confidence: 0.97 }, { overall: 0.97, flagged: [] });
    assert.equal(d.decision, 'auto-routed');
    assert.equal(d.assignee, 'Billing Queue');
  });

  it('escalates just below the threshold', () => {
    const d = route({ type: 'Prior Authorization', confidence: 0.89 }, { overall: 0.89, flagged: [] });
    assert.equal(d.decision, 'human-review');
    assert.match(d.reason, /0\.89 < 0\.90/);
  });

  it('escalates the 0.81 prior authorization and mentions flagged fields', () => {
    const d = route(
      { type: 'Prior Authorization', confidence: 0.81 },
      { overall: 0.81, flagged: ['authorized_amount', 'valid_through_days'] },
    );
    assert.equal(d.decision, 'human-review');
    assert.match(d.reason, /2 field\(s\) flagged/);
  });
});
