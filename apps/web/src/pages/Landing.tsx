import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import MarketingNav from '../components/MarketingNav';
import MarketingFooter from '../components/MarketingFooter';
import HeroPipeline from '../components/HeroPipeline';
import { useReveal } from '../anim/useReveal';

/* Who it's for — the back-office buried in inbound paperwork. */
const AUDIENCE = [
  {
    glyph: '✚',
    title: 'Clinics & practices',
    body: 'Front- and back-office staff who triage inbound referrals, intake forms, and faxed orders all day instead of seeing patients.',
  },
  {
    glyph: '◈',
    title: 'Provider networks',
    body: 'Multi-site operations teams routing thousands of documents a day to the right department, location, and downstream system.',
  },
  {
    glyph: '$',
    title: 'Medical billing & RCM',
    body: 'Revenue-cycle teams re-keying claims, EOBs, and prior-auths into the practice-management system — where one wrong digit means a denial.',
  },
];

/* The pipeline, visualized. */
const STEPS = [
  { n: '01', title: 'Upload or forward', body: 'Drop a file in, or auto-forward your fax/scan inbox. PDFs, images, faxes, multi-page bundles.' },
  { n: '02', title: 'AI reads it', body: 'OCR plus a frontier vision LLM read every page — even handwriting, stamps, and bad scans.' },
  { n: '03', title: 'Fields extracted', body: 'Structured fields come out — patient, member ID, CPT, NPI, dates — each with its own confidence.' },
  { n: '04', title: 'Confidence-gated', body: 'A unit-tested gate auto-routes the confident extractions and holds anything uncertain.' },
  { n: '05', title: 'Routed', body: 'Clean documents flow straight to your system; only the uncertain ones reach a human review queue.' },
];

/* What it handles — the healthcare document types. */
const DOC_TYPES = [
  { glyph: '⇄', name: 'Referrals', note: 'Inbound referrals & orders, routed to the right specialty.' },
  { glyph: '✓', name: 'Prior authorizations', note: 'Auth requests & determinations, CPT and amount captured.' },
  { glyph: '$', name: 'Insurance claims', note: 'Institutional & professional claims, EOBs, remittances.' },
  { glyph: '∿', name: 'Lab reports', note: 'Multi-analyte panels mapped to discrete result fields.' },
  { glyph: '⎙', name: 'Discharge summaries', note: 'Long clinical narratives reduced to routable structured data.' },
  { glyph: '☰', name: 'Patient intake', note: 'New-patient & registration forms, demographics extracted.' },
];

/* Pricing — illustrative usage-based tiers. */
const TIERS = [
  {
    name: 'Starter',
    price: '$0',
    unit: 'first 100 pages free',
    blurb: 'Try it on real paperwork. No card, no key.',
    feats: ['100 pages / month included', 'All document types', 'Confidence-gated routing', 'Human-review queue'],
    cta: 'Start free',
    to: '/demo',
    featured: false,
  },
  {
    name: 'Operations',
    price: '$0.08',
    unit: 'per page',
    blurb: 'For clinics and billing teams running daily volume.',
    feats: ['Usage-based — pay per page', 'Auto-route + review workflow', 'Per-document cost metering', 'Audit trail on every decision'],
    cta: 'Get started',
    to: '/signup',
    featured: true,
  },
  {
    name: 'Network',
    price: 'Volume',
    unit: 'custom per-page rate',
    blurb: 'For provider networks at scale.',
    feats: ['Discounted per-page pricing', 'Routing rules per site & payer', 'SSO & role-based review', 'PHI handling & BAA on request'],
    cta: 'Talk to us',
    to: '/contact',
    featured: false,
  },
];

/* Trust / security — PHI, confidence gate, human-in-the-loop. */
const TRUST = [
  { glyph: '🛡', title: 'Built for PHI', body: 'PII is detected and redacted at ingest before anything is logged. Designed for healthcare data handling from the first byte. In this demo all data is synthetic — nothing is sent to external services or stored.' },
  { glyph: '◐', title: 'Confidence-gated', body: 'Nothing uncertain is auto-accepted. A single, unit-tested gate decides what is safe to route and what a person must see.' },
  { glyph: '✓', title: 'Human in the loop', body: 'Borderline fields land in a review queue with side-by-side engine evidence — a person approves the exact values that matter.' },
];

