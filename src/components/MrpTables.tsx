import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { describeLotPolicy } from '../domain/lotSizing';
import { orderSummaryByItem, requirementsSummary } from '../domain/reports';
import type { MrpRecord, MrpResult } from '../domain/types';
import type { GlossaryId } from '../help/glossary';
import type { ViewId } from '../navigation';
import { fmt, weekNumbers } from './common';
import { PageHeader } from './shell/PageHeader';
import { ItemCode, StatusChip, TypeChip } from './ui/Chips';
import { ItemList } from './ui/ItemList';
import { Panel } from './ui/Panel';
import { SegmentedControl } from './ui/SegmentedControl';
import { Term } from './ui/Term';

type RowKey = 'nb' | 'rp' | 'd' | 'nn' | 'rop' | 'eop';

const ROWS: { key: RowKey; term: GlossaryId; name: string }[] = [
  { key: 'nb', term: 'NB', name: 'Necesidades brutas' },
  { key: 'rp', term: 'RP', name: 'Recepciones programadas' },
  { key: 'd', term: 'D', name: 'Inventario proyectado' },
  { key: 'nn', term: 'NN', name: 'Necesidades netas' },
  { key: 'rop', term: 'ROP', name: 'Recepción planificada' },
  { key: 'eop', term: 'EOP', name: 'Emisión de órdenes' },
];

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Registro MRP de un ítem con la notación de la cátedra. */
export function MrpTable({ record, horizon, showHeader }: { record: MrpRecord; horizon: number; showHeader?: boolean }) {
  const weeks = weekNumbers(horizon);
  const first = (key: RowKey) => {
    if (key === 'd') return fmt(record.initialStock);
    if (key === 'eop' && record.pastDueRelease > 0) return fmt(record.pastDueRelease);
    return '';
  };
  return (
    <div className="mrp-record">
      {showHeader && (
        <div className="mrp-record-head">
          <h3>
            <ItemCode code={record.code} /> {record.description}
          </h3>
          <div className="chip-row">
            <TypeChip type={record.type} />
            <StatusChip>Nivel {record.level}</StatusChip>
            <StatusChip>Stock inicial {fmt(record.initialStock)}</StatusChip>
            <StatusChip>LT {record.leadTime} sem.</StatusChip>
            {record.safetyStock > 0 && <StatusChip>SS {fmt(record.safetyStock)}</StatusChip>}
            <StatusChip>{describeLotPolicy(record.lotPolicy)}</StatusChip>
          </div>
        </div>
      )}
      <div className="table-scroll">
        <table className="data-table mrp-table">
          <caption className="sr-only">Registro MRP de {record.code}</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky-col">
                Concepto
              </th>
              <th scope="col" className="num col-s0" title="Stock inicial (fila D) y órdenes atrasadas (fila EOP)">
                S0
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
            {ROWS.map(({ key, term, name }) => (
              <tr key={key} className={`row-${key}`}>
                <th scope="row" className="sticky-col row-head">
                  <Term id={term} />
                  <span className="row-name">{name}</span>
                </th>
                <td className={key === 'eop' && record.pastDueRelease > 0 ? 'num hl-late' : 'num col-s0'}>{first(key)}</td>
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

export function MrpLegend() {
  return (
    <p className="legend">
      <span className="legend-swatch hl-nn" /> Necesidad neta
      <span className="legend-swatch hl-rop" /> Recepción planificada
      <span className="legend-swatch hl-eop" /> Emisión de orden
      <span className="legend-swatch hl-late" /> Orden atrasada
    </p>
  );
}

export function RequirementsSummaryTable({ result }: { result: MrpResult }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Ítem</th>
            <th scope="col" className="num">
              Nivel
            </th>
            <th scope="col">Tipo</th>
            <th scope="col" className="num">
              Nec. brutas
            </th>
            <th scope="col" className="num">
              Recep. programadas
            </th>
            <th scope="col" className="num">
              Nec. netas
            </th>
            <th scope="col" className="num">
              Órdenes planificadas
            </th>
            <th scope="col" className="num">
              Inventario final
            </th>
            <th scope="col" className="num">
              Inventario promedio
            </th>
          </tr>
        </thead>
        <tbody>
          {requirementsSummary(result).map((s) => (
            <tr key={s.itemCode}>
              <th scope="row">
                <ItemCode code={s.itemCode} />
              </th>
              <td className="num">{s.level}</td>
              <td>
                <TypeChip type={s.type} />
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

export function MrpTables({
  result,
  selected,
  onSelect,
  onNavigate,
}: {
  result: MrpResult;
  selected: string | null;
  onSelect: (code: string) => void;
  onNavigate: (view: ViewId, item?: string) => void;
}) {
  const [mode, setMode] = useState<'uno' | 'todos'>('uno');
  const records = result.records;
  const index = Math.max(0, records.findIndex((r) => r.code === selected));
  const record = records[index];
  const summaries = new Map(orderSummaryByItem(result).map((s) => [s.itemCode, s]));

  const facts = record && [
    { label: 'Stock inicial', value: `${fmt(record.initialStock)} u.` },
    { label: 'Lead time', value: `${record.leadTime} sem.`, term: 'LT' as GlossaryId },
    { label: 'Política de loteo', value: describeLotPolicy(record.lotPolicy) },
    { label: 'Stock de seguridad', value: `${fmt(record.safetyStock)} u.`, term: 'SS' as GlossaryId },
    { label: 'Necesidades brutas', value: `${fmt(sum(record.nb))} u.` },
    { label: 'Total a pedir', value: `${fmt(sum(record.rop))} u.` },
  ];

  return (
    <>
      <PageHeader
        view="explosion"
        actions={
          <SegmentedControl<'uno' | 'todos'>
            label="Vista"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'uno', label: 'Por ítem' },
              { value: 'todos', label: 'Todos los ítems' },
            ]}
          />
        }
      />

      {mode === 'uno' && record ? (
        <div className="master-detail">
          <ItemList
            label="Ítems por nivel"
            selected={record.code}
            onSelect={onSelect}
            entries={records.map((r) => ({
              code: r.code,
              title: r.description || `Ítem ${r.code}`,
              group: r.level === 0 ? 'Nivel 0 · productos finales' : `Nivel ${r.level}`,
              meta: `${summaries.get(r.code)?.orderCount ?? 0} órdenes · ${describeLotPolicy(r.lotPolicy)}`,
              alert: r.pastDueRelease > 0,
            }))}
          />
          <div className="sheet">
            <section className="sheet-header">
              <div className="sheet-title">
                <ItemCode code={record.code} large />
                <div>
                  <h2>{record.description}</h2>
                  <div className="chip-row">
                    <TypeChip type={record.type} />
                    <StatusChip>Nivel {record.level}</StatusChip>
                    {record.pastDueRelease > 0 && <StatusChip tone="critical">Orden atrasada</StatusChip>}
                  </div>
                </div>
              </div>
              <div className="sheet-nav">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={index === 0}
                  onClick={() => onSelect(records[index - 1].code)}
                >
                  <ChevronLeft size={16} aria-hidden /> Anterior
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={index === records.length - 1}
                  onClick={() => onSelect(records[index + 1].code)}
                >
                  Siguiente <ChevronRight size={16} aria-hidden />
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate('items', record.code)}>
                  Editar ficha
                </button>
              </div>
            </section>

            <dl className="fact-row">
              {facts!.map((f) => (
                <div key={f.label} className="fact">
                  <dt>
                    {f.label}
                    {f.term && (
                      <>
                        {' '}
                        <Term id={f.term} />
                      </>
                    )}
                  </dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>

            <Panel title="Registro MRP" actions={<MrpLegend />} flush>
              <MrpTable record={record} horizon={result.horizon} />
            </Panel>
          </div>
        </div>
      ) : (
        <Panel title="Registro MRP de todos los ítems" subtitle="En orden de nivel, como los calcula el sistema." actions={<MrpLegend />}>
          <div className="mrp-stack">
            {records.map((r) => (
              <MrpTable key={r.code} record={r} horizon={result.horizon} showHeader />
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Resumen de requerimientos brutos y netos" subtitle="Totales del horizonte por ítem." flush keepTogether>
        <RequirementsSummaryTable result={result} />
      </Panel>
    </>
  );
}
