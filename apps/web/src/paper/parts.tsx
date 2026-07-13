import type { CSSProperties, ReactNode } from 'react';

/* Presentational primitives for the paper landing. Every animated decoration
   carries .pp-anim so the scene state machine (useScenes + landing-paper.css)
   can hide it pre-play; its plain-CSS default is the FINAL revealed state. */

type Tone = 'green' | 'red' | 'amber' | 'mint';
type Pen = 'red' | 'blue' | 'pencil';

const s = (tilt?: number, delay?: number): CSSProperties =>
  ({ '--tilt': `${tilt ?? 0}deg`, '--d': `${delay ?? 0}ms` }) as CSSProperties;

/** Fax transmission header — carries the honesty label in-fiction. */
export function FaxHeader({ page, pages = 6, from }: { page: number; pages?: number; from?: string }) {
  return (
    <div className="pp-faxhead" aria-hidden="true">
      <span>06/09 14:02</span>
      <span className="pp-faxhead-from">
        FROM: {from ?? 'DOCFLOW AI — PORTFOLIO DEMO · SYNTHETIC DATA · NO PHI'}
      </span>
      <span>
        P.{String(page).padStart(2, '0')}/{String(pages).padStart(2, '0')}
      </span>
    </div>
  );
}

/** Rubber stamp — thunks in with overshoot when the scene plays. */
export function Stamp({
  children,
  tone = 'green',
  tilt = -6,
  delay = 0,
  big = false,
}: {
  children: ReactNode;
  tone?: Tone;
  tilt?: number;
  delay?: number;
  big?: boolean;
}) {
  return (
    <span className={`pp-anim pp-stamp pp-stamp-${tone}${big ? ' pp-stamp-big' : ''}`} style={s(tilt, delay)}>
      {children}
    </span>
  );
}

/** Handwritten margin annotation — the humans' marketing voice. */
export function MarginNote({
  children,
  pen = 'red',
  tilt = -1.5,
  delay = 0,
  size,
}: {
  children: ReactNode;
  pen?: Pen;
  tilt?: number;
  delay?: number;
  size?: 'xl' | 'lg';
}) {
  return (
    <div className={`pp-anim pp-note pp-note-${pen}${size ? ` pp-note-${size}` : ''}`} style={s(tilt, delay)}>
      {children}
    </div>
  );
}

/** Machine OCR box drawn around a value, with confidence chip. */
export function OcrBox({
  label,
  conf,
  children,
  tone = 'mint',
  delay = 0,
}: {
  label: string;
  conf: string;
  children: ReactNode;
  tone?: 'mint' | 'amber';
  delay?: number;
}) {
  return (
    <span className={`pp-anim pp-ocr pp-ocr-${tone}`} style={s(0, delay)}>
      <span className="pp-ocr-corners" aria-hidden="true" />
      <span className="pp-ocr-chip" aria-hidden="true">
        [{label}] {conf}
      </span>
      {children}
    </span>
  );
}

/** Redaction bar that slides over PII. The text under it is synthetic anyway. */
export function Redacted({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <span className="pp-redacted">
      {children}
      <span className="pp-anim pp-redact-bar" style={s(0, delay)} aria-hidden="true" />
    </span>
  );
}

/** Sticky note — used for the human-review peel moment. */
export function StickyNote({
  children,
  tilt = -3,
  delay = 0,
}: {
  children: ReactNode;
  tilt?: number;
  delay?: number;
}) {
  return (
    <div className="pp-anim pp-sticky" style={s(tilt, delay)}>
      {children}
    </div>
  );
}

/** Hand-drawn checkmark (SVG path draw). */
export function HandCheck({ delay = 0 }: { delay?: number }) {
  return (
    <svg className="pp-anim pp-check" viewBox="0 0 26 22" style={s(0, delay)} aria-hidden="true">
      <path d="M3 12 L10 19 L23 3" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Red-pen circle around a mistake (SVG ellipse draw). */
export function PenCircle({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <span className="pp-circled">
      {children}
      <svg className="pp-anim pp-circle" viewBox="0 0 120 44" preserveAspectRatio="none" style={s(0, delay)} aria-hidden="true">
        <ellipse cx="60" cy="22" rx="55" ry="17" fill="none" strokeWidth="2.5" />
      </svg>
    </span>
  );
}

/** Paperclip, top-left of a sheet. */
export function Paperclip() {
  return (
    <svg className="pp-clip" viewBox="0 0 28 64" aria-hidden="true">
      <path
        d="M9 14 v34 a5.5 5.5 0 0 0 11 0 V12 a9 9 0 0 0 -18 0 v38"
        fill="none"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Coffee-ring stain. */
export function CoffeeRing({ style }: { style?: CSSProperties }) {
  return <span className="pp-coffee" style={style} aria-hidden="true" />;
}

/** Notary-style round seal. */
export function Seal({ children, tone = 'green', delay = 0, tilt = -8 }: { children: ReactNode; tone?: Tone; delay?: number; tilt?: number }) {
  return (
    <span className={`pp-anim pp-seal pp-seal-${tone}`} style={s(tilt, delay)}>
      {children}
    </span>
  );
}
