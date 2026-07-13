import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import MarketingNav from '../components/MarketingNav';
import MarketingFooter from '../components/MarketingFooter';
import PaperDoc from '../paper/PaperDoc';
import PaperTryIt from '../paper/PaperTryIt';
import { useScenes } from '../paper/useScenes';
import {
  CoffeeRing,
  FaxHeader,
  HandCheck,
  MarginNote,
  OcrBox,
  Paperclip,
  PenCircle,
  Seal,
  Stamp,
  StickyNote,
} from '../paper/parts';

/* ══════════════════════════════════════════════════════════════════════════
   "The document IS the interface."
   The landing page is a synthetic Prior Authorization fax being processed by
   the pipeline as the visitor scrolls. Marketing copy lives in the margins as
   pen annotations; machine work (OCR, confidence, routing) is mint. Every
   scene's default CSS state is fully revealed — useScenes only adds motion.
   ══════════════════════════════════════════════════════════════════════════ */

const ROUTE_SLIP = [
  {
    title: 'CLINICS & PRACTICES',
    body: 'Front- and back-office staff who triage inbound referrals, intake forms, and faxed orders all day instead of seeing patients.',
  },
  {
    title: 'PROVIDER NETWORKS',
    body: 'Multi-site operations teams routing thousands of documents a day to the right department, location, and downstream system.',
  },
  {
    title: 'MEDICAL BILLING & RCM',
    body: 'Revenue-cycle teams re-keying claims, EOBs, and prior-auths into the practice-management system — where one wrong digit means a denial.',
  },
];

const LEDGER = [
  { n: '01', title: 'RECEIVED', body: 'Drop a file in, or auto-forward your fax/scan inbox. PDFs, images, faxes, multi-page bundles.' },
  { n: '02', title: 'OCR READ', body: 'OCR plus a frontier vision LLM read every page — even handwriting, stamps, and bad scans.' },
  { n: '03', title: 'FIELDS EXTRACTED', body: 'Patient, member ID, CPT, NPI, dates — each field carries its own confidence score.' },
  { n: '04', title: 'GATED ≥ 0.90', body: 'A unit-tested gate auto-routes the confident extractions and holds anything uncertain.' },
  { n: '05', title: 'ROUTED', body: 'Clean documents flow straight to your system; only the uncertain ones reach a human review queue.' },
];

const FOLDERS = [
  { name: 'Referrals', note: 'Inbound referrals & orders, routed to the right specialty.' },
  { name: 'Prior authorizations', note: 'Auth requests & determinations, CPT and amount captured.' },
  { name: 'Insurance claims', note: 'Institutional & professional claims, EOBs, remittances.' },
  { name: 'Lab reports', note: 'Multi-analyte panels mapped to discrete result fields.' },
  { name: 'Discharge summaries', note: 'Long clinical narratives reduced to routable structured data.' },
  { name: 'Patient intake', note: 'New-patient & registration forms, demographics extracted.' },
];

const INVOICE = [
  {
    item: 'STARTER — first 100 pages',
    detail: 'Try it on real paperwork. No card, no key. All document types, gated routing, review queue.',
    amount: '$0.00',
    cta: { label: 'Start free', to: '/demo' },
  },
  {
    item: 'OPERATIONS — per page',
    detail: 'For clinics and billing teams running daily volume. Auto-route + review workflow, per-document cost metering, audit trail on every decision.',
    amount: '$0.08',
    cta: { label: 'Get started', to: '/signup' },
    featured: true,
  },
  {
    item: 'NETWORK — volume',
    detail: 'For provider networks at scale. Discounted per-page pricing, routing rules per site & payer, SSO & role-based review, BAA on request.',
    amount: 'custom',
    cta: { label: 'Talk to us', to: '/contact' },
  },
];

const FAQ = [
  {
    q: 'What happens if the AI is wrong?',
    a: 'Any field below the confidence threshold is held for human review — it never auto-routes. Where the two OCR engines disagreed, both readings are shown side by side so the reviewer sees exactly where the uncertainty came from.',
  },
  {
    q: 'What file formats does it handle?',
    a: 'PDF, images (JPEG, PNG, WebP, HEIC), CSV, and spreadsheets. Faxes and legacy formats are accepted — the source channel is recorded at ingest.',
  },
  {
    q: 'How accurate is the extraction?',
    a: 'Accuracy depends on document quality. Rather than citing a headline number, the pipeline makes its uncertainty explicit: every field carries its own confidence score, and the gate (≥ 0.90) decides what is safe to auto-route. Uncertain fields always go to a person.',
  },
  {
    q: 'Does it handle faxes and scans?',
    a: 'Yes. Ingest detects the source channel (email, fax, portal upload) and records it on every document. Dual-engine OCR handles low-quality scans, stamps, and handwritten fields.',
  },
  {
    q: 'Is it HIPAA-ready?',
    a: 'The pipeline is designed around PHI handling — PII redaction at ingest, no plain-text logging of patient data, and a full audit trail on every decision. The Network plan includes a BAA on request.',
  },
];

