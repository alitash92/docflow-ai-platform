/* ════════════════════════════════════════════════════════════════════════
   HeroPipeline — the signature looping hero animation.

   A scanned medical document flows through the AI pipeline, live:
     1. a faxed page lands  →
     2. an OCR scan-line sweeps it  →
     3. extracted fields light up one by one, each with a confidence bar  →
     4. the confident ones auto-route; an uncertain one peels off to the
        human-review queue.

   Pure SVG + CSS keyframes (no libs, no CDNs). All timing lives in
   hero-pipeline.css. Respects prefers-reduced-motion / freeze: in that case
   the `.freeze` ancestor pins every element on its final, fully-revealed
   frame so a screenshot shows the completed extraction.
   ──────────────────────────────────────────────────────────────────────── */

interface FieldRow {
  label: string;
  /** 0..1 confidence — drives the bar width + colour. */
  conf: number;
  /** the one field that is uncertain and routes to human review */
  review?: boolean;
}

const FIELDS: FieldRow[] = [
  { label: 'Patient', conf: 0.99 },
  { label: 'Member ID', conf: 0.98 },
  { label: 'CPT / Procedure', conf: 0.96 },
  { label: 'Auth amount', conf: 0.71, review: true },
  { label: 'Referring NPI', conf: 0.97 },
];

export default function HeroPipeline() {
  return (
    <div className="hp" role="img" aria-label="Animation: a scanned medical document is read by AI, fields are extracted with confidence scores, and the document is routed automatically or to a human review queue.">
      {/* ambient glow behind the whole rig */}
      <div className="hp-glow" aria-hidden="true" />

      <div className="hp-stage" aria-hidden="true">
        {/* ── 1 · the inbound scanned page ─────────────────────────── */}
        <div className="hp-doc">
          <div className="hp-doc-tab">FAX · 3 pp</div>
          <div className="hp-doc-page">
            <div className="hp-doc-head">
              <span className="hp-doc-title">PRIOR AUTHORIZATION</span>
              <span className="hp-doc-badge">scanned</span>
            </div>
            {/* faux scanned text lines */}
            <div className="hp-lines">
              {[88, 64, 92, 50, 78, 40, 70, 58, 84].map((w, i) => (
                <span key={i} style={{ width: `${w}%` }} />
              ))}
            </div>
            {/* the sweeping OCR scan-line */}
            <div className="hp-scan" />
          </div>
        </div>

        {/* ── 2 · the flow connector with travelling pulse ─────────── */}
        <div className="hp-link">
          <span className="hp-link-label">extract</span>
          <span className="hp-pulse" />
          <span className="hp-pulse hp-pulse-2" />
        </div>

        {/* ── 3 · the live extraction card ─────────────────────────── */}
        <div className="hp-card">
          <div className="hp-card-head">
            <span className="hp-card-dot" />
            <span className="hp-card-name">Prior_Auth_017.pdf</span>
            <span className="hp-card-type">Prior Authorization</span>
          </div>
          <div className="hp-fields">
            {FIELDS.map((f, i) => (
              <div
                className={`hp-field${f.review ? ' review' : ''}`}
                style={{ '--i': i } as React.CSSProperties}
                key={f.label}
              >
                <span className="hp-field-label">{f.label}</span>
                <span className="hp-bar">
                  <span
                    className={`hp-bar-fill ${f.conf >= 0.9 ? 'high' : 'mid'}`}
                    style={{ '--w': `${Math.round(f.conf * 100)}%` } as React.CSSProperties}
                  />
                </span>
                <span className="hp-field-conf">{Math.round(f.conf * 100)}%</span>
              </div>
            ))}
          </div>

          {/* ── 4 · routing outcome chips ──────────────────────────── */}
          <div className="hp-routes">
            <span className="hp-route auto">
              <span className="hp-route-ic">✓</span> Auto-routed · Claims
            </span>
            <span className="hp-route review">
              <span className="hp-route-ic">⚑</span> 1 field → Human review
            </span>
          </div>
        </div>
      </div>

      {/* tiny live caption that cycles with the loop */}
      <div className="hp-caption" aria-hidden="true">
        <span className="hp-cap c1">Reading page…</span>
        <span className="hp-cap c2">Extracting fields…</span>
        <span className="hp-cap c3">Confidence-gating…</span>
        <span className="hp-cap c4">Routed.</span>
      </div>
    </div>
  );
}
