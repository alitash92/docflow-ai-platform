# DocFlow AI — Real Mode

By default DocFlow runs a **key-free mock demo**: every external dependency sits
behind a typed interface with a `Mock*` implementation, so `npm run demo`,
`npm test`, and the dashboard all run fully offline with no API keys.

**Real mode** swaps the mock LLM and OCR engines for a live **frontier vision
LLM** (via the chat-completions API) and enables a real document-upload path.
The pipeline stages, types, confidence gate (`≥ 0.90` auto-routes), and the
dashboard UI are identical to mock mode — only the engines behind the seams change.

## Enabling real mode

Real mode activates only when **both** are true:

- `MOCK_MODE=false`
- `OPENAI_API_KEY` is set to a valid key

If either is missing, the app stays in mock mode and the upload endpoint returns
a clear `501` explaining this. The key is read from the environment only and is
never logged or committed (`.env` is gitignored).

### Configuration (`.env`)

```bash
MOCK_MODE=false
OPENAI_API_KEY=sk-...            # required for real mode
OPENAI_MODEL=gpt-4o              # vision + repair model (vision-capable). Default: gpt-4o
OPENAI_MODEL_CHEAP=gpt-4o-mini   # classify/judge stages. Default: gpt-4o-mini
PORT=4810
```

### Run it

```bash
MOCK_MODE=false OPENAI_API_KEY=sk-... npm run serve
```

`npm run serve` builds the dashboard (`vite build`) and starts the API. The
console will report `REAL mode (live vision LLM)` and print the upload endpoint.

## Upload endpoint

```
POST /api/documents/upload      (multipart/form-data, field name: "file")
```

- **Images** (`png`, `jpg`, `jpeg`, `webp`, `heic`, `heif`) → base64-encoded and
  sent to the vision model as an `image_url` content block.
- **PDFs** → the embedded text layer is extracted (`pdfjs-dist`) and sent to the
  model. If a PDF is scanned (no text layer), the endpoint returns a clear error
  asking you to upload an image of the page instead (page rasterisation is not
  bundled, to keep dependencies minimal).

The response is the same `PipelineState` shape the dashboard already renders, so
the extracted document appears in the UI immediately (the review drawer opens to
show the validated fields, confidence, and routing decision).

### Pipeline cascade (real mode)

```
Ingest (vision LLM) → Validate/merge → Classify → Judge → Repair → Route/Escalate
```

- Schema-enforced output: each stage requests `response_format` with a strict
  JSON schema (`temperature: 0`), falling back to `json_object` mode if a model
  rejects strict schemas.
- Per-call cost is computed from real token usage against a model price table
  (`apps/api/src/cost/token-meter.ts`).
- Requests retry up to 3× with exponential backoff `[1s, 2s, 4s]` on HTTP 429.

### Try it with the bundled sample

A **synthetic** prior-authorization PDF (fictional patient, no real PHI) is
included for testing:

```
fixtures/samples/Prior_Auth_SAMPLE.pdf
```

```bash
curl -X POST -F "file=@fixtures/samples/Prior_Auth_SAMPLE.pdf" \
  http://localhost:4810/api/documents/upload
```

Or use the **"+ Upload documents"** button in the dashboard top bar (enabled
only in real mode; in mock mode it is disabled with an explanatory tooltip).

## What you must do to run a live test

1. Provide your own `OPENAI_API_KEY` (this repo ships no key, and no live call is
   made during build/test).
2. Run with `MOCK_MODE=false`.
3. Upload an image or text-layer PDF (the bundled sample works out of the box).

## Verifying the mock path is unaffected

```bash
npm test          # 14/14 green — mock pipeline untouched
npm run build     # clean
npm start         # boots in mock mode, key-free; upload endpoint returns 501
```
