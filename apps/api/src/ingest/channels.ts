import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Classification, DocSource, IncomingDoc, StageName } from '../types.js';

/** A seed document fixture = the incoming doc + recorded model behaviour. */
export interface SeedDocFixture extends IncomingDoc {
  classification: Classification;
  /** Recorded per-stage wall-clock from the reference run (drives deterministic replay). */
  stageMs: Partial<Record<StageName, number>>;
  /** Judge-flagged fields → corrected values (recorded Repair-stage output). */
  repairs?: Record<string, string>;
  piiRedactedTokens?: number;
}

const FIXTURE_DIR = new URL('../../../../fixtures/documents', import.meta.url).pathname;

let cache: SeedDocFixture[] | null = null;

export function loadSeedFixtures(dir = FIXTURE_DIR): SeedDocFixture[] {
  if (cache) return cache;
  cache = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as SeedDocFixture)
    .sort((a, b) => a.receivedAgoMin - b.receivedAgoMin);
  return cache;
}

/**
 * InboundChannel — the seam in front of every ingestion source.
 *
 * Mock connectors (DEFAULT) replay the committed fixture traffic.
 * Real connectors (IMAP inbox, Twilio MMS webhook, S3 drop folder) implement
 * the same interface — see .env.example for where credentials plug in.
 */
export interface InboundChannel {
  readonly source: DocSource;
  readonly label: string;
  fetch(): Promise<IncomingDoc[]>;
}

class FixtureChannel implements InboundChannel {
  constructor(
    readonly source: DocSource,
    readonly label: string,
  ) {}
  async fetch(): Promise<IncomingDoc[]> {
    return loadSeedFixtures().filter((d) => d.source === this.source);
  }
}

export function mockChannels(): InboundChannel[] {
  return [
    new FixtureChannel('email', 'IMAP inbox (mock — fixture replay)'),
    new FixtureChannel('sms', 'Twilio MMS webhook (mock — fixture replay)'),
    new FixtureChannel('upload', 'Portal upload / S3 drop (mock — fixture replay)'),
  ];
}
