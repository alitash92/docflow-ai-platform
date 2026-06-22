import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { FieldCandidate, IncomingDoc, LayoutFixture } from '../types.js';
import type { OCRProvider } from './ocr-provider.interface.js';

const FIXTURE_DIR = new URL('../../../../fixtures/layouts', import.meta.url).pathname;

function loadLayouts(dir = FIXTURE_DIR): Map<string, LayoutFixture> {
  const map = new Map<string, LayoutFixture>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.layout.json'))) {
    const fixture = JSON.parse(readFileSync(join(dir, file), 'utf8')) as LayoutFixture;
    map.set(fixture.docId, fixture);
  }
  return map;
}

let cache: Map<string, LayoutFixture> | null = null;
function layouts(): Map<string, LayoutFixture> {
  cache ??= loadLayouts();
  return cache;
}

/** Generic fallback for documents POSTed at runtime (no fixture on disk). */
function syntheticFields(doc: IncomingDoc, engine: string): FieldCandidate[] {
  return [
    { name: 'title', value: doc.fileName.replace(/\.[a-z]+$/i, ''), confidence: 0.92, engine },
    { name: 'source_channel', value: doc.source, confidence: 0.99, engine },
    { name: 'page_count', value: String(doc.pages), confidence: 0.97, engine },
  ];
}

/**
 * MockLayoutEngine — stands in for the GPU layout-analysis engine.
 * Returns the committed layout fixture for known seed documents.
 */
export class MockLayoutEngine implements OCRProvider {
  readonly name = 'layout-engine (mock)';
  async extract(doc: IncomingDoc): Promise<FieldCandidate[]> {
    return layouts().get(doc.id)?.layoutEngine ?? syntheticFields(doc, this.name);
  }
}

/**
 * MockVisionEngine — stands in for the multimodal semantic-validation engine.
 * Intentionally disagrees with the layout engine on a few fixture fields so the
 * Judge → Repair path is exercised on every demo run.
 */
export class MockVisionEngine implements OCRProvider {
  readonly name = 'vision-engine (mock)';
  async extract(doc: IncomingDoc): Promise<FieldCandidate[]> {
    return layouts().get(doc.id)?.visionEngine ?? syntheticFields(doc, this.name);
  }
}
