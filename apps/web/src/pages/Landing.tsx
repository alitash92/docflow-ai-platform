import { Link } from 'react-router-dom';
import MarketingNav from '../components/MarketingNav';
import MarketingFooter from '../components/MarketingFooter';

const FEATURES = [
  {
    glyph: '◍',
    title: 'Dual-engine OCR + classification',
    body:
      'Every inbound document is read by two OCR engines, their outputs merged field-by-field, then classified by type — prior auth, claim, referral, lab report, discharge summary.',
  },
  {
    glyph: '↗',
    title: 'Confidence-gated routing',
    body:
      'A real, unit-tested gate auto-routes high-confidence extractions (≥ 0.90) and holds anything uncertain. No silent guesses reach downstream systems.',
  },
  {
    glyph: '✓',
    title: 'Human-review queue',
    body:
      'Borderline and disagreeing fields land in a review drawer with side-by-side engine evidence, so a person approves the exact fields that need a human.',
  },
  {
    glyph: '$',
    title: 'Token cost tracking',
    body:
      'Per-document token metering rolls up into cost KPIs, so the spend of running an LLM pipeline at volume is visible, not a surprise.',
  },
];

const STEPS = [
  { n: '01', title: 'Ingest', body: 'Documents arrive from inbox channels — email, SMS, portal upload.' },
  { n: '02', title: 'Extract', body: 'Two OCR engines read each page; outputs are merged field-by-field.' },
  { n: '03', title: 'Judge & repair', body: 'Cross-engine disagreements are caught and repaired with evidence.' },
  { n: '04', title: 'Classify', body: 'The document is typed and its confidence scored per field.' },
  { n: '05', title: 'Route', body: 'High-confidence auto-routes; the rest go to human review.' },
];

export default function Landing() {
  return (
    <div className="mkt">
      <MarketingNav />

      <main id="main">
        {/* Hero */}
        <section className="mkt-hero">
          <div className="mkt-hero-glow" aria-hidden="true" />
          <div className="mkt-container mkt-hero-inner">
            <span className="mkt-eyebrow">Document intelligence · healthcare</span>
            <h1 className="mkt-hero-title">
              DocFlow AI — Document Intelligence for Healthcare
            </h1>
            <p className="mkt-hero-sub">
              Turn the daily flood of faxes, scans, and PDFs into structured, validated data —
              with a confidence gate that knows when to ask a human. Built for prior auths,
              claims, referrals, and clinical documents.
            </p>
            <div className="mkt-hero-cta">
              <Link to="/demo" className="btn btn-lg btn-demo">▶ Try the live demo</Link>
              <Link to="/signup" className="btn ghost btn-lg">Get started</Link>
            </div>
            <p className="mkt-hero-note">
              Watch the full pipeline run on a real document · synthetic data · no signup needed
            </p>

            <div className="mkt-hero-stats">
              <div><span className="mkt-stat-v">≥ 0.90</span><span className="mkt-stat-l">auto-route gate</span></div>
              <div><span className="mkt-stat-v">2</span><span className="mkt-stat-l">OCR engines merged</span></div>
              <div><span className="mkt-stat-v">30-day</span><span className="mkt-stat-l">KPI corpus</span></div>
              <div><span className="mkt-stat-v">0</span><span className="mkt-stat-l">API keys to demo</span></div>
            </div>
          </div>
        </section>

        {/* Highlighted demo band */}
        <section className="mkt-demo-band" aria-labelledby="demo-band-title">
          <div className="mkt-container mkt-demo-band-inner">
            <div className="mkt-demo-band-text">
              <span className="mkt-demo-band-tag">▶ Interactive demo</span>
              <h2 id="demo-band-title">See the tech in action — live, on one document</h2>
              <p>
                A guided, animated walkthrough of the real pipeline: ingestion → dual-engine
                OCR merge → frontier vision LLM → field extraction with per-field confidence →
                judge/repair → a confidence-gated routing decision. Every value is computed at
                runtime. No signup, no API key.
              </p>
              <div className="mkt-demo-band-pills">
                <span>Dual-engine OCR</span>
                <span>Frontier vision LLM</span>
                <span>Confidence gate ≥ 0.90</span>
                <span>Judge / repair loop</span>
              </div>
              <Link to="/demo" className="btn btn-lg btn-demo">▶ Try the Demo</Link>
            </div>
            <ol className="mkt-demo-band-rail" aria-hidden="true">
              {['Ingest', 'OCR', 'Classify', 'Extract', 'Judge', 'Repair', 'Route'].map((s, i) => (
                <li key={s}><span>{i + 1}</span>{s}</li>
              ))}
            </ol>
          </div>
        </section>

        {/* Problem */}
        <section className="mkt-section mkt-problem">
          <div className="mkt-container">
            <h2 className="mkt-section-title">The problem</h2>
            <p className="mkt-section-lead">
              Healthcare back-offices drown in unstructured documents. Faxes and scans get
              keyed in by hand, errors slip through, and there’s no record of why a value was
              accepted. Generic OCR gives you text — not trustworthy, routable data.
            </p>
            <div className="mkt-problem-grid">
              <div className="mkt-problem-card">
                <h3>Manual data entry</h3>
                <p>Staff retype fields off scanned forms — slow, costly, and error-prone.</p>
              </div>
              <div className="mkt-problem-card">
                <h3>Blind automation</h3>
                <p>Single-engine OCR auto-fills fields it isn’t sure about, with no gate.</p>
              </div>
              <div className="mkt-problem-card">
                <h3>No audit trail</h3>
                <p>When a value is wrong, there’s no record of which engine produced it or why.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mkt-section" id="features">
          <div className="mkt-container">
            <h2 className="mkt-section-title">What DocFlow AI does</h2>
            <p className="mkt-section-lead">
              A document pipeline built around trust: read it twice, reconcile, score
              confidence, and only auto-route what’s certain.
            </p>
            <div className="mkt-feature-grid">
              {FEATURES.map((f) => (
                <article className="mkt-feature-card" key={f.title}>
                  <div className="mkt-feature-glyph" aria-hidden="true">{f.glyph}</div>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mkt-section mkt-how" id="how">
          <div className="mkt-container">
            <h2 className="mkt-section-title">How it works</h2>
            <p className="mkt-section-lead">The pipeline, end to end.</p>
            <ol className="mkt-pipeline">
              {STEPS.map((s) => (
                <li className="mkt-pipeline-step" key={s.n}>
                  <span className="mkt-pipeline-n" aria-hidden="true">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CTA */}
        <section className="mkt-section mkt-cta">
          <div className="mkt-container mkt-cta-inner">
            <h2>See the pipeline run on a live dashboard</h2>
            <p>
              Open the demo dashboard — KPIs, a document inbox, and a human-review queue,
              all computed at runtime from synthetic fixtures.
            </p>
            <div className="mkt-hero-cta">
              <Link to="/demo" className="btn btn-lg btn-demo">▶ Try the live demo</Link>
              <Link to="/signup" className="btn ghost btn-lg">Get started</Link>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
