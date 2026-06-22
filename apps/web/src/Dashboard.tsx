import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Health, type Kpis, type PipelineState } from './api';
import { useAuth } from './auth';
import Sidebar from './components/Sidebar';
import KpiCards from './components/KpiCards';
import DocTable from './components/DocTable';
import PipelinePanel from './components/PipelinePanel';
import ReviewDrawer from './components/ReviewDrawer';

export default function Dashboard() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const freeze =
    params.get('screenshot') === '1' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [runs, setRuns] = useState<PipelineState[]>([]);
  const [reviewOpen, setReviewOpen] = useState<PipelineState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(params.get('nav') === '1');
  const [health, setHealth] = useState<Health | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const forceLoading = params.get('state') === 'loading';
  const forceError = params.get('state') === 'error';
  const realMode = health?.mode === 'real';

  function handleSignOut() {
    signOut();
    navigate('/');
  }

  useEffect(() => {
    if (forceLoading) return; // pin the loading skeleton for screenshots
    if (forceError) {
      setError('demo');
      return;
    }
    Promise.all([api.kpis(), api.documents(), api.review()])
      .then(([k, docs, review]) => {
        setKpis(k);
        setRuns(docs);
        if (params.get('review') === '1' && review[0]) setReviewOpen(review[0]);
      })
      .catch((e: Error) => setError(e.message));
    api.health().then(setHealth).catch(() => {});
  }, [params, forceLoading, forceError]);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const state = await api.upload(file);
      setRuns((prev) => [state, ...prev.filter((r) => r.doc.id !== state.doc.id)]);
      setReviewOpen(state); // surface the extracted fields immediately
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    if (freeze) document.body.classList.add('freeze');
  }, [freeze]);

  // Lock body scroll behind the mobile nav drawer.
  useEffect(() => {
    document.body.classList.toggle('nav-open', navOpen);
  }, [navOpen]);

  if (error) {
    return (
      <div className="state-screen">
        <div className="state-card" role="alert">
          <div className="state-icon error" aria-hidden="true">!</div>
          <h2>Dashboard data unavailable</h2>
          <p>
            We couldn’t reach the document-intelligence service just now. Your data is safe —
            this is a temporary connection issue.
          </p>
          <button className="btn" onClick={() => window.location.reload()}>
            Retry
          </button>
          <div className="state-foot">DocFlow AI · mock mode · deterministic fixture run #042</div>
        </div>
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className="app" aria-busy="true">
        <Sidebar
          inboxCount={0}
          reviewCount={0}
          active="dashboard"
          onNavigate={() => {}}
          loading
        />
        <main className="main">
          <div className="topbar">
            <div>
              <div className="skel skel-line" style={{ width: 240, height: 18 }} />
              <div className="skel skel-line" style={{ width: 320, marginTop: 8 }} />
            </div>
            <div className="top-actions">
              <div className="skel skel-btn" />
              <div className="skel skel-btn" />
            </div>
          </div>
          <section className="kpis">
            {[0, 1, 2, 3].map((i) => (
              <div className="kpi" key={i}>
                <div className="skel skel-line" style={{ width: '60%' }} />
                <div className="skel skel-line" style={{ width: '45%', height: 24, marginTop: 12 }} />
                <div className="skel skel-line" style={{ width: '70%', marginTop: 10 }} />
              </div>
            ))}
          </section>
          <div className="grid">
            <div className="panel skel-panel" />
            <div className="right-col">
              <div className="panel skel-panel" />
              <div className="panel skel-panel" />
            </div>
          </div>
          <div className="loading-status" aria-live="polite">
            <span className="spinner" aria-hidden="true" /> Loading pipeline results…
          </div>
        </main>
      </div>
    );
  }

  const reviewCount = runs.filter((r) => r.route?.decision === 'human-review').length;
  const totalCost = runs.reduce((a, r) => a + r.costUsd, 0);
  // The pipeline replay panel shows the discharge-summary run — it exercises the
  // full Judge → Repair path (2 cross-engine disagreements repaired).
  const pipelineRun = runs.find((r) => r.doc.id === 'Discharge_Summary_3') ?? runs[0];
  // The validated-output panel shows the freshest auto-routed document.
  const extractRun = runs.find((r) => r.doc.id === 'Referral_0482') ?? runs[0];

  return (
    <div className="app">
      <Sidebar
        inboxCount={runs.length}
        reviewCount={reviewCount}
        active="dashboard"
        open={navOpen}
        onNavigate={() => setNavOpen(false)}
        onClose={() => setNavOpen(false)}
      />
      {navOpen && <div className="nav-scrim" onClick={() => setNavOpen(false)} />}
      <main className="main">
        <div className="topbar">
          <div className="topbar-lead">
            <button
              className="nav-toggle"
              aria-label="Open navigation"
              aria-expanded={navOpen}
              onClick={() => setNavOpen((v) => !v)}
            >
              <span /><span /><span />
            </button>
            <div>
              <h1>Document Intelligence Dashboard</h1>
              <div className="sub">
                <span className="live-dot" />
                Meridian General — Provider Network · pipeline replay · Thursday, 11 Jun
              </div>
            </div>
          </div>
          <div className="top-actions">
            <button
              className="btn ghost"
              disabled
              title="Report export is not enabled in this demo build"
            >
              ⇣ Export report
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.heic,.pdf,image/*,application/pdf"
              style={{ display: 'none' }}
              onChange={onPickFile}
            />
            <button
              className="btn"
              disabled={!realMode || uploading}
              title={
                realMode
                  ? 'Upload a document for live extraction'
                  : 'Document upload runs only in real mode (set MOCK_MODE=false + OPENAI_API_KEY)'
              }
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Extracting…
                </>
              ) : (
                '+ Upload documents'
              )}
            </button>
            <div className="top-user">
              <span className="top-user-name" title={user?.email}>
                {user?.name ?? 'Demo Reviewer'}
              </span>
              <button className="btn ghost" onClick={handleSignOut} title="End the demo session">
                Sign out
              </button>
            </div>
          </div>
        </div>

        {uploadError && (
          <div className="upload-error" role="alert">
            <strong>Extraction failed.</strong> {uploadError}
            <button className="upload-error-x" aria-label="Dismiss" onClick={() => setUploadError(null)}>
              ×
            </button>
          </div>
        )}

        <KpiCards kpis={kpis} freeze={freeze} />

        <div className="grid">
          <DocTable runs={runs} onOpenReview={setReviewOpen} totalCost={totalCost} />
          <div className="right-col">
            {pipelineRun && <PipelinePanel run={pipelineRun} freeze={freeze} />}
            <div className="panel" style={{ flex: 1, minHeight: 0 }}>
              <div className="panel-head">
                <h3>Extracted Fields{extractRun ? ` — ${extractRun.doc.id}` : ''}</h3>
                <div className="hint">validated JSON · schema enforced</div>
              </div>
              {extractRun && extractRun.fields.length > 0 ? (
                <div className="extract">
                  {extractRun.fields.map((f) => (
                    <div className="kv" key={f.name}>
                      <span className="k">{f.name}</span>
                      <span className={`v${f.repaired ? ' repaired' : f.confidence >= 0.97 ? ' hl' : ''}`}>
                        "{f.value}"
                      </span>
                    </div>
                  ))}
                  <div className="kv">
                    <span className="k">pii_redacted</span>
                    <span className="v">{extractRun.piiRedactedTokens} tokens</span>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-glyph" aria-hidden="true">{ }</div>
                  <div className="empty-title">No extracted fields yet</div>
                  <div className="empty-sub">
                    Validated fields appear here once a document clears the extraction stage.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="page-foot">
          <span>deterministic fixture run #042</span>
          <span>engines: layout (mock) + vision (mock) · merge &amp; gate logic real, unit-tested</span>
          <span>confidence gate ≥ 0.90 auto-routes · KPIs computed from 30d corpus fixture</span>
        </div>
      </main>

      {reviewOpen && <ReviewDrawer run={reviewOpen} onClose={() => setReviewOpen(null)} />}
    </div>
  );
}
