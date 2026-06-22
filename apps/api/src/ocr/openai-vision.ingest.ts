import type { FieldCandidate } from '../types.js';
import { createOpenAIClient, withConnectionRetry } from '../llm/openai-transport.js';

/**
 * OpenAI-vision-backed ingest for a real uploaded file.
 *
 * Given an uploaded file buffer, produces the per-field candidates the pipeline
 * needs (the same FieldCandidate[] shape the mock OCR engines emit), using a
 * frontier vision LLM:
 *
 *   - images (png/jpg/webp/heic) → base64 → image_url content block → vision LLM
 *   - PDFs → extract the embedded text layer of the FIRST PAGE ONLY (pdfjs-dist).
 *     If a text layer is present, send that text; if the first page is scanned
 *     (no text layer), we cannot rasterise without a heavy native dep, so we
 *     surface a clear, honest error telling the caller to upload an image instead.
 *   - CSV → read the first ~20 rows as text and extract.
 *   - XLSX / spreadsheets → parse the first sheet's first ~20 rows and extract.
 *   - other text → treated as UTF-8 text.
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

async function callVision(
  apiKey: string,
  model: string,
  userContent: Array<Record<string, unknown>> | string,
): Promise<IngestOutput> {
  const openai = await createOpenAIClient(apiKey);
  const backoff = [1000, 2000, 4000];
  let strict = true;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= backoff.length; attempt++) {
    try {
      // Retry connection-class failures ("Premature close", socket resets) that
      // arise from stale keep-alive sockets on some cloud hosts.
      const resp = await withConnectionRetry(() =>
        openai.chat.completions.create({
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
        }),
      );
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
  const name = input.fileName || '';
  const isImage = VISION_MIME.has(mime) || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(name);
  const isPdf = mime === 'application/pdf' || /\.pdf$/i.test(name);
  const isCsv =
    mime === 'text/csv' ||
    mime === 'application/csv' ||
    /\.csv$/i.test(name) ||
    /\.tsv$/i.test(name);
  const isXlsx =
    mime.includes('spreadsheetml') ||
    mime === 'application/vnd.ms-excel' ||
    /\.(xlsx|xls|xlsm|ods)$/i.test(name);

  if (isImage) {
    const b64 = input.buffer.toString('base64');
    const dataUrl = `data:${mime || 'image/png'};base64,${b64}`;
    const out = await callVision(apiKey, model, [
      { type: 'text', text: `Extract structured fields from this document image (${name}).` },
      { type: 'image_url', image_url: { url: dataUrl } },
    ]);
    return out;
  }

  if (isPdf) {
    // First page only — keeps cost/latency bounded and matches the demo's
    // single-page intake assumption.
    const { text, pages } = await extractPdfFirstPageText(input.buffer);
    if (!text.trim()) {
      throw new Error(
        'This PDF appears to be scanned (no embedded text layer on the first page). PDF ' +
          'rasterisation is not bundled in this build to keep dependencies minimal — please ' +
          'upload an image (PNG/JPG) of the page to run vision extraction.',
      );
    }
    const out = await extractFromText(apiKey, model, name, text);
    return { ...out, text: out.text || text, pages: pages || out.pages };
  }

  if (isCsv) {
    const text = firstRowsAsText(input.buffer.toString('utf8'), 20);
    if (!text.trim()) {
      throw new Error('This CSV appears to be empty — no rows could be read.');
    }
    return extractFromText(apiKey, model, name, text);
  }

  if (isXlsx) {
    const text = await extractSpreadsheetText(input.buffer, 20);
    if (!text.trim()) {
      throw new Error(
        'This spreadsheet appears to be empty or could not be parsed — no rows could be read.',
      );
    }
    return extractFromText(apiKey, model, name, text);
  }

  // Fallback: treat as UTF-8 text.
  const text = input.buffer.toString('utf8');
  if (!text.trim()) {
    throw new Error(
      `Could not read any text from "${name}". Supported uploads: PDF (text layer), images ` +
        '(PNG/JPG/WEBP/HEIC), CSV, and XLSX spreadsheets.',
    );
  }
  return extractFromText(apiKey, model, name, text);
}

/** Send recovered document text to the extraction model (shared by text formats). */
async function extractFromText(
  apiKey: string,
  model: string,
  fileName: string,
  text: string,
): Promise<IngestOutput> {
  const out = await callVision(
    apiKey,
    model,
    `Extract structured fields from this document text (${fileName}):\n\n${text.slice(0, 12000)}`,
  );
  return { ...out, text: out.text || text };
}

/** Keep only the first `maxRows` non-empty lines of a delimited text blob. */
function firstRowsAsText(raw: string, maxRows: number): string {
  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(0, maxRows)
    .join('\n')
    .trim();
}

async function extractPdfFirstPageText(
  buffer: Buffer,
): Promise<{ text: string; pages: number }> {
  // pdfjs-dist is loaded lazily so it is only needed in real mode. The legacy
  // build runs cleanly under Node (no DOM / worker required). We read ONLY the
  // first page's text layer — the intake pipeline keys off the cover page.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const totalPages = doc.numPages;
  let text = '';
  if (totalPages >= 1) {
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    text = content.items
      .map((i) => ('str' in i ? (i as { str: string }).str : ''))
      .join(' ');
  }
  return { text: text.trim(), pages: totalPages };
}

/** Parse the first sheet's first `maxRows` rows of an XLSX/XLS/ODS workbook. */
async function extractSpreadsheetText(buffer: Buffer, maxRows: number): Promise<string> {
  const xlsx = (await import('xlsx')) as typeof import('xlsx');
  const wb = xlsx.read(buffer, { type: 'buffer' });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return '';
  const sheet = wb.Sheets[firstSheetName];
  const rows = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
  return rows
    .slice(0, maxRows)
    .map((row) => (Array.isArray(row) ? row.map((c) => (c == null ? '' : String(c))).join('\t') : ''))
    .filter((line) => line.trim().length > 0)
    .join('\n')
    .trim();
}

function clamp01(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0.7;
  return Math.max(0, Math.min(1, v));
}
