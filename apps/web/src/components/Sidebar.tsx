interface Props {
  inboxCount: number;
  reviewCount: number;
  active: string;
  open?: boolean;
  loading?: boolean;
  onNavigate: (id: string) => void;
  onClose?: () => void;
}

interface NavDef {
  id: string;
  label: string;
  glyph: string;
  section?: string;
  badge?: number;
  badgeClass?: string;
}

export default function Sidebar({
  inboxCount,
  reviewCount,
  active,
  open = false,
  loading = false,
  onNavigate,
  onClose,
}: Props) {
  const items: NavDef[] = [
    { id: 'dashboard', label: 'Dashboard', glyph: '⌂' },
    { id: 'inbox', label: 'Smart Inbox', glyph: '✉', badge: inboxCount },
    { id: 'documents', label: 'Documents', glyph: '⎙' },
    { id: 'classifications', label: 'AI Classifications', glyph: '◈', section: 'Intelligence' },
    {
      id: 'review',
      label: 'Human Review',
      glyph: '✓',
      badge: reviewCount > 0 ? reviewCount : undefined,
      badgeClass: 'amber',
    },
    { id: 'routing', label: 'Routing Rules', glyph: '↗' },
    { id: 'health', label: 'Pipeline Health', glyph: '∿', section: 'System' },
    { id: 'costs', label: 'Token Costs', glyph: '$' },
    { id: 'audit', label: 'Audit Trail', glyph: '⊟' },
  ];

  return (
    <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Primary navigation">
      <div className="logo">
        <div className="logo-mark">D</div>
        <div>
          <div className="logo-name">DocFlow AI</div>
          <div className="logo-env">document intelligence</div>
        </div>
        {onClose && (
          <button className="nav-close" aria-label="Close navigation" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      <nav className="nav">
        {items.map((item) => {
          const isActive = item.id === active;
          // Only the active view is wired in this build; the rest are honestly
          // disabled rather than pretending to navigate.
          const disabled = !isActive;
          return (
            <span key={item.id}>
              {item.section && <div className="nav-section">{item.section}</div>}
              <button
                type="button"
                className={`nav-item${isActive ? ' active' : ''}${disabled ? ' disabled' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                aria-disabled={disabled || undefined}
                disabled={disabled || loading}
                title={disabled ? 'Available in the full platform' : undefined}
                onClick={() => !disabled && onNavigate(item.id)}
              >
                <span className="glyph" aria-hidden="true">{item.glyph}</span>
                {item.label}
                {item.badge !== undefined && (
                  <span className={`nav-badge${item.badgeClass ? ` ${item.badgeClass}` : ''}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            </span>
          );
        })}
      </nav>

      <div className="sidebar-full-hint">
        Greyed items are available in the full platform.
      </div>

      <div className="sidebar-foot">
        <div><span className="ok">●</span> mock engines · zero keys</div>
        <div>deterministic fixture run #042</div>
      </div>
    </aside>
  );
}
