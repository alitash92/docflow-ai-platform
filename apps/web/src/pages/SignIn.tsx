import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MarketingNav from '../components/MarketingNav';
import MarketingFooter from '../components/MarketingFooter';
import { useAuth } from '../auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignIn() {
  useEffect(() => {
    document.title = 'Sign In — DocFlow AI';
    return () => { document.title = 'DocFlow AI — AI document extraction for healthcare ops'; };
  }, []);

  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);

  function validate() {
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = 'Enter your email.';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'That doesn’t look like a valid email.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function enterDemo(withForm: boolean) {
    if (withForm && !validate()) return;
    setBusy(true);
    // Showcase gateway — no backend call. Brief delay for a real loading state.
    setTimeout(() => {
      signIn(withForm ? { email: email.trim() } : undefined);
      navigate('/dashboard');
    }, 450);
  }

  return (
    <div className="mkt paper-grain">
      <MarketingNav />
      <main id="main" className="mkt-auth">
        <div className="mkt-auth-card">
          <h1>Welcome back</h1>
          <p className="mkt-auth-sub">Sign in to open the DocFlow AI dashboard.</p>

          <p className="mkt-demo-badge">
            <span className="mkt-demo-dot" aria-hidden="true" />
            Showcase environment · any credentials open the live demo.
          </p>

          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              enterDemo(true);
            }}
          >
            <label className="mkt-field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@clinic.org"
                value={email}
                aria-invalid={!!errors.email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {errors.email && <span className="mkt-field-err">{errors.email}</span>}
            </label>

            <label className="mkt-field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                aria-invalid={!!errors.password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {errors.password && <span className="mkt-field-err">{errors.password}</span>}
            </label>

            <button className="btn btn-block" type="submit" disabled={busy}>
              {busy ? (<><span className="spinner" aria-hidden="true" /> Signing in…</>) : 'Sign in'}
            </button>
          </form>

          <div className="mkt-auth-or"><span>or</span></div>

          <button className="btn ghost btn-block" onClick={() => enterDemo(false)} disabled={busy}>
            Try the demo →
          </button>

          <p className="mkt-auth-alt">
            New here? <Link to="/signup">Create an account</Link> · <Link to="/contact">Contact us</Link>
          </p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
