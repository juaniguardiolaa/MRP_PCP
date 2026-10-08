import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Tone } from './Chips';

export function KpiTile({
  label,
  value,
  detail,
  tone = 'neutral',
  linkLabel,
  onOpen,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: Tone;
  linkLabel: string;
  onOpen: () => void;
}) {
  return (
    <button type="button" className={`kpi kpi-${tone}`} onClick={onOpen}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {detail && <span className="kpi-detail">{detail}</span>}
      <span className="kpi-link">
        {linkLabel} <ArrowRight size={14} aria-hidden />
      </span>
    </button>
  );
}
