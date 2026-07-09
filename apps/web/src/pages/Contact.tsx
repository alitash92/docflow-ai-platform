import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MarketingNav from '../components/MarketingNav';
import MarketingFooter from '../components/MarketingFooter';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Fields {
  name: string;
  email: string;
  message: string;
}

export default function Contact() {
  useEffect(() => {
    document.title = 'Contact — DocFlow AI';
    return () => { document.title = 'DocFlow AI — AI document extraction for healthcare ops'; };
  }, []);

  const [f, setF] = useState<Fields>({ name: '', email: '', message: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  function set<K extends keyof Fields>(k: K, v: string) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  function validate() {
    const next: Partial<Record<keyof Fields, string>> = {};
    if (!f.name.trim()) next.name = 'Tell us your name.';
    if (!f.email.trim()) next.email = 'Enter your email.';
    else if (!EMAIL_RE.test(f.email.trim())) next.email = 'That doesn’t look like a valid email.';
    if (!f.message.trim()) next.message = 'Add a short message.';
    else if (f.message.trim().length < 10) next.message = 'A little more detail, please.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setDone(true);
    }, 550);
  }

  return (
    <div className="mkt paper-grain">
      <MarketingNav />
      <main id="main" className="mkt-contact">
        <div className="mkt-container mkt-contact-grid">
          <div className="mkt-contact-intro">
            <span className="mkt-eyebrow">Get in touch</span>
            <h1>Get in touch</h1>
            <p>
              Want to talk about document intelligence for your team, kick the tyres on the
              pipeline, or be part of what comes next? Drop a note and let’s talk.
            </p>
            <ul className="mkt-contact-points">
              <li>Walkthrough of the OCR + routing pipeline</li>
              <li>How the confidence gate and review queue work in practice</li>
              <li>Bringing real-mode extraction (vision LLM) to your documents</li>
            </ul>
            <p className="mkt-contact-foot">
              Prefer the product first?{' '}
              <Link to="/signup">Start the demo</Link> or <Link to="/signin">sign in</Link>.
            </p>
          </div>

          <div className="mkt-auth-card mkt-contact-card">
            {done ? (
              <div className="mkt-auth-success">
                <div className="mkt-success-icon" aria-hidden="true">✓</div>
                <h2>Message received — thank you</h2>
                <p className="mkt-auth-sub">
                  Thanks, {f.name.split(' ')[0] || 'there'}. This contact form is part of a
                  portfolio demo, so your message wasn’t actually sent anywhere — but in a real
                  deployment we’d be in touch at {f.email}.
                </p>
                <button
                  className="btn ghost btn-block"
                  onClick={() => {
                    setF({ name: '', email: '', message: '' });
                    setDone(false);
                  }}
                >
                  Send another
                </button>
              </div>
            ) : (
              <>
                <h2>Send a message</h2>
                <p className="mkt-demo-badge">
                  <span className="mkt-demo-dot" aria-hidden="true" />
                  Showcase form · messages aren’t delivered.
                </p>
                <form noValidate onSubmit={onSubmit}>
                  <label className="mkt-field">
                    <span>Name</span>
                    <input
                      type="text"
                      autoComplete="name"
                      placeholder="Alex Rivera"
                      value={f.name}
                      aria-invalid={!!errors.name}
                      onChange={(e) => set('name', e.target.value)}
                    />
                    {errors.name && <span className="mkt-field-err">{errors.name}</span>}
                  </label>

                  <label className="mkt-field">
                    <span>Email</span>
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="you@clinic.org"
                      value={f.email}
                      aria-invalid={!!errors.email}
                      onChange={(e) => set('email', e.target.value)}
                    />
                    {errors.email && <span className="mkt-field-err">{errors.email}</span>}
                  </label>

                  <label className="mkt-field">
                    <span>Message</span>
                    <textarea
                      rows={4}
                      placeholder="What would you like to talk about?"
                      value={f.message}
                      aria-invalid={!!errors.message}
                      onChange={(e) => set('message', e.target.value)}
                    />
                    {errors.message && <span className="mkt-field-err">{errors.message}</span>}
                  </label>

                  <button className="btn btn-block" type="submit" disabled={busy}>
                    {busy ? (<><span className="spinner" aria-hidden="true" /> Sending…</>) : 'Send message'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
