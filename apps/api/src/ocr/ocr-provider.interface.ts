import type { FieldCandidate, IncomingDoc } from '../types.js';

/**
 * OCRProvider — the seam between the pipeline and any OCR backend.
 *
 * Implementations:
 *  - MockLayoutEngine / MockVisionEngine (DEFAULT) — replay committed layout
 *    fixtures, deterministic, key-free.
 *  - VisionEngine  — Claude Vision semantic validation (needs ANTHROPIC_API_KEY).
 *  - TextractEngine — AWS Textract compliance-grade tables (needs AWS creds).
 *
 * The pipeline only ever talks to this interface, so swapping a real engine in
 * is a constructor argument, not a refactor.
 */
export interface OCRProvider {
  readonly name: string;
  extract(doc: IncomingDoc): Promise<FieldCandidate[]>;
}
