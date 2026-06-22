import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

/** Top navigation bar shared by the public marketing + auth pages. */
export default function MarketingNav() {
  const [open, setOpen] = useState(false);
  const { signedIn } = useAuth();
  const navigate = useNavigate();

  // Close the mobile menu on resize back to desktop.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 760px)');
    const handler = () => mq.matches && setOpen(false);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <header className="mkt-nav">
      <div className="mkt-nav-inner">
        <Link to="/" className="mkt-brand" onClick={() => setOpen(false)}>
          <span className="mkt-logo-mark" aria-hidden="true">D</span>
          <span className="mkt-brand-text">
            DocFlow <span className="mkt-brand-ai">AI</span>
          </span>
        </Link>

        <button
          className="mkt-nav-toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span /><span /><span />
        </button>

        <nav className={`mkt-nav-links${open ? ' open' : ''}`} aria-label="Primary">
          <a href="/#features" onClick={() => setOpen(false)}>Features</a>
          <a href="/#how" onClick={() => setOpen(false)}>How it works</a>
          <NavLink to="/contact" onClick={() => setOpen(false)}>Contact</NavLink>
          <NavLink to="/demo" className="mkt-nav-demo" onClick={() => setOpen(false)}>
            ▶ Try the demo
          </NavLink>
          {signedIn ? (
            <button className="btn" onClick={() => { setOpen(false); navigate('/dashboard'); }}>
              Open dashboard
            </button>
          ) : (
            <>
              <NavLink to="/signin" className="mkt-link-cta" onClick={() => setOpen(false)}>
                Sign in
              </NavLink>
              <button className="btn" onClick={() => { setOpen(false); navigate('/signup'); }}>
                Get started
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
