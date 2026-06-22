# Product Requirements Document — DocFlow AI

**Document Intelligence Platform for Healthcare Provider Networks**

| | |
|---|---|
| **Status** | Demo build (anonymized rebuild of a production engagement) |
| **Author** | Lead AI Engineer |
| **Domain** | Healthcare document intelligence |
| **Data** | Synthetic fixtures only — fictional patients, no real PHI |

> Scope note for readers: this PRD is written to match what the committed code
> actually does. The pipeline, the confidence gate, the dual-engine field merge,
> the LLM judge/repair loop, and the routing logic are real, executable, and
> unit-tested. The demo runs **key-free in mock mode** by replaying committed
> fixtures, and offers an optional **real mode** that swaps in a live frontier
> vision LLM behind the same seams. Headline metrics on the dashboard are
> *computed at runtime from a committed corpus fixture*, not hand-typed; they are
> presented as engagement results modeled on a representative deployment, not as
> a reproducible benchmark. No eval harness ships with this repo.

---

## 1. Goals & Background

### Goal

Turn a healthcare provider network's inbound document firehose — referrals, lab
reports, prior-authorization requests, discharge summaries, insurance claims, and
patient-intake scans arriving by fax, email, SMS photo, and portal upload — into
structured, classified, and correctly-routed records, while **only escalating to
a human the documents the system is not confident about.**

### Background

Multi-site provider networks receive thousands of clinical and administrative
documents a month across heterogeneous channels and file formats. Today staff
read, classify, and re-key each one into EHR and billing systems by hand. This is
slow, expensive, and error-prone, and it forces PHI through manual handling from
the moment a document arrives.

Naive automation makes the problem worse, not better: an LLM that is *confidently
wrong* about a prior-authorization amount or a discharge follow-up date is more
dangerous than no automation, because it removes the human check without removing
the error. The product thesis is therefore not "extract everything automatically"
but **"auto-route only what crosses a defensible confidence bar; route everything
else to a human with the evidence attached."**

### Product thesis

