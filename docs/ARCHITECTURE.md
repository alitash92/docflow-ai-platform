# Architecture — DocFlow AI

**Document Intelligence Platform for Healthcare Provider Networks**

This document describes the system as implemented in this repository. The
pipeline, confidence gate, dual-engine merge, judge/repair loop, routing, cost
metering, and checkpointing are real and executable. The demo runs **key-free in
mock mode** (committed fixtures replayed behind every external seam) and offers an
optional **real mode** that swaps a live **frontier vision LLM** in behind the
same interfaces. Provider names are intentionally avoided in prose — the design
is provider-neutral by construction.

---

## 1. Component diagram

```
                         INBOUND CHANNELS  (InboundChannel seam)
            ┌───────────────┬───────────────┬────────────────────────┐
            │ IMAP inbox    │ Twilio MMS    │ Portal upload / S3 drop │
            │ (mock replay) │ (mock replay) │ (mock replay)           │
            └───────┬───────┴───────┬───────┴───────────┬────────────┘
                    │               │                   │
                    └───────────────┼───────────────────┘
                                    ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │  STAGED PIPELINE  (apps/api/src/pipeline/graph.ts)                     │
   │  ordered, typed reducers over ONE PipelineState — checkpoint per stage │
   │                                                                        │
   │  Ingest ─► Validate ─► Classify ─► Judge ─► Repair* ─► Route/Escalate  │
   │    │          │           │          │         │            │          │
   │    │          │           └───┐      └───┐     └───┐        │          │
   │    ▼          ▼               ▼          ▼         ▼        ▼          │
   │ format-   OCRProvider      LLMClient  LLMClient  LLMClient  route()    │
   │ detector  (×2 engines)     .classify  .judge     .repair   (pure gate) │
   │           + merge.ts                                                    │
   └────────┬──────────────────────┬───────────────────────────┬───────────┘
            │ checkpoint+run        │ tokens per stage          │
            ▼                       ▼                           ▼
   ┌─────────────────┐   ┌────────────────────┐   ┌──────────────────────────┐
   │ DocumentStore   │   │ token-meter.ts     │   │ Route decision            │
   │ (InMemory def.; │   │ per-model price tbl │   │  ≥0.90 → care/billing q.  │
   │  Mongo seam)    │   │ → computed $/doc    │   │  <0.90 → Review Queue     │
   └────────┬────────┘   └────────────────────┘   └──────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │  Express API  (apps/api/src/server.ts)                                 │
   │  /api/health · /api/kpis · /api/documents[/:id[/checkpoints]]          │
   │  /api/review · POST /api/documents · POST /api/documents/upload (real) │
   │           ▲                                                            │
   │           │ KPIs computed at runtime from corpus-30d.json fixture      │
   │      kpi.service.ts                                                     │
   └───────────┬────────────────────────────────────────────────────────────┘
               │  static + JSON
               ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │  React + Vite dashboard  (apps/web)                                    │
   │  KpiCards · DocTable (classified inbox) · PipelinePanel (stage trace)  │
   │  ReviewDrawer (escalated doc: flagged fields + stage trace + JSON)     │
   └──────────────────────────────────────────────────────────────────────┘

   PROVIDER SEAMS (mock default · real import-guarded):
     OCRProvider : MockLayoutEngine / MockVisionEngine  ▸  Paddle · Vision · Textract
     LLMClient   : MockLLMClient (fixture replay)        ▸  OpenAIClient / AnthropicClient
   * Repair runs only when the Judge flags fields; otherwise it is recorded as skipped.
```

---

## 2. Pipeline stages

The pipeline is implemented as an **ordered list of typed reducers over a single
`PipelineState` object** — the LangGraph pattern without the framework weight
(`runPipeline` in `apps/api/src/pipeline/graph.ts`). A checkpoint snapshot is
persisted **after every stage**, so an interrupted run resumes from its last
completed stage rather than reprocessing the document.

| # | Stage | What it does | Key module |
|---|-------|--------------|------------|
| 1 | **Ingest** | Detect container format from leading magic bytes; record decoder, page count, source, and PII tokens redacted. | `ingest/format-detector.ts` |
| 2 | **Validate** | Two engines extract fields independently; `mergeFields` reconciles them field-by-field and records cross-engine disagreements. | `ocr/ocr-provider.interface.ts`, `ocr/merge.ts` |
| 3 | **Classify** | Assign a `DocType` + confidence (schema-enforced in real mode). | `LLMClient.classify` |
| 4 | **Judge** | Produce overall document confidence + a list of flagged fields, cross-examining the recorded disagreements. | `LLMClient.judge` |
| 5 | **Repair** *(conditional)* | Resolve each judge-flagged field to a corrected value; mark `repaired` and re-attribute to `judge+repair merge`. Skipped when nothing is flagged. | `LLMClient.repair` |
| 6 | **Route / Escalate** | The confidence gate: `judge.overall ≥ 0.90` auto-routes to the per-doc-type destination; below escalates to the human review queue with reason + flagged count. | `pipeline/router.ts` |

