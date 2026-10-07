import { useState } from 'react';
import { describeLotPolicy } from '../domain/lotSizing';
import { requirementsSummary } from '../domain/reports';
import type { MrpRecord, MrpResult } from '../domain/types';
import { Section, TypeBadge, fmt, weekNumbers } from './common';

type RowKey = 'nb' | 'rp' | 'd' | 'nn' | 'rop' | 'eop';

const ROWS: { key: RowKey; abbr: string; name: string }[] = [
  { key: 'nb', abbr: 'NB', name: 'Necesidades brutas' },
  { key: 'rp', abbr: 'RP', name: 'Recepciones programadas' },
  { key: 'd', abbr: 'D', name: 'Inventario proyectado (disponible al cierre)' },
  { key: 'nn', abbr: 'NN', name: 'Necesidades netas' },
  { key: 'rop', abbr: 'ROP', name: 'Recepción de órdenes planificadas' },
  { key: 'eop', abbr: 'EOP', name: 'Emisión de órdenes planificadas' },
];

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function MrpTable({ record, horizon }: { record: MrpRecord; horizon: number }) {
  const weeks = weekNumbers(horizon);
  const first = (key: RowKey) => {
    if (key === 'd') return fmt(record.initialStock);
    if (key === 'eop' && record.pastDueRelease > 0) return fmt(record.pastDueRelease);
    return '';
  };
  return (
    <div className="mrp-table card">
      <div className="mrp-table-head">
        <h3>
          {record.code} <span className="muted">– {record.description}</span>
        </h3>
        <dl className="meta">
          <div>
            <dt>Nivel</dt>
            <dd>{record.level}</dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>
              <TypeBadge type={record.type} />
            </dd>
          </div>
          <div>
            <dt>Stock inicial</dt>
            <dd>{fmt(record.initialStock)}</dd>
          </div>
          <div>
            <dt>LT</dt>
            <dd>{record.leadTime} sem.</dd>
          </div>
          {record.safetyStock > 0 && (
            <div>
              <dt>SS</dt>
              <dd>{fmt(record.safetyStock)}</dd>
            </div>
          )}
          <div>
            <dt>Loteo</dt>
            <dd>{describeLotPolicy(record.lotPolicy)}</dd>
          </div>
        </dl>
      </div>
      <div className="table-scroll">
        <table className="grid-table mrp">
          <thead>
            <tr>
              <th className="sticky-col">{record.code}</th>
              <th title="Stock inicial (fila D) y órdenes que debieron emitirse antes de la semana 1 (fila EOP)">
                S0
              </th>
              {weeks.map((w) => (
                <th key={w}>S{w}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(({ key, abbr, name }) => (
              <tr key={key} className={`row-${key}`}>
                <th className="sticky-col row-head">
                  <abbr title={name}>{abbr}</abbr>
                </th>
                <td className={key === 'eop' && record.pastDueRelease > 0 ? 'num hl-late' : 'num cell-s0'}>
                  {first(key)}
                </td>
                {record[key].map((v, t) => (
                  <td key={t} className={`num ${v > 0 && key !== 'd' && key !== 'nb' ? `hl-${key}` : ''}`}>
                    {v === 0 && key !== 'd' ? '' : fmt(v)}
                  </td>
                ))}
                <td className="num total">
                  {key === 'd' ? '' : fmt(sum(record[key]) + (key === 'eop' ? record.pastDueRelease : 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RequirementsSummaryTable({ result }: { result: MrpResult }) {
  return (
    <div className="table-scroll">
      <table className="grid-table">
        <thead>
          <tr>
            <th>Ítem</th>
            <th>Nivel</th>
            <th>Tipo</th>
            <th>Nec. brutas</th>
            <th>Recep. programadas</th>
            <th>Nec. netas</th>
            <th>Órdenes planificadas</th>
            <th>Inventario final</th>
            <th>Inventario promedio</th>
          </tr>
        </thead>
        <tbody>
          {requirementsSummary(result).map((s) => (
            <tr key={s.itemCode}>
              <th className="row-head">{s.itemCode}</th>
              <td className="num">{s.level}</td>
              <td>
                <TypeBadge type={s.type} />
              </td>
              <td className="num">{fmt(s.grossTotal)}</td>
              <td className="num">{fmt(s.scheduledTotal)}</td>
              <td className="num">{fmt(s.netTotal)}</td>
              <td className="num">{fmt(s.plannedTotal)}</td>
              <td className="num">{fmt(s.endingInventory)}</td>
              <td className="num">{fmt(s.averageInventory)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MrpLegend() {
  return (
    <p className="legend small">
      <span className="legend-swatch hl-nn" /> Necesidad neta
      <span className="legend-swatch hl-rop" /> Recepción planificada
      <span className="legend-swatch hl-eop" /> Emisión de orden
      <span className="legend-swatch hl-late" /> Orden atrasada (debió emitirse en S0 o antes)
    </p>
  );
}

export function MrpTables({ result }: { result: MrpResult }) {
  const [filter, setFilter] = useState<string>('todos');
  const shown = result.records.filter((r) => filter === 'todos' || r.code === filter);
  return (
    <>
      <Section
        title="Explosión de necesidades (tablas MRP)"
        subtitle="Un registro por ítem, en orden de nivel. D es el inventario proyectado al cierre de cada semana; la columna S0 muestra el stock inicial y las órdenes atrasadas."
        actions={
          <label className="inline-field">
            Ver
            <select value={filter} onChange={(e) => setFilter(e.currentTarget.value)}>
              <option value="todos">Todos los ítems</option>
              {result.records.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code} – {r.description}
                </option>
              ))}
            </select>
          </label>
        }
      >
        <MrpLegend />
        <div className="mrp-list">
          {shown.map((r) => (
            <MrpTable key={r.code} record={r} horizon={result.horizon} />
          ))}
        </div>
      </Section>
      <Section
        title="Reporte de requerimientos brutos y netos"
        subtitle="Totales del horizonte por ítem."
        keepTogether
      >
        <RequirementsSummaryTable result={result} />
      </Section>
    </>
  );
}