The routing gate is the product. Every upstream stage — ingest, dual-engine
extraction, classification, judging, repair — exists to produce **one honest
number** (the judge's overall confidence) that a small, pure, unit-tested
function acts on. That number, and the decision it drives, is the deliverable.

---

## 2. Problem Statement

- **Heterogeneous intake.** Documents arrive as PDFs, OOXML (DOCX/XLSX), RTF,
  HEIC phone photos of scanned/faxed forms, and legacy Outlook TNEF
  (`winmail.dat`) containers — frequently with misleading or absent file
  extensions. Format must be identified from content, not file name.
- **Manual classification & re-keying.** Staff manually decide what each document
  is and copy its fields into downstream systems.
- **No trustworthy confidence signal.** Single-engine OCR/LLM extraction produces
  a value with no defensible basis for deciding whether a human needs to look at
  it.
- **Silent errors are the real risk.** A confidently-wrong extraction that
  auto-routes is the worst outcome in a clinical/billing context.
- **PHI handling from day one.** Personally identifiable content must be redacted
  and accounted for as documents flow through the pipeline.
- **Unanswerable cost.** When "the AI bill doubled," there is no per-document,
  per-stage breakdown to explain why.
- **No recovery.** A crash mid-document means reprocessing from scratch.

---

## 3. Target Users

| User | Need | How the product serves it |
|---|---|---|
| **Intake / triage staff** | Stop manually classifying and re-keying every document | Auto-routed documents never reach them; they handle only the escalated minority |
| **Human reviewers** | Fix the uncertain documents quickly and correctly | Review queue presents the escalated document with flagged fields, cross-engine disagreements, and the repair history attached — so they correct two fields, not re-key a packet |
| **Care teams / billing queues** | Receive correctly-classified, structured records in their queue | `route()` assigns each auto-routed document to the right destination (Cardiology Intake, Utilization Mgmt, Billing Queue, Care Coordination, Results Triage, Front Desk / Registration) |
| **Operations / engineering leads** | Monitor throughput, accuracy, auto-route rate, and cost | Operations dashboard with KPIs computed at runtime, per-document pipeline traces, and per-stage token cost |

---

## 4. Functional Requirements

**FR-1 — Multi-channel ingestion.** Accept documents from email (IMAP), SMS/MMS
(Twilio webhook), and portal/S3 upload channels. Each channel sits behind a
common `InboundChannel` seam; mock connectors replay committed fixture traffic.

**FR-2 — Content-based format detection.** Identify the container format
(PDF, DOCX/XLSX OOXML, RTF, HEIC, TNEF, RFC-822 EML) from leading magic bytes,
never from the file extension. *(`ingest/format-detector.ts`)*

**FR-3 — PII redaction accounting.** Count and record PII tokens redacted per
document during ingest.

**FR-4 — Dual-engine field extraction.** Two independent OCR engines (a layout
engine and a vision engine) extract fields for the same document.
*(`OCRProvider` seam)*

**FR-5 — Field-level merge with disagreement detection.** Reconcile the two
engines field-by-field: agreement keeps the higher-confidence candidate;
value disagreement or a confidence gap beyond tolerance (0.15) records a
disagreement for the judge/repair stages. *(`ocr/merge.ts`)*

**FR-6 — Schema-enforced classification.** Classify each document into one of six
document types with a confidence score. In real mode the model output is
constrained by a strict JSON schema (Zod-shaped). *(Classify stage)*

**FR-7 — LLM judge.** Produce an overall document-confidence score and a list of
flagged fields, cross-examining the recorded cross-engine disagreements rather
than averaging them away. *(Judge stage)*

**FR-8 — Conditional repair loop.** When the judge flags fields, run a repair step
that resolves each flagged field to a corrected value; mark those fields as
`repaired` and re-attribute their provenance to a `judge+repair merge`. Skip the
stage entirely when nothing is flagged. *(Repair stage)*

**FR-9 — Confidence-gated routing.** A pure routing function auto-routes a
document to its per-doc-type destination when `judge.overall ≥ 0.90`, and
escalates to the human review queue otherwise, attaching the reason and flagged
field count. *(`pipeline/router.ts`)*

**FR-10 — Checkpoint & resume.** Persist a checkpoint snapshot after every stage,
so an interrupted run resumes from its last completed stage instead of
reprocessing. *(`pipeline/graph.ts` + `DocumentStore`)*

**FR-11 — Per-stage, per-model token cost metering.** Record input/output tokens
for every LLM stage and price them against a per-model price table; the
per-document cost is computed, never hardcoded. *(`cost/token-meter.ts`)*

**FR-12 — Runtime KPI computation.** Compute throughput, extraction accuracy,
auto-route rate, average cost per document, and period-over-period deltas by
summing and dividing a committed 30-day corpus fixture at request time.
*(`metrics/kpi.service.ts`)*

**FR-13 — Operations dashboard.** Render KPIs, the classified inbox, a live
pipeline view, and the validated field JSON for each document, with a review
drawer that opens on an escalated document showing flagged fields and the stage
trace. *(React/Vite web app)*

**FR-14 — HTTP API.** Expose:
`GET /api/health`, `GET /api/kpis`, `GET /api/documents`,
`GET /api/documents/:id`, `GET /api/documents/:id/checkpoints`,
`GET /api/review`, and `POST /api/documents` (run a payload through the live
pipeline with mock engines).

**FR-15 — Optional real-mode upload.** When `MOCK_MODE=false` and an API key is
configured, `POST /api/documents/upload` accepts a real image or text-layer PDF,
extracts fields with a live frontier vision LLM, and runs them through the
identical downstream pipeline. When real mode is off, the endpoint returns a
clear `501` explaining mock mode.

---

## 5. Non-Functional Requirements

**NFR-1 — Key-free by default.** The full demo (pipeline, dashboard, tests) runs
offline with no API keys, no GPU, and no database. Every external dependency
sits behind a typed interface with a `Mock*` implementation.

**NFR-2 — Determinism.** Mock-mode runs are fully deterministic: mock engines and
the mock LLM replay committed fixtures, and per-stage timings replay recorded
values, so the demo and the test suite produce identical output every run.

**NFR-3 — Provider neutrality at the seam.** The pipeline talks only to the
`OCRProvider` and `LLMClient` interfaces. Swapping a real engine in is a
constructor argument, not a refactor. Real implementations are import-guarded
and fail with a precise "set `<KEY>`" message when invoked without credentials.

**NFR-4 — PHI safety.** No real PHI in the repo; all fixtures are synthetic and
fictional. Credentials are read from the environment only, never logged or
committed (`.env` is gitignored). Provider error messages are scrubbed of any
key fragment before being returned.

**NFR-5 — Schema enforcement & robustness (real mode).** Each model stage requests
a strict JSON schema with `temperature: 0`, falling back to `json_object` mode if
a model rejects strict schemas; requests retry up to 3× with exponential backoff
on HTTP 429.

**NFR-6 — Auditability.** Every run carries its full stage trace (status, timing,
model, tokens, cost, detail) and a checkpoint per stage, so any routing decision
can be reconstructed.

**NFR-7 — Testability.** The routing gate, the merge algorithm, and the end-to-end
pipeline are covered by an offline, network-free test suite (14 tests).

**NFR-8 — Portability of persistence.** The default store is in-memory; the
`DocumentStore` seam documents a MongoDB swap via `MONGO_URL`.

**NFR-9 — Node baseline.** Node ≥ 20, TypeScript, ES modules.

---

## 6. Epics & User Stories

### Epic 1 — Multi-channel, multi-format ingestion

- **US-1.1** — As intake staff, I want documents pulled from email, SMS, and
  upload channels automatically, so I don't manually collect them.
  *AC:* each of the three channels yields its fixture documents into the pipeline
  on boot.
- **US-1.2** — As an engineer, I want the format identified from file content, so
  renamed or extension-less files are handled correctly.
  *AC:* PDF, OOXML (DOCX/XLSX), RTF, HEIC, TNEF, and EML are detected from magic
  bytes; unknown content falls back to a binary decoder label.
- **US-1.3** — As a compliance owner, I want PII redaction counted per document,
  so redaction is auditable.
  *AC:* the ingest stage records `piiRedactedTokens` on the run.

### Epic 2 — Trustworthy extraction (dual engine + merge)

- **US-2.1** — As a reviewer, I want two engines to extract independently and be
  reconciled, so a single engine's error doesn't go unchecked.
  *AC:* `mergeFields` keeps the higher-confidence candidate and records a
  disagreement on value conflict or a confidence gap > 0.15.
- **US-2.2** — As an engineer, I want the extraction backend swappable behind one
  seam, so I can move from mock to real engines without rewriting the pipeline.
  *AC:* the pipeline depends only on `OCRProvider`.

### Epic 3 — Classification, judging & repair

- **US-3.1** — As operations, I want each document classified into a known type
  with a confidence, so it can be routed to the right destination.
  *AC:* classification returns one of the six `DocType`s with a confidence.
- **US-3.2** — As a reviewer, I want a judge to score the document and flag
  specific fields, so I know exactly what to check.
  *AC:* the judge returns `overall` plus a `flagged` field list.
- **US-3.3** — As a reviewer, I want disagreements repaired and marked, so I can
  see what the system corrected and why.
  *AC:* flagged fields are resolved, marked `repaired`, and re-attributed; the
  stage is skipped when nothing is flagged.

### Epic 4 — Confidence-gated routing & human review

- **US-4.1** — As operations, I want documents at or above the confidence bar
  auto-routed to the correct queue, so staff don't touch them.
  *AC:* `judge.overall ≥ 0.90` auto-routes to the per-doc-type assignee.
- **US-4.2** — As a reviewer, I want low-confidence documents escalated with their
  evidence, so I can resolve them quickly.
  *AC:* below threshold routes to the review queue with reason and flagged-field
  count; the dashboard review drawer surfaces them (e.g. `Prior_Auth_017` at
  0.81).

### Epic 5 — Resilience & cost observability

- **US-5.1** — As an operator, I want an interrupted run to resume, so a restart
  doesn't reprocess work.
  *AC:* a checkpoint is persisted after every stage.
- **US-5.2** — As a finance/ops owner, I want per-document, per-stage cost, so the
  AI bill is explainable.
  *AC:* every LLM stage records tokens and a computed USD cost.

### Epic 6 — Operations dashboard & KPIs

- **US-6.1** — As a lead, I want live KPIs (volume, accuracy, auto-route rate,
  cost) with period deltas, so I can monitor the system.
  *AC:* KPIs are computed from the corpus fixture at request time.
- **US-6.2** — As a lead, I want to inspect any document's full pipeline trace and
  validated fields, so decisions are auditable.
  *AC:* the dashboard renders the stage trace and field JSON per document.

### Epic 7 — Real-mode extension (optional)

- **US-7.1** — As an evaluator, I want to upload a real image/PDF and see it run
  end-to-end with a live model, so I can validate the architecture beyond
  fixtures.
  *AC:* with a key + `MOCK_MODE=false`, `/api/documents/upload` returns the same
  `PipelineState` shape; without it, a clear `501`.

---

## 7. Success Metrics

> These are the dashboard KPIs, **computed at runtime** from
> `fixtures/corpus/corpus-30d.json` by `computeKpis()`. They represent results
> modeled on a representative engagement, not a benchmark reproducible from this
> repo's six demo documents.

| Metric | Value | How it's derived |
|---|---|---|
| Documents processed (30d) | **4,287** | Σ `bucket.count` |
| Extraction accuracy | **97.4%** | Σ `fieldsValidated` ÷ Σ `fieldsExtracted` |
| Auto-routed (zero human touch) | **86%** | Σ `autoRouted` ÷ Σ `count` |
| Cost per document | **$0.041** | Σ `costUsd` ÷ Σ `count` |
| Cost change vs prior period | **−34%** | vs committed `priorPeriod.avgCostUsd` |

Process-level success criteria the code enforces directly:

- The confidence gate is the **only** thing that decides auto-route vs escalate,
  and it is pure and unit-tested.
- Sub-threshold documents are **never** silently auto-routed; the `Prior_Auth_017`
  fixture (0.81) demonstrates the escalation path with two repaired,
  judge-flagged fields.
- Per-document cost is **computed from token counts**, never hardcoded.

---

## 8. Out of Scope

- **A standalone eval harness or accuracy benchmark.** Accuracy/auto-route
  numbers come from the committed corpus fixture; there is no held-out test set
  or scoring pipeline in this repo.
- **Real OCR/LLM execution in the default demo.** Real engines exist behind seams
  but are import-guarded; mock mode is the default and the tested path.
- **GPU OCR latency and live engine-merge deltas.** Framed as production
  engagement results, not reproduced here.
- **Live email/SMS/S3 connectors and a persistent database.** Mock channels and an
  in-memory store ship; IMAP/Twilio/S3 and MongoDB are documented seams.
- **PDF rasterization in real mode.** Scanned (text-layer-free) PDFs are rejected
  with guidance to upload a page image; only embedded-text PDFs and images are
  processed.
- **Authentication, RBAC, multi-tenant isolation, and EHR/billing write-back
  integrations.** Out of scope for the demo.
- **Reviewer workflow actions** (approve/override that mutate downstream systems).
  The review drawer is presentational in the demo.