Each stage appends a `StageResult` (status, ms, detail, and — for model stages —
model, tokensIn, tokensOut, costUsd). Stage timings replay recorded fixture
values in mock mode for determinism; LLM costs are always *computed* from token
counts via the meter, never hardcoded.

### The gate is the product

`route()` is deliberately small, pure, and unit-tested:

```
judge.overall ≥ 0.90  →  auto-route to ASSIGNEES[classification.type]
judge.overall < 0.90  →  Review Queue (reason + flagged-field count attached)
```

`ASSIGNEES` maps each of the six healthcare document types to a destination:
Referral → Cardiology Intake, Prior Authorization → Utilization Mgmt, Insurance
Claim → Billing Queue, Discharge Summary → Care Coordination, Lab Report →
Results Triage, Patient Intake → Front Desk / Registration. Everything upstream
exists to produce the one honest number this function reads.

---

## 3. Provider seams: `LLMClient` and `OCRProvider`

Two interfaces isolate every external dependency, so mock ↔ real is a
constructor swap, not a refactor.

### `OCRProvider` (`ocr/ocr-provider.interface.ts`)

```
interface OCRProvider {
  readonly name: string;
  extract(doc: IncomingDoc): Promise<FieldCandidate[]>;
}
```

- **Mock (default):** `MockLayoutEngine` / `MockVisionEngine` replay committed
  layout fixtures (`fixtures/layouts/*.layout.json`) — deterministic, key-free.
- **Real (import-guarded):** `paddle.engine.ts`, `vision.engine.ts`,
  `textract.engine.ts` throw a precise "set `<KEY>`/creds" message if used
  without credentials.

### `LLMClient` (`llm/llm-client.interface.ts`)

```
interface LLMClient {
  classify(doc, fields): Promise<ClassifyResult>;
  judge(doc, fields, flagged): Promise<JudgeResult>;
  repair(doc, flagged): Promise<RepairResult>;
}
```

- **Mock (default):** `MockLLMClient` replays the recorded classification, judge
  confidence, and repair corrections committed alongside each seed document; for
  documents POSTed at runtime it falls back to a keyword heuristic so the API
  stays usable without a key. Token counts are *estimated from the actual prompt
  text* (~4 chars/token) so cost is still computed.
- **Real (import-guarded):** `openai.client.ts` (and an `anthropic.client.ts`
  variant) implement the same three methods against a live frontier model with
  strict JSON-schema output and 429 retry/backoff.

---

## 4. Mock vs real selection

```
realModeEnabled()  ==  process.env.MOCK_MODE === 'false'  &&  !!process.env.OPENAI_API_KEY
```

| | Mock mode (default) | Real mode |
|---|---|---|
| Trigger | anything other than the real-mode condition | `MOCK_MODE=false` **and** key set |
| OCR | `MockLayoutEngine` / `MockVisionEngine` (fixture replay) | single frontier **vision LLM** pre-extracts field candidates, replayed into the same dual-engine merge |
| LLM stages | `MockLLMClient` (fixture replay) | `OpenAIClient` (live, schema-enforced) |
| Store | in-memory | in-memory (per request) |
| Upload endpoint | returns `501` explaining mock mode | accepts image / text-layer PDF and runs it end-to-end |
| Determinism | fully deterministic | depends on live model |

Crucially, **the pipeline stages, types, confidence gate, cost meter, and
dashboard are identical across modes** — only the implementations behind the two
seams change (`mockDeps()` vs `realDeps()` in `graph.ts`). In real mode a single
vision LLM produces the field candidates, which are replayed into *both* sides of
the merge so the downstream Classify → Judge → Repair → Route path is unchanged.

---

## 5. Data flow

1. **Boot** (`server.ts`) drains the mock inbound channels and runs every fixture
   document through `runPipeline`, persisting runs + checkpoints to the
   `DocumentStore`.
2. **Per document**, `runPipeline` walks the six stages, checkpointing after each
   and accumulating cost.
3. **The dashboard** fetches `GET /api/kpis`, `GET /api/documents`, and
   `GET /api/review`; KPIs are computed on demand from the corpus fixture.
4. **Escalated documents** appear in the review queue; the `ReviewDrawer` opens on
   one (e.g. `?review=1`) and shows its flagged fields, repair history, and stage
   trace.
5. **Ad-hoc ingestion:** `POST /api/documents` runs an arbitrary payload through
   the live mock pipeline; `POST /api/documents/upload` (real mode only) runs a
   real uploaded file.

