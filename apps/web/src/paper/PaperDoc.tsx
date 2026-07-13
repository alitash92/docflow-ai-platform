import { FaxHeader, OcrBox, Redacted, Stamp } from './parts';

/* The hero rig: fax page 1 of the synthetic Prior Authorization the /demo
   pipeline actually processes (fixtures/documents/Prior_Auth_017.json), being
   read by the machine in front of the visitor. Values mirror the fixture so
   the landing and the live demo tell one story. */

export default function PaperDoc() {
  return (
    <div
      className="pp-page pp-hero-page"
      role="img"
      aria-label="A scanned prior-authorization fax being read by DocFlow AI: OCR boxes draw around the fields, each gets a confidence score, the synthetic patient name is redacted, and the document is marked extracted."
    >
      <FaxHeader page={1} />
      <div className="pp-watermark" aria-hidden="true">
        PORTFOLIO SHOWCASE · SYNTHETIC DATA
      </div>

      <div className="pp-doc-head">
        <div>
          <div className="pp-doc-title">PRIOR AUTHORIZATION REQUEST</div>
          <div className="pp-doc-sub">Summit Health Plan · Utilization Management</div>
        </div>
        <div className="pp-doc-no">
          PA-017
          <span>URGENT ☐ &nbsp;STANDARD ☒</span>
        </div>
      </div>

      <div className="pp-rule" aria-hidden="true" />

      <dl className="pp-fields">
        <div className="pp-field">
          <dt>PATIENT NAME</dt>
          <dd>
            <OcrBox label="PATIENT" conf="0.99" delay={900}>
              <Redacted delay={3300}>Marcus Delgado</Redacted>
            </OcrBox>
          </dd>
        </div>
        <div className="pp-field">
          <dt>MEMBER ID</dt>
          <dd>
            <OcrBox label="MEMBER_ID" conf="0.98" delay={1350}>
              SHP-88214-07
            </OcrBox>
          </dd>
        </div>
        <div className="pp-field">
          <dt>PROCEDURE (CPT)</dt>
          <dd>
            <OcrBox label="CPT" conf="0.96" delay={1800}>
              72148 — MRI LUMBAR SPINE W/O CONTRAST
            </OcrBox>
          </dd>
        </div>
        <div className="pp-field">
          <dt>REFERRING NPI</dt>
          <dd>
            <OcrBox label="NPI" conf="0.97" delay={2250}>
              1093 817 442
            </OcrBox>
          </dd>
        </div>
        <div className="pp-field">
          <dt>DATE OF REQUEST</dt>
          <dd>
            <OcrBox label="DATE" conf="0.99" delay={2700}>
              06/09/2026
            </OcrBox>
          </dd>
        </div>
        <div className="pp-field pp-field-hand">
          <dt>AUTHORIZED AMOUNT</dt>
          <dd>
            <span className="pp-hand-value">$ 48,210.00</span>
            <span className="pp-hand-tag" aria-hidden="true">handwritten ↓ page 3</span>
          </dd>
        </div>
      </dl>

      <div className="pp-rule" aria-hidden="true" />

      <div className="pp-doc-foot">
        <span>ATTACHMENTS: CLINICAL NOTES (4 pp) · IMAGING ORDER</span>
        <Stamp tone="mint" tilt={-4} delay={3900}>
          EXTRACTED ✓ 1.4s
        </Stamp>
      </div>

      {/* the machine's scan-line sweep */}
      <div className="pp-anim pp-scan" aria-hidden="true" />
    </div>
  );
}
