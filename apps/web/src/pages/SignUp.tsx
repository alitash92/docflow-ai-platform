import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MarketingNav from '../components/MarketingNav';
import MarketingFooter from '../components/MarketingFooter';
import { useAuth } from '../auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Fields {
  name: string;
  email: string;
  company: string;
  password: string;
}

export default function SignUp() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [f, setF] = useState<Fields>({ name: '', email: '', company: '', password: '' });
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
    if (!f.company.trim()) next.company = 'Enter your organization.';
    if (!f.password) next.password = 'Choose a password.';
    else if (f.password.length < 6) next.password = 'Use at least 6 characters.';
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

  if (done) {
    return (
      <div className="mkt paper-grain">
        <MarketingNav />
        <main id="main" className="mkt-auth">
          <div className="mkt-auth-card mkt-auth-success">
            <div className="mkt-success-icon" aria-hidden="true">✓</div>
            <h1>Thanks — request received</h1>
            <p className="mkt-auth-sub">
              Thanks, {f.name.split(' ')[0] || 'there'}. In a real deployment we’d set up your
              workspace and email {f.email}. This is a portfolio demo, so nothing was actually
              sent — but you can jump straight into the live dashboard.
            </p>
            <button
              className="btn btn-block"
              onClick={() => {
                signIn({ name: f.name, email: f.email });
                navigate('/dashboard');
              }}
            >
              Enter the demo dashboard →
            </button>
            <p className="mkt-auth-alt">
              <Link to="/">Back to home</Link>
            </p>
          </div>
        </main>
        <MarketingFooter />
      </div>
    );
  }

  return (
    <div className="mkt paper-grain">
      <MarketingNav />
      <main id="main" className="mkt-auth">
        <div className="mkt-auth-card">
          <h1>Create your account</h1>
          <p className="mkt-auth-sub">Start exploring DocFlow AI in minutes.</p>

          <p className="mkt-demo-badge">
            <span className="mkt-demo-dot" aria-hidden="true" />
            Demo environment — no account is really created and nothing is sent.
          </p>

          <form noValidate onSubmit={onSubmit}>
            <label className="mkt-field">
              <span>Full name</span>
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
              <span>Work email</span>
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
              <span>Organization</span>
              <input
                type="text"
                autoComplete="organization"
                placeholder="Meridian General"
                value={f.company}
                aria-invalid={!!errors.company}
                onChange={(e) => set('company', e.target.value)}
              />
              {errors.company && <span className="mkt-field-err">{errors.company}</span>}
            </label>

            <label className="mkt-field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="At least 6 characters"
                value={f.password}
                aria-invalid={!!errors.password}
                onChange={(e) => set('password', e.target.value)}
              />
              {errors.password && <span className="mkt-field-err">{errors.password}</span>}
            </label>

            <button className="btn btn-block" type="submit" disabled={busy}>
              {busy ? (<><span className="spinner" aria-hidden="true" /> Creating…</>) : 'Create account'}
            </button>
          </form>

          <p className="mkt-auth-alt">
            Already have an account? <Link to="/signin">Sign in</Link>
          </p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
