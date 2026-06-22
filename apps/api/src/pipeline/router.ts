import type { Classification, DocType, JudgeVerdict, RouteDecision } from '../types.js';

/** The confidence gate: at or above this, a document routes with zero human touch. */
export const AUTO_ROUTE_THRESHOLD = 0.9;

const ASSIGNEES: Record<DocType, string> = {
  Referral: 'Cardiology Intake',
  'Prior Authorization': 'Utilization Mgmt',
  'Insurance Claim': 'Billing Queue',
  'Discharge Summary': 'Care Coordination',
  'Lab Report': 'Results Triage',
  'Patient Intake': 'Front Desk / Registration',
};

/**
 * The routing gate — deliberately small, pure, and unit-tested.
 * Everything upstream exists to produce one honest number (judge.overall);
 * this function is the only thing allowed to act on it.
 */
export function route(classification: Classification, judge: JudgeVerdict): RouteDecision {
  const assignee = ASSIGNEES[classification.type];
  if (judge.overall >= AUTO_ROUTE_THRESHOLD) {
    return {
      decision: 'auto-routed',
      assignee,
      reason: `confidence ${judge.overall.toFixed(2)} ≥ ${AUTO_ROUTE_THRESHOLD.toFixed(2)} threshold`,
    };
  }
  return {
    decision: 'human-review',
    assignee: 'Review Queue',
    reason: `confidence ${judge.overall.toFixed(2)} < ${AUTO_ROUTE_THRESHOLD.toFixed(2)} threshold${
      judge.flagged.length ? ` · ${judge.flagged.length} field(s) flagged by judge` : ''
    }`,
  };
}
