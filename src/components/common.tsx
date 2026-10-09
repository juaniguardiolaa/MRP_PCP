import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
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

/**
 * Campo para importes y porcentajes: acepta coma o punto decimal. Mientras se escribe se
 * conserva el texto tal cual; vacío equivale a 0.
 */
export function DecimalInput({
  value,
  onChange,
  label,
  className,
  id,
}: {
  value: number | undefined;
  onChange: (value: number) => void;
  label: string;
  className?: string;
  id?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value ? String(value).replace('.', ',') : '');
  const invalid = draft !== null && draft.trim() !== '' && !Number.isFinite(Number(draft.replace(',', '.')));
  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={`num-input ${invalid ? 'invalid' : ''} ${className ?? ''}`}
      value={shown}
      placeholder="—"
      aria-label={label}
      aria-invalid={invalid}
      title={label}
      onFocus={(e) => {
        setDraft(shown);
        e.currentTarget.select();
      }}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        const raw = e.currentTarget.value;
        setDraft(raw);
        const n = raw.trim() === '' ? 0 : Number(raw.replace(',', '.'));
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

/** Número con hasta `digits` decimales. */
export const fmtDec = (n: number, digits = 2) => n.toLocaleString('es-AR', { maximumFractionDigits: digits });

/** Importe en pesos con dos decimales: $ 140,50. */
export const fmtMoney = (n: number) =>
  `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