### KPI derivation (`metrics/kpi.service.ts`)

`fixtures/corpus/corpus-30d.json` holds 30 days of per-doc-type buckets (counts,
auto-routed counts, fields extracted/validated, summed cost) plus a prior-period
record. `computeKpis()` sums and divides at request time:

```
docsProcessed = Σ count               accuracyPct  = Σ fieldsValidated / Σ fieldsExtracted
autoRoutedPct = Σ autoRouted / Σ count  avgCostUsd = Σ costUsd / Σ count
deltas        = each vs priorPeriod
```

No number is hand-typed into the UI.

---

## 6. Tech stack

| Layer | Technology |
|---|---|
| Language / runtime | TypeScript (ESM), Node ≥ 20, `tsx` |
| API | Express 4, `multer` (real-mode upload), Zod (request + schema enforcement) |
| Web | React 18, Vite 5 |
| LLM (real mode) | Frontier vision LLM via chat-completions API (`openai` SDK shape); schema-enforced output, 429 retry/backoff |
| OCR (real seams) | PaddleOCR / vision LLM / AWS Textract (import-guarded) |
| Document parsing | `pdfjs-dist` (PDF text layer, real mode) |
| Persistence | in-memory `DocumentStore` (MongoDB documented swap via `MONGO_URL`) |
| Cost | per-model price table + computed `costUsd` |
| Tests | `node:test` — router, merge, end-to-end pipeline (14, offline) |

---

## 7. Key design decisions & trade-offs

**D-1 — Pipeline as typed reducers, not a graph framework.**
*Decision:* an ordered list of pure reducers over one `PipelineState`.
*Why:* gives the LangGraph staging benefits (checkpoint, resume, per-stage trace)
with zero framework dependency, fully typed and trivially testable.
*Trade-off:* no dynamic graph topology / conditional branching beyond the
hand-coded conditional Repair stage — acceptable for a fixed clinical pipeline.

**D-2 — The routing gate is small, pure, and the product.**
*Decision:* isolate the auto-route decision in one pure function with a single
threshold (0.90).
*Why:* the most safety-critical logic is the easiest to read, unit-test, and
defend; everything upstream serves it.
*Trade-off:* a single global threshold rather than per-doc-type thresholds — a
deliberate simplification, easily extended.

**D-3 — Dual-engine merge instead of single-engine extraction.**
*Decision:* require two engines to agree before a value is trusted; cap confidence
and flag on disagreement.
*Why:* a defensible confidence signal — the whole point of the product — needs
independent corroboration, not one model's self-reported confidence.
*Trade-off:* roughly doubles extraction cost/latency vs single-engine; justified
by the cost of a silent error in a clinical/billing context.

**D-4 — Judge + repair instead of averaging disagreements.**
*Decision:* hand cross-engine disagreements to a judge that flags them and a
repair step that resolves them, marking provenance.
*Why:* averaging hides conflict; flagging + repairing surfaces and corrects it,
and leaves an audit trail for reviewers.
*Trade-off:* extra LLM calls on the minority of documents with disagreements
(Repair is skipped otherwise).

**D-5 — Mock-first by design, not apology.**
*Decision:* every external dependency has a `Mock*` implementation behind a seam;
real engines are import-guarded.
*Why:* a deterministic, key-free, CI-friendly demo that still demonstrates the
real architecture; reviewers can run everything offline.
*Trade-off:* mock-mode accuracy/latency are replayed, not live — explicitly
framed as such; real mode exists to validate the seams end-to-end.

**D-6 — Cost as a first-class signal.**
*Decision:* meter tokens per stage per model and compute `$/doc` from a price
table.
*Why:* "the AI bill changed" must be answerable per document and per stage.
*Trade-off:* the price table is committed and must be kept current with provider
pricing.

**D-7 — Content-based format detection.**
*Decision:* detect format from magic bytes, never the file extension.
*Why:* field teams constantly rename files; the extension lies.
*Trade-off:* a maintained signature table; unknown content falls back to a
labeled binary decoder rather than failing.

**D-8 — Checkpoint after every stage.**
*Decision:* persist a full state snapshot per stage.
*Why:* a restart resumes in-flight work instead of reprocessing — and gives a
complete audit trail of every routing decision.
*Trade-off:* snapshot storage overhead, negligible at document scale and bounded
by the store implementation.

**D-9 — PHI safety as a constraint, not a feature.**
*Decision:* synthetic fixtures only; keys from env only; scrub key fragments from
upstream error messages.
*Why:* the system handles PHI from day one, so the demo must model safe handling
even with synthetic data.
*Trade-off:* none material; it constrains what can be committed and logged.
