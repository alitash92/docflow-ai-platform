import type { FieldCandidate, IncomingDoc } from '../types.js';
import type { OCRProvider } from './ocr-provider.interface.js';

/**
 * PaddleEngine — GPU layout analysis (PaddleOCR) as used in the production
 * deployment. Import-guarded stub; the demo replays committed layout fixtures
 * through MockLayoutEngine instead, so no CUDA install is required to run it.
 */
export class PaddleEngine implements OCRProvider {
  readonly name = 'paddle-engine';

  constructor(private readonly endpoint = process.env.PADDLE_OCR_URL) {
    if (!this.endpoint) {
      throw new Error(
        'PaddleEngine requires PADDLE_OCR_URL pointing at a PaddleOCR service ' +
          '(GPU deployment). The demo runs MockLayoutEngine by default — no CUDA needed.',
      );
    }
  }

  async extract(_doc: IncomingDoc): Promise<FieldCandidate[]> {
    throw new Error(
      'PaddleEngine.extract: live GPU OCR calls are intentionally not wired in this ' +
        'demo repo. See README — "What runs locally vs what is mocked".',
    );
  }
}
