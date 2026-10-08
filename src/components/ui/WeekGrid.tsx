import { NumberInput, fmt, weekNumbers } from '../common';

export interface WeekRow {
  id: string;
  label: string;
  values: number[];
  /** Sin onChange la fila es de solo lectura. */
  onChange?: (week: number, value: number) => void;
}

/** Grilla semanal S1..SH con una o más filas editables y total por fila. */
export function WeekGrid({ rows, horizon, caption }: { rows: WeekRow[]; horizon: number; caption: string }) {
  const weeks = weekNumbers(horizon);
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
              <th key={w} scope="col" className="num">
                S{w}
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
                <td key={w} className={r.onChange ? 'cell-input' : 'num'}>
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