export default function LandingPaper() {
  useEffect(() => {
    document.title = 'Live Demo — DocFlow AI';
    return () => {
      document.title = 'DocFlow AI — AI document extraction for healthcare ops';
    };
  }, []);

  const scenes = useScenes<HTMLDivElement>();

  return (
    <div className="pp-scope" ref={scenes}>
      <MarketingNav />

      <main id="main" className="pp-desk">
        {/* ── Scene 1 · fax page 1: the hero document ─────────────────── */}
        <section className="pp-scene pp-scene-hero" data-scene>
          <div className="pp-spread">
            <PaperDoc />
            <aside className="pp-rail">
              <MarginNote pen="red" size="xl" tilt={-2}>
                Stop re-keying medical paperwork.
              </MarginNote>
              <MarginNote pen="blue" tilt={-1} delay={400}>
                DocFlow AI reads the faxes, scans &amp; PDFs your team types in by hand — extracts
                the fields, <u>auto-routes the confident ones</u>. Only the uncertain reach a human.
              </MarginNote>
              <div className="pp-rail-cta">
                <a href="#try" className="pp-stampbtn">▶ RUN A DOCUMENT YOURSELF ↓</a>
                <a href="#pricing" className="pp-pencil-link">see pricing ↓</a>
              </div>
              <div className="pp-tallies" aria-label="Key properties">
                <div><b>≥ 0.90</b> gate holds uncertain fields</div>
                <div><b>every</b> decision in the audit trail</div>
                <div><b>per-doc</b> cost tracked from token usage</div>
              </div>
            </aside>
          </div>
        </section>

        {/* ── Scene 2 · the old way: staff memo ───────────────────────── */}
        <section className="pp-scene" data-scene>
          <div className="pp-spread">
            <div className="pp-page pp-memo">
              <Paperclip />
              <CoffeeRing style={{ right: '9%', top: '14%' }} />
              <div className="pp-memo-head">
                INTERNAL MEMO — RE: INBOUND PAPERWORK
                <span>DISTRIBUTION: FRONT OFFICE · BILLING</span>
              </div>
              <div className="pp-rule" aria-hidden="true" />
              <p className="pp-type">
                Please re-key the attached referrals and prior-auths into the PM system by EOD.
                Check member IDs digit by digit — payer bounced{' '}
                <PenCircle delay={300}>SHP-88214-<b>01</b></PenCircle> last week (should have been
                <b> -07</b>) and the claim was denied.
              </p>
              <p className="pp-type">
                Reminder: note who accepted each value. Audit asked and we had{' '}
                <PenCircle delay={900}>no record</PenCircle>.
              </p>
            </div>
            <aside className="pp-rail">
              <MarginNote pen="red" size="lg" tilt={-2}>The problem —</MarginNote>
              <MarginNote pen="red" tilt={-1} delay={300}>
                staff read documents line by line and retype them. Slow, expensive — and one wrong
                digit becomes a denied claim.
              </MarginNote>
              <MarginNote pen="pencil" tilt={1.5} delay={700}>3rd re-key today ||| ✗</MarginNote>
            </aside>
          </div>
        </section>

        {/* ── Scene 3 · routing slip: who it's for ────────────────────── */}
        <section className="pp-scene" data-scene id="who">
          <div className="pp-spread">
            <div className="pp-page">
              <div className="pp-doc-title pp-slip-title">FAX ROUTING SLIP — DELIVER TO:</div>
              <div className="pp-rule" aria-hidden="true" />
              <ul className="pp-slip">
                {ROUTE_SLIP.map((r, i) => (
                  <li key={r.title}>
                    <span className="pp-slip-box" aria-hidden="true">
                      <HandCheck delay={300 + i * 350} />
                    </span>
                    <div>
                      <div className="pp-slip-name">{r.title}</div>
                      <p className="pp-type">{r.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <aside className="pp-rail">
              <MarginNote pen="blue" tilt={-1.5}>
                for the back office buried in inbound paperwork — not individual doctors. If your
                team reads documents and types them into a system, this is for you.
              </MarginNote>
            </aside>
          </div>
        </section>

        {/* ── Scene 4 · processing ledger: how it works ───────────────── */}
        <section className="pp-scene" data-scene id="how">
          <div className="pp-spread">
            <div className="pp-page">
              <div className="pp-doc-title pp-slip-title">PROCESSING LEDGER — DOC PA-017</div>
              <div className="pp-rule" aria-hidden="true" />
              <ol className="pp-ledger">
                {LEDGER.map((step, i) => (
                  <li key={step.n}>
                    <Stamp tone={i === 3 ? 'amber' : i === 4 ? 'green' : 'mint'} tilt={-3} delay={250 + i * 320}>
                      {step.n} {step.title}
                    </Stamp>
                    <p className="pp-type">{step.body}</p>
                  </li>
                ))}
              </ol>
              <div className="pp-ledger-cta">
                <Link to="/demo/live" className="pp-stampbtn">▶ WATCH EVERY STAGE, ONE BY ONE</Link>
              </div>
            </div>
            <aside className="pp-rail">
              <MarginNote pen="blue" tilt={-1}>
                the whole pipeline, end to end — upload → read → extract → gate → route. Every row
                lands in the audit trail.
              </MarginNote>
            </aside>
          </div>
        </section>

        {/* ── Scene 5 · centerpiece: the handwritten field peels off ──── */}
        <section className="pp-scene pp-scene-review" data-scene>
          <div className="pp-spread">
            <div className="pp-page pp-crop">
              <FaxHeader page={3} />
              <div className="pp-doc-title pp-slip-title">SECTION D — DETERMINATION</div>
              <div className="pp-rule" aria-hidden="true" />
              <dl className="pp-fields">
                <div className="pp-field">
                  <dt>PLACE OF SERVICE</dt>
                  <dd>
                    <OcrBox label="POS" conf="0.98" delay={250}>OUTPATIENT — 22</OcrBox>
                    <Stamp tone="green" tilt={-5} delay={2400}>ROUTED</Stamp>
                  </dd>
                </div>
                <div className="pp-field">
                  <dt>UNITS APPROVED</dt>
                  <dd>
                    <OcrBox label="UNITS" conf="0.97" delay={550}>1</OcrBox>
                    <Stamp tone="green" tilt={4} delay={2600}>ROUTED</Stamp>
                  </dd>
                </div>
                <div className="pp-field pp-field-hand">
                  <dt>AUTHORIZED AMOUNT</dt>
                  <dd>
                    <OcrBox label="AUTH_AMOUNT" conf="0.88" tone="amber" delay={950}>
                      <span className="pp-hand-value pp-hand-big">$ 48,210.00</span>
                    </OcrBox>
                    <Stamp tone="amber" tilt={-7} delay={1600}>⚑ FLAGGED — BELOW GATE 0.90</Stamp>
                  </dd>
                </div>
              </dl>
            </div>
            <aside className="pp-rail">
              <StickyNote tilt={-3} delay={2000}>
                <b>→ HUMAN REVIEW</b>
                <p>
                  handwriting read at 0.88 — below the 0.90 gate. A person confirms{' '}
                  <b>$48,210</b> before anything routes.
                </p>
                <span className="pp-sticky-tick" aria-hidden="true">✓ reviewed — J.M.</span>
              </StickyNote>
              <MarginNote pen="blue" tilt={-1} delay={2900}>
                this is the whole idea: the machine does the reading, a person owns the judgement
                calls. Nothing uncertain slips through.
              </MarginNote>
            </aside>
          </div>
        </section>

        {/* ── Scene 5b · intake tray: the REAL pipeline, interactive ──── */}
        <section className="pp-scene" data-scene id="try">
          <div className="pp-spread">
            <PaperTryIt />
            <aside className="pp-rail">
              <MarginNote pen="red" size="lg" tilt={-2}>Don't take our word —</MarginNote>
              <MarginNote pen="blue" tilt={-1} delay={300}>
                pick a document and the real pipeline runs it right here: every value, confidence
                and the routing decision below is computed, not written.
              </MarginNote>
            </aside>
          </div>
        </section>

        {/* ── Scene 6 · folder fan: what it handles ───────────────────── */}
        <section className="pp-scene" data-scene id="features">
          <div className="pp-spread">
            <div className="pp-folders-wrap">
              <MarginNote pen="red" size="lg" tilt={-1.5}>What it handles —</MarginNote>
              <div className="pp-folders">
                {FOLDERS.map((f, i) => (
                  <article className="pp-anim pp-folder" key={f.name} style={{ '--d': `${i * 110}ms`, '--tilt': `${(i % 3) - 1}deg` } as React.CSSProperties}>
                    <span className="pp-folder-tab">{f.name}</span>
                    <p className="pp-type">{f.note}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Scene 7 · invoice: pricing ──────────────────────────────── */}
        <section className="pp-scene" data-scene id="pricing">
          <div className="pp-spread">
            <div className="pp-page pp-invoice">
              <div className="pp-doc-head">
                <div>
                  <div className="pp-doc-title">INVOICE — USAGE-BASED</div>
                  <div className="pp-doc-sub">Pay per page, not per seat · first 100 pages free</div>
                </div>
                <div className="pp-doc-no">No. 0001</div>
              </div>
              <div className="pp-rule" aria-hidden="true" />
              <table className="pp-inv-table">
                <thead>
                  <tr><th>ITEM</th><th>MEMO</th><th className="pp-inv-amt">RATE</th><th /></tr>
                </thead>
                <tbody>
                  {INVOICE.map((row) => (
                    <tr key={row.item} className={row.featured ? 'pp-inv-featured' : undefined}>
                      <td className="pp-inv-item">
                        {row.item}
                        {row.featured && <span className="pp-inv-pop">★ most popular</span>}
                      </td>
                      <td className="pp-inv-memo">{row.detail}</td>
                      <td className="pp-inv-amt">{row.amount}</td>
                      <td className="pp-inv-cta">
                        <Link to={row.cta.to} className="pp-stampbtn pp-stampbtn-sm">{row.cta.label}</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="pp-inv-total">
                <span>COSTS TRACK YOUR ACTUAL VOLUME</span>
                <span aria-hidden="true">··········································</span>
              </div>
              <Stamp tone="red" big tilt={-10} delay={900}>ILLUSTRATIVE — PORTFOLIO DEMO</Stamp>
            </div>
          </div>
        </section>

        {/* ── Scene 8 · compliance appendix: trust ────────────────────── */}
        <section className="pp-scene" data-scene>
          <div className="pp-spread">
            <div className="pp-page pp-aged">
              <div className="pp-doc-title pp-slip-title">COMPLIANCE APPENDIX</div>
              <div className="pp-rule" aria-hidden="true" />
              <div className="pp-seals">
                <div>
                  <Seal tone="green" delay={200}>PII REDACTED<br />AT INGEST</Seal>
                  <p className="pp-type">
                    PII is detected and redacted before anything is logged. Designed for healthcare
                    data handling from the first byte. In this demo all data is synthetic — nothing
                    is sent to external services or stored.
                  </p>
                </div>
                <div>
                  <Seal tone="mint" delay={550}>CONFIDENCE<br />GATE ≥ 0.90</Seal>
                  <p className="pp-type">
                    Nothing uncertain is auto-accepted. A single, unit-tested gate decides what is
                    safe to route and what a person must see.
                  </p>
                </div>
                <div>
                  <Seal tone="amber" delay={900}>HUMAN IN<br />THE LOOP</Seal>
                  <p className="pp-type">
                    Borderline fields land in a review queue with side-by-side engine evidence — a
                    person approves the exact values that matter.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Scene 9 · appendix A: FAQ ───────────────────────────────── */}
        <section className="pp-scene" data-scene id="faq">
          <div className="pp-spread">
            <div className="pp-page pp-aged">
              <div className="pp-doc-title pp-slip-title">APPENDIX A — COMMON QUESTIONS</div>
              <div className="pp-rule" aria-hidden="true" />
              <dl className="pp-faq">
                {FAQ.map((item, i) => (
                  <div className="pp-anim pp-faq-item" key={item.q} style={{ '--d': `${i * 120}ms` } as React.CSSProperties}>
                    <dt className="pp-type">Q. {item.q}</dt>
                    <dd className="pp-faq-a">{item.a}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* ── Scene 10 · disposition: final CTA ───────────────────────── */}
        <section className="pp-scene pp-scene-final" data-scene>
          <div className="pp-spread">
            <div className="pp-page pp-final">
              <FaxHeader page={6} />
              <div className="pp-doc-title pp-slip-title">DISPOSITION</div>
              <div className="pp-rule" aria-hidden="true" />
              <p className="pp-type">
                Extraction, confidence scores, and a routing decision — computed live on a real
                document, right now. First 100 pages free.
              </p>
              <div className="pp-final-stamp">
                <Stamp tone="green" big tilt={-8} delay={300}>APPROVED — ROUTED</Stamp>
              </div>
              <div className="pp-final-ctas">
                <a href="#try" className="pp-stampbtn">▶ RUN A DOCUMENT YOURSELF</a>
                <Link to="/signup" className="pp-sig">
                  SIGN HERE <span aria-hidden="true">✗&nbsp;____________________</span>
                </Link>
              </div>
              <div className="pp-eot" aria-hidden="true">— P.06/06 · END OF TRANSMISSION —</div>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
