import { Link } from 'react-router-dom';

/** Shared footer for the public marketing + auth pages. */
export default function MarketingFooter() {
  return (
    <footer className="mkt-footer">
      <div className="mkt-footer-inner">
        <div className="mkt-footer-brand">
          <div className="mkt-brand">
            <span className="mkt-logo-mark" aria-hidden="true">D</span>
            <span className="mkt-brand-text">
              DocFlow <span className="mkt-brand-ai">AI</span>
            </span>
          </div>
          <p>
            Document intelligence for healthcare operations — OCR, classification,
            confidence-gated routing, and a human-review queue.
          </p>
          <p className="mkt-footer-demo">
            Portfolio demo. Runs key-free on synthetic data — no real PHI, no real
            authentication, nothing is sent anywhere.
          </p>
        </div>

        <nav className="mkt-footer-col" aria-label="Product">
          <h4>Product</h4>
          <a href="/#features">Features</a>
          <a href="/#how">How it works</a>
          <Link to="/signin">Sign in</Link>
          <Link to="/signup">Get started</Link>
        </nav>

        <nav className="mkt-footer-col" aria-label="Company">
          <h4>Company</h4>
          <Link to="/contact">Contact</Link>
          <Link to="/contact">Be a part</Link>
        </nav>
      </div>
      <div className="mkt-footer-base">
        <span>© {new Date().getFullYear()} DocFlow AI · portfolio demo</span>
        <span>Built with React · Vite · Express · synthetic fixtures</span>
      </div>
    </footer>
  );
}
