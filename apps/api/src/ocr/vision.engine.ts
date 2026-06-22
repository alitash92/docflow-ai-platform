import type { FieldCandidate, IncomingDoc } from '../types.js';
import type { OCRProvider } from './ocr-provider.interface.js';

/**
 * VisionEngine — real multimodal semantic validation via the Claude API.
 *
 * Import-guarded: constructing it without credentials throws a clear setup
 * message instead of failing somewhere deep in the pipeline. The demo never
 * constructs this class — MockVisionEngine is the default.
 */
export class VisionEngine implements OCRProvider {
  readonly name = 'vision-engine';

  constructor(private readonly apiKey = process.env.ANTHROPIC_API_KEY) {
    if (!this.apiKey) {
      throw new Error(
        'VisionEngine requires ANTHROPIC_API_KEY. The demo runs MockVisionEngine by default — set MOCK_MODE=false and provide the key to enable real semantic validation.',
      );
    }
  }

  async extract(_doc: IncomingDoc): Promise<FieldCandidate[]> {
    throw new Error(
      'VisionEngine.extract: live multimodal calls are intentionally not wired in this demo repo. See README — "What runs locally vs what is mocked".',
    );
  }
}
