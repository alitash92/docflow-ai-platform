import type { FieldCandidate } from '../types.js';

/**
 * OpenAI-vision-backed ingest for a real uploaded file.
 *
 * Given an uploaded file buffer, produces the per-field candidates the pipeline
 * needs (the same FieldCandidate[] shape the mock OCR engines emit), using a
 * frontier vision LLM:
 *
 *   - images (png/jpg/webp/heic) → base64 → image_url content block → vision LLM
 *   - PDFs → extract the embedded text layer (pdfjs-dist). If a text layer is
 *     present, send the text; if the PDF is scanned (no text layer), we cannot
 *     rasterise without a heavy native dep, so we surface a clear, honest error
 *     telling the caller to upload an image of the page instead.
 *
 * Import-guarded: requires OPENAI_API_KEY. Provider-neutral wording is used in
 * all user-facing strings ("vision model" / "frontier vision LLM").
 */

const VISION_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

export interface IngestInput {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

export interface IngestOutput {
  /** Extracted field candidates (mock-engine-compatible shape). */
  fields: FieldCandidate[];
  /** Plain text recovered from the document — feeds classify/judge/repair. */
  text: string;
  /** Page count if known (PDF text layer), else 1. */
  pages: number;
  model: string;
  tokensIn: number;
  tokensOut: number;
}

const ENGINE = 'vision-llm';

function defaultModel(): string {
  return process.env.OPENAI_MODEL?.trim() || 'gpt-4o';
}

/** Field-extraction JSON schema returned by the vision LLM. */
const EXTRACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['documentText', 'fields'],
  properties: {
    documentText: { type: 'string' },
    fields: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'value', 'confidence', 'evidence'],
        properties: {
          name: { type: 'string' },
          value: { type: 'string' },
          confidence: { type: 'number' },
          evidence: { type: 'string' },
        },
      },
    },
  },
};

const EXTRACT_SYSTEM =
  'You are a document-extraction engine for a healthcare provider-network intake pipeline. ' +
  'Read the supplied document (image or text) and extract its key structured fields as ' +
  'snake_case names with string values and a calibrated per-field confidence in [0,1]. ' +
  'Typical fields include patient_name, member_id, dob, ordering_provider, npi, dates, ' +
  'amounts, diagnosis/procedure codes, and document-specific identifiers. Also return the ' +
  'full readable text of the document in documentText. Ground every value strictly in the ' +
  'document; never invent data. The patient data in test documents is synthetic. ' +
  'Respond with a single JSON object matching the required schema.';

async function client(apiKey: string): Promise<import('openai').default> {
  const m = await import('openai');
  return new m.default({ apiKey });
}

async function callVision(
  apiKey: string,
  model: string,
  userContent: Array<Record<string, unknown>> | string,
): Promise<IngestOutput> {
  const openai = await client(apiKey);
  const backoff = [1000, 2000, 4000];
  let strict = true;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= backoff.length; attempt++) {
    try {
      const resp = await openai.chat.completions.create({
        model,
        temperature: 0,
        response_format: strict
          ? {
              type: 'json_schema',
              json_schema: { name: 'document_extraction', schema: EXTRACT_SCHEMA, strict: true },
            }
          : { type: 'json_object' },
        messages: [
          { role: 'system', content: EXTRACT_SYSTEM },
          // image_url blocks require the array content form; text can be a string.
          { role: 'user', content: userContent as never },
        ],
      });
      const raw = resp.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as {
        documentText?: string;
        fields?: Array<{ name: string; value: string; confidence: number }>;
      };
      const fields: FieldCandidate[] = (parsed.fields ?? []).map((f) => ({
        name: f.name,
        value: String(f.value ?? ''),
        confidence: clamp01(f.confidence),
        engine: ENGINE,
      }));
      return {
        fields,
        text: parsed.documentText ?? '',
        pages: 1,
        model: resp.model || model,
        tokensIn: resp.usage?.prompt_tokens ?? 0,
        tokensOut: resp.usage?.completion_tokens ?? 0,
      };
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      if (status === 400 && strict) {
        strict = false;
        continue;
      }
      if (status === 429 && attempt < backoff.length) {
        await new Promise((r) => setTimeout(r, backoff[attempt]));
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('vision LLM request failed');
}

export async function ingestWithVision(
  input: IngestInput,
  apiKey = process.env.OPENAI_API_KEY,
): Promise<IngestOutput> {
  if (!apiKey) {
    throw new Error(
      'Real ingest requires OPENAI_API_KEY. The demo runs the mock engines by default.',
    );
  }
  const model = defaultModel();
  const mime = (input.mimeType || '').toLowerCase();
  const isImage = VISION_MIME.has(mime) || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(input.fileName);
  const isPdf = mime === 'application/pdf' || /\.pdf$/i.test(input.fileName);

  if (isImage) {
    const b64 = input.buffer.toString('base64');
    const dataUrl = `data:${mime || 'image/png'};base64,${b64}`;
    const out = await callVision(apiKey, model, [
      { type: 'text', text: `Extract structured fields from this document image (${input.fileName}).` },
      { type: 'image_url', image_url: { url: dataUrl } },
    ]);
    return out;
  }

  if (isPdf) {
    const { text, pages } = await extractPdfText(input.buffer);
    if (!text.trim()) {
      throw new Error(
        'This PDF appears to be scanned (no embedded text layer). PDF rasterisation is not ' +
          'bundled in this build to keep dependencies minimal — please upload an image (PNG/JPG) ' +
          'of the page to run vision extraction.',
      );
    }
    const out = await callVision(
      apiKey,
      model,
      `Extract structured fields from this document text (${input.fileName}):\n\n${text.slice(0, 12000)}`,
    );
    return { ...out, text: out.text || text, pages: pages || out.pages };
  }

  // Fallback: treat as UTF-8 text.
  const text = input.buffer.toString('utf8');
  const out = await callVision(
    apiKey,
    model,
    `Extract structured fields from this document text (${input.fileName}):\n\n${text.slice(0, 12000)}`,
  );
  return { ...out, text: out.text || text };
}

async function extractPdfText(buffer: Buffer): Promise<{ text: string; pages: number }> {
  // pdfjs-dist is loaded lazily so it is only needed in real mode. The legacy
  // build runs cleanly under Node (no DOM / worker required).
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  let text = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    text +=
      content.items
        .map((i) => ('str' in i ? (i as { str: string }).str : ''))
        .join(' ') + '\n';
  }
  return { text: text.trim(), pages: doc.numPages };
}

function clamp01(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0.7;
  return Math.max(0, Math.min(1, v));
}