/* FAQ */
const FAQ = [
  {
    q: 'What happens if the AI is wrong?',
    a: 'Any field below the confidence threshold is held for human review — it never auto-routes. Where the two OCR engines disagreed, both readings are shown side by side so the reviewer sees exactly where the uncertainty came from.',
  },
  {
    q: 'What file formats does it handle?',
    a: 'PDF, images (JPEG, PNG, WebP, HEIC), CSV, and spreadsheets (XLSX/DOCX). Faxes and legacy formats are accepted — the source channel is recorded at ingest.',
  },
  {
    q: 'How accurate is the extraction?',
    a: 'Accuracy depends on document quality. Rather than citing a headline number, the pipeline makes its uncertainty explicit: every field carries its own confidence score, and the confidence gate (≥ 0.90) decides what\'s safe to auto-route. Uncertain fields always go to a person.',
  },
  {
    q: 'Does it handle faxes and scans?',
    a: 'Yes. The ingest stage detects the source channel (email, fax, portal upload) and records it on every document. Dual-engine OCR handles low-quality scans, stamps, and handwritten fields.',
  },
  {
    q: 'Is it HIPAA-ready?',
    a: 'The pipeline is designed around PHI handling — PII redaction at ingest, no plain-text logging of patient data, and a full audit trail on every decision. The Network plan includes a BAA on request.',
  },
];

