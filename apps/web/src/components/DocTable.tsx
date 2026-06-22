import type { PipelineState } from '../api';

const FMT_CLASS: Record<string, { cls: string; label: string }> = {
  PDF: { cls: 'fmt-pdf', label: 'PDF' },
  'XLSX (OOXML)': { cls: 'fmt-xlsx', label: 'XLS' },
  'DOCX (OOXML)': { cls: 'fmt-any', label: 'DOC' },
  HEIC: { cls: 'fmt-heic', label: 'HEIC' },
  'TNEF (legacy Outlook)': { cls: 'fmt-tnef', label: 'TNEF' },
};

const CHIP_CLASS: Record<string, string> = {
  Referral: 'chip-rfi',
  'Insurance Claim': 'chip-invoice',
  'Prior Authorization': 'chip-change',
  'Discharge Summary': 'chip-contract',
  'Lab Report': 'chip-bid',
  'Patient Intake': 'chip-photo',
};

const SOURCE_LABEL: Record<string, string> = {
  email: 'via email',
  sms: 'via SMS/MMS',
  upload: 'via portal upload',
};

interface Props {
  runs: PipelineState[];
  onOpenReview: (run: PipelineState) => void;
  totalCost: number;
}

export default function DocTable({ runs, onOpenReview, totalCost }: Props) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Incoming Documents — AI Classified</h3>
        <div className="hint">dual-engine OCR · field-level merge · gate ≥ 0.90</div>
      </div>
      {runs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-glyph" aria-hidden="true">✉</div>
          <div className="empty-title">No documents in the queue</div>
          <div className="empty-sub">
            Incoming documents are classified and routed automatically. New items will appear
            here as they arrive.
          </div>
        </div>
      ) : (
      <table>
        <thead>
          <tr>
            <th>Document</th>
            <th>Classification</th>
            <th>Confidence</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run, i) => {
            const fmt = FMT_CLASS[run.format] ?? { cls: 'fmt-any', label: 'BIN' };
            const conf = run.judge?.overall ?? 0;
            const review = run.route?.decision === 'human-review';
            return (
              <tr
                key={run.doc.id}
                className={`doc-row rise${review ? ' clickable' : ''}`}
                style={{ animationDelay: `${140 + i * 110}ms` }}
                onClick={review ? () => onOpenReview(run) : undefined}
                onKeyDown={
                  review
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onOpenReview(run);
                        }
                      }
                    : undefined
                }
                tabIndex={review ? 0 : undefined}
                role={review ? 'button' : undefined}
                aria-label={review ? `Open ${run.doc.fileName} in review drawer` : undefined}
                title={review ? 'Open in review drawer' : undefined}
              >
                <td>
                  <div className="doc">
                    <div className={`doc-icon ${fmt.cls}`}>{fmt.label}</div>
                    <div>
                      <div className="doc-name">{run.doc.fileName}</div>
                      <div className="doc-meta">
                        {SOURCE_LABEL[run.doc.source]} · {run.doc.pages} page
                        {run.doc.pages === 1 ? '' : 's'} · {run.doc.receivedAgoMin} min ago
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`chip ${CHIP_CLASS[run.classification?.type ?? ''] ?? 'chip-rfi'}`}>
                    {run.classification?.type}
                  </span>
                </td>
                <td>
                  <div className="conf">
                    <div className="conf-bar">
                      <div
                        className={`conf-fill${conf < 0.9 ? ' mid' : ''}`}
                        style={{ width: `${conf * 100}%` }}
                      />
                    </div>
                    {conf.toFixed(2)}
                  </div>
                </td>
                <td>
                  {review ? (
                    <div className="status warn"><span className="dot" /> Human review</div>
                  ) : (
                    <div className="status ok"><span className="dot" /> Auto-routed → {run.route?.assignee}</div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      )}
      <div className="table-foot">
        <span>
          {runs.length} documents · {runs.filter((r) => r.route?.decision === 'auto-routed').length} auto-routed ·{' '}
          {runs.filter((r) => r.route?.decision === 'human-review').length} escalated
        </span>
        <span>run cost ${totalCost.toFixed(4)} — computed from token usage</span>
      </div>
    </div>
  );
}
