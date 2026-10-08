import type { WeekRange } from '../../domain/reports';
import { NumberInput, fmt, weekNumbers } from '../common';

export interface WeekRow {
  id: string;
  label: string;
  values: number[];
  /** Sin onChange la fila es de solo lectura. */
  onChange?: (week: number, value: number) => void;
  /** Clase extra por celda (semana 1-based), p. ej. para marcar pronósticos. */
  cellClass?: (week: number) => string | undefined;
  /** Texto de ayuda por celda (semana 1-based). */
  cellTitle?: (week: number) => string | undefined;
}

/** Grilla semanal S1..SH con una o más filas editables y total por fila. */
export function WeekGrid({
  rows,
  horizon,
  caption,
  marked,
  forecastFrom,
}: {
  rows: WeekRow[];
  horizon: number;
  caption: string;
  /** Semanas a resaltar (p. ej. sin demanda cargada). */
  marked?: WeekRange | null;
  /** Primera semana pronosticada: su encabezado y los siguientes se marcan con "P". */
  forecastFrom?: number | null;
}) {
  const weeks = weekNumbers(horizon);
  const isMarked = (w: number) => !!marked && w >= marked.from && w <= marked.to;
  const isForecast = (w: number) => forecastFrom != null && w >= forecastFrom;
  const headClass = (w: number) => ['num', isMarked(w) && 'col-empty', isForecast(w) && 'col-forecast'].filter(Boolean).join(' ');
  return (
    <div className="table-scroll">
      <table className="data-table week-grid">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky-col">
              Concepto
            </th>
            {weeks.map((w) => (
              <th key={w} scope="col" className={headClass(w)} title={isForecast(w) ? 'Semana pronosticada' : undefined}>
                S{w}
                {isForecast(w) && <span className="forecast-tag">P</span>}
              </th>
            ))}
            <th scope="col" className="num">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <th scope="row" className="sticky-col row-head">
                {r.label}
              </th>
              {weeks.map((w) => (
                <td
                  key={w}
                  className={[r.onChange ? 'cell-input' : 'num', isMarked(w) && 'col-empty', r.cellClass?.(w)]
                    .filter(Boolean)
                    .join(' ')}
                  title={r.cellTitle?.(w)}
                >
                  {r.onChange ? (
                    <NumberInput
                      label={`${r.label}, semana ${w}`}
                      value={r.values[w - 1] ?? 0}
                      onChange={(v) => r.onChange!(w - 1, v)}
                    />
                  ) : (
                    fmt(r.values[w - 1] ?? 0)
                  )}
                </td>
              ))}
              <td className="num total">{fmt(r.values.slice(0, horizon).reduce((a, b) => a + b, 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