export default function Landing() {
  useEffect(() => {
    document.title = 'DocFlow AI — AI document extraction for healthcare ops';
  }, []);

  const reveal = useReveal<HTMLDivElement>();
  const reduced = useMemo(
    () =>
      typeof window !== 'undefined' &&
      (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        new URLSearchParams(window.location.search).get('screenshot') === '1'),
    [],
  );

  return (
    <div className="mkt paper-grain" ref={reveal}>
      <MarketingNav />

      <main id="main">
        {/* ── Hero (deep command surface, live animation) ───────────── */}
        <section className={`mkt-hero-deep${reduced ? ' is-reduced' : ''}`}>
          <div className="mkt-hero-deep-bg" aria-hidden="true" />
          <div className="mkt-container mkt-hero-deep-grid">
            <div className="mkt-hero-deep-copy">
              <span className="mkt-eyebrow on-deep">
                AI document extraction · healthcare operations
              </span>
              <h1 className="mkt-hero-title on-deep">
                Stop re-keying<br />medical paperwork.
              </h1>
              <p className="mkt-hero-sub on-deep">
                DocFlow AI reads the faxes, scans, and PDFs your team types in by hand —
                referrals, prior-auths, claims, lab reports, discharge summaries — extracts the
                fields, and <em>auto-routes the confident ones</em>. Only the uncertain ones reach
                a human.
              </p>
              <div className="mkt-hero-cta">
                <Link to="/demo" className="btn btn-lg btn-demo">▶ Try it free</Link>
                <a href="#pricing" className="btn ghost btn-lg on-deep">See pricing</a>
              </div>
              <p className="mkt-hero-note on-deep">
                First 100 pages free · no credit card · synthetic data in this demo
              </p>

              <div className="mkt-hero-stats on-deep mkt-hero-stats-3">
                <div><span className="mkt-stat-v">≥ 0.90</span><span className="mkt-stat-l">gate holds uncertain fields</span></div>
                <div><span className="mkt-stat-v">every</span><span className="mkt-stat-l">decision in the audit trail</span></div>
                <div><span className="mkt-stat-v">per-doc</span><span className="mkt-stat-l">cost tracked from token usage</span></div>
              </div>
            </div>

            <div className="mkt-hero-deep-anim">
              <HeroPipeline />
            </div>
          </div>
        </section>

        {/* ── The problem ───────────────────────────────────────────── */}
        <section className="mkt-section mkt-problem">
          <div className="mkt-container">
            <h2 className="mkt-section-title">The problem: paperwork eats your back office</h2>
            <p className="mkt-section-lead">
              Every clinic and billing team drowns in inbound documents. Staff read faxed
              referrals and scanned claims line by line and re-key them into another system — slow,
              expensive, and a wrong digit becomes a denied claim.
            </p>
            <div className="mkt-problem-grid">
              <div className="mkt-problem-card reveal">
                <div className="mkt-problem-stat">field-by-field re-keying</div>
                <h3>Manual re-keying</h3>
                <p>Staff retype patient, member, CPT, and NPI fields off scans — instead of working the cases that need a human.</p>
              </div>
              <div className="mkt-problem-card reveal" style={{ transitionDelay: '80ms' }}>
                <div className="mkt-problem-stat">one wrong digit = denied claim</div>
                <h3>Typos become denials</h3>
                <p>One mistyped member ID or code and the claim bounces — rework, appeals, and delayed revenue.</p>
              </div>
              <div className="mkt-problem-card reveal" style={{ transitionDelay: '160ms' }}>
                <div className="mkt-problem-stat">zero provenance on accepted values</div>
                <h3>No audit trail</h3>
                <p>When a value is wrong, there's no record of where it came from or why it was accepted.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Who it's for ──────────────────────────────────────────── */}
        <section className="mkt-section mkt-audience" id="who">
          <div className="mkt-container">
            <h2 className="mkt-section-title">Who it's for</h2>
            <p className="mkt-section-lead">
              The back office buried in inbound paperwork — not individual doctors. If your team
              reads documents and types them into a system, DocFlow AI is for you.
            </p>
            <div className="mkt-audience-grid">
              {AUDIENCE.map((a, i) => (
                <article className="mkt-audience-card reveal" key={a.title} style={{ transitionDelay: `${i * 80}ms` }}>
                  <div className="mkt-audience-glyph" aria-hidden="true">{a.glyph}</div>
                  <h3>{a.title}</h3>
                  <p>{a.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────── */}
        <section className="mkt-section mkt-how" id="how">
          <div className="mkt-container">
            <h2 className="mkt-section-title">How it works</h2>
            <p className="mkt-section-lead">
              Upload or forward a document → the AI reads it → fields come out with confidence
              scores → the gate routes them. The whole pipeline, end to end.
            </p>
            <ol className="mkt-pipeline">
              {STEPS.map((s, i) => (
                <li className="mkt-pipeline-step reveal" key={s.n} style={{ transitionDelay: `${i * 60}ms` }}>
                  <span className="mkt-pipeline-n" aria-hidden="true">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
            <div className="mkt-how-cta">
              <Link to="/demo" className="btn btn-lg btn-demo">▶ Watch it run on a live document</Link>
            </div>
          </div>
        </section>

        {/* ── What it handles ───────────────────────────────────────── */}
        <section className="mkt-section mkt-docs" id="features">
          <div className="mkt-container">
            <h2 className="mkt-section-title">What it handles</h2>
            <p className="mkt-section-lead">
              The document types that flood a healthcare back office — each one read, typed, and
              mapped to the fields your downstream systems expect.
            </p>
            <div className="mkt-docs-grid">
              {DOC_TYPES.map((d, i) => (
                <article className="mkt-doc-card reveal" key={d.name} style={{ transitionDelay: `${i * 55}ms` }}>
                  <div className="mkt-doc-glyph" aria-hidden="true">{d.glyph}</div>
                  <div>
                    <h3>{d.name}</h3>
                    <p>{d.note}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ───────────────────────────────────────────────── */}
        <section className="mkt-section mkt-pricing" id="pricing">
          <div className="mkt-container">
            <h2 className="mkt-section-title">Simple, usage-based pricing</h2>
            <p className="mkt-section-lead">
              Pay per page, not per seat — costs track your actual volume. Your first 100 pages
              are free.
            </p>
            <div className="mkt-pricing-grid">
              {TIERS.map((t, i) => (
                <article
                  className={`mkt-tier reveal${t.featured ? ' featured' : ''}`}
                  key={t.name}
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  {t.featured && <div className="mkt-tier-flag">Most popular</div>}
                  <div className="mkt-tier-name">{t.name}</div>
                  <div className="mkt-tier-price">
                    <span className="mkt-tier-amount">{t.price}</span>
                    <span className="mkt-tier-unit">{t.unit}</span>
                  </div>
                  <p className="mkt-tier-blurb">{t.blurb}</p>
                  <ul className="mkt-tier-feats">
                    {t.feats.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <Link to={t.to} className={`btn btn-block${t.featured ? ' btn-demo' : ' ghost'}`}>
                    {t.cta}
                  </Link>
                </article>
              ))}
            </div>
            <p className="mkt-pricing-illus-note">
              Pricing shown is illustrative — this is a portfolio demo, not a live product.
            </p>
          </div>
        </section>

        {/* ── Trust / security ──────────────────────────────────────── */}
        <section className="mkt-section mkt-trust">
          <div className="mkt-container">
            <h2 className="mkt-section-title">Nothing uncertain auto-routes. A person stays in control.</h2>
            <p className="mkt-section-lead">
              Healthcare data needs care. DocFlow AI is built so nothing uncertain slips through
              and a person stays in control of the values that matter.
            </p>
            <div className="mkt-trust-grid">
              {TRUST.map((t, i) => (
                <article className="mkt-trust-card reveal" key={t.title} style={{ transitionDelay: `${i * 80}ms` }}>
                  <div className="mkt-trust-glyph" aria-hidden="true">{t.glyph}</div>
                  <h3>{t.title}</h3>
                  <p>{t.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────────────── */}
        <section className="mkt-section mkt-faq" id="faq">
          <div className="mkt-container">
            <h2 className="mkt-section-title">Common questions</h2>
            <dl className="mkt-faq-list">
              {FAQ.map((item, i) => (
                <div className="mkt-faq-item reveal" key={item.q} style={{ transitionDelay: `${i * 60}ms` }}>
                  <dt className="mkt-faq-q">{item.q}</dt>
                  <dd className="mkt-faq-a">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────── */}
        <section className="mkt-section mkt-cta">
          <div className="mkt-container mkt-cta-inner">
            <h2>Put your inbound paperwork on autopilot.</h2>
            <p>
              Run a real document through the pipeline right now — extraction, confidence
              scores, and a routing decision, computed live. First 100 pages free.
            </p>
            <div className="mkt-hero-cta">
              <Link to="/demo" className="btn btn-lg btn-demo">▶ Try the live demo</Link>
              <Link to="/signup" className="btn ghost btn-lg on-deep">Get started</Link>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
