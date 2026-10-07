import type { ReactNode } from 'react';
import type { Issue, ItemType } from '../domain/types';

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  min?: number;
  className?: string;
}

/** Celda numérica editable; vaciar el campo equivale a 0. */
export function NumberInput({ value, onChange, label, min = 0, className }: NumberInputProps) {
  return (
    <input
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

export function Section({
  title,
  subtitle,
  actions,
  keepTogether,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Al imprimir, evita partir la sección entre dos páginas (para secciones cortas). */
  keepTogether?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={keepTogether ? 'section section-keep' : 'section'}>
      <header className="section-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="section-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="section-actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

const SEVERITY_LABEL: Record<Issue['severity'], string> = {
  error: 'Error',
  warning: 'Atención',
  info: 'Nota',
};

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
      {issues.map((i, k) => (
        <li key={k} className={`issue issue-${i.severity}`}>
          <strong>{labels?.[i.severity] ?? SEVERITY_LABEL[i.severity]}:</strong> {i.message}
        </li>
      ))}
    </ul>
  );
}

export const TYPE_LABEL: Record<ItemType, string> = {
  compra: 'Compra',
  fabricacion: 'Fabricación',
};

export function TypeBadge({ type }: { type: ItemType }) {
  return <span className={`badge badge-${type}`}>{TYPE_LABEL[type]}</span>;
}

export const weekNumbers = (horizon: number) => Array.from({ length: horizon }, (_, t) => t + 1);

export const fmt = (n: number) =>
  Number.isInteger(n) ? n.toLocaleString('es-AR') : n.toLocaleString('es-AR', { maximumFractionDigits: 1 });
