import type { FieldCandidate, IncomingDoc } from '../types.js';
import type { OCRProvider } from './ocr-provider.interface.js';

/**
 * TextractEngine — compliance-grade table extraction via AWS Textract.
 * Import-guarded stub; the demo uses the mock engines by default.
 */
export class TextractEngine implements OCRProvider {
  readonly name = 'textract-engine';

  constructor(
    private readonly accessKey = process.env.AWS_ACCESS_KEY_ID,
    private readonly secretKey = process.env.AWS_SECRET_ACCESS_KEY,
  ) {
    if (!this.accessKey || !this.secretKey) {
      throw new Error(
        'TextractEngine requires AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY. The demo runs mock engines by default.',
      );
    }
  }

  async extract(_doc: IncomingDoc): Promise<FieldCandidate[]> {
    throw new Error(
      'TextractEngine.extract: live AWS calls are intentionally not wired in this demo repo. See README — "What runs locally vs what is mocked".',
    );
  }
}
