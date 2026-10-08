import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import type { Issue, ItemType } from '../domain/types';

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  min?: number;
  className?: string;
  id?: string;
}

/** Celda numérica editable; vaciar el campo equivale a 0. */
export function NumberInput({ value, onChange, label, min = 0, className, id }: NumberInputProps) {
  return (
    <input
      id={id}
      type="number"
      className={`num-input ${className ?? ''}`}
      inputMode="numeric"
      min={min}
      step={1}
      value={Number.isFinite(value) ? value : 0}
      aria-label={label}
      title={label}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const raw = e.currentTarget.value;
        const n = raw === '' ? 0 : Number(raw);
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

const SEVERITY_LABEL: Record<Issue['severity'], string> = {
  error: 'Error',
  warning: 'Atención',
  info: 'Nota',
};

const SEVERITY_ICON = { error: TriangleAlert, warning: CircleAlert, info: Info };

export function IssueList({
  issues,
  empty,
  labels,
}: {
  issues: Issue[];
  empty?: string;
  labels?: Partial<Record<Issue['severity'], string>>;
}) {
  if (!issues.length) return empty ? <p className="muted">{empty}</p> : null;
  return (
    <ul className="issue-list">
      {issues.map((i, k) => {
        const Icon = SEVERITY_ICON[i.severity];
        return (
          <li key={k} className={`issue issue-${i.severity}`}>
            <Icon size={16} aria-hidden className="issue-icon" />
            <span>
              <strong>{labels?.[i.severity] ?? SEVERITY_LABEL[i.severity]}:</strong> {i.message}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export const TYPE_LABEL: Record<ItemType, string> = {
  compra: 'Compra',
  fabricacion: 'Fabricación',
};

export const weekNumbers = (horizon: number) => Array.from({ length: horizon }, (_, t) => t + 1);

export const fmt = (n: number) =>
  Number.isInteger(n) ? n.toLocaleString('es-AR') : n.toLocaleString('es-AR', { maximumFractionDigits: 1 });
