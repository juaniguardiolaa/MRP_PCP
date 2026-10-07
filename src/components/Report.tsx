import { endItems, resolveItemType, usableBomLines } from '../domain/bom';
import { describeLotPolicy } from '../domain/lotSizing';
import type { MrpResult, Scenario } from '../domain/types';
import { IS_ARTIFACT } from '../env';
import { Analysis } from './Analysis';
import { IssueList, Section, TYPE_LABEL, fmt, weekNumbers } from './common';
import { MrpLegend, MrpTable, RequirementsSummaryTable } from './MrpTables';
import { OrderPlan } from './OrderPlan';
import { ProductStructure } from './ProductStructure';
import { Purchases } from './Purchases';

function InputSummary({ scenario }: { scenario: Scenario }) {
  const bom = usableBomLines(scenario.items, scenario.bom);
  const weeks = weekNumbers(scenario.horizon);
  const receipts = (series: number[]) =>
    series
      .slice(0, scenario.horizon)
      .map((q, t) => (q ? `${fmt(q)} u. en S${t + 1}` : null))
      .filter(Boolean)
      .join('; ') || 'Ninguna';

  return (
    <Section title="Datos de entrada" subtitle={`Horizonte de planificación: ${scenario.horizon} semanas.`}>
      <h3>Plan Maestro de Producción (necesidades brutas)</h3>
      <div className="table-scroll">
        <table className="grid-table">
          <thead>
            <tr>
              <th>Producto</th>
              {weeks.map((w) => (
                <th key={w}>S{w}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {endItems(scenario.items, bom).map((p) => (
              <tr key={p.code}>
                <th className="row-head">{p.code}</th>
                {weeks.map((w) => (
                  <td key={w} className="num">
                    {fmt(p.demand[w - 1] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Inventario, lead times y políticas de loteo</h3>
      <div className="table-scroll">
        <table className="grid-table">
          <thead>
            <tr>
              <th>Ítem</th>
              <th>Tipo</th>
              <th>Stock inicial</th>
              <th>Entregas programadas</th>
              <th>Lead time</th>
              <th>Stock seg.</th>
              <th>Política de loteo</th>
            </tr>
          </thead>
          <tbody>
            {scenario.items.map((i) => (
              <tr key={i.code}>
                <th className="row-head">{i.code}</th>
                <td>{TYPE_LABEL[resolveItemType(i, bom)]}</td>
                <td className="num">{fmt(i.initialStock)}</td>
                <td>{receipts(i.scheduledReceipts)}</td>
                <td className="num">{i.leadTime} sem.</td>
                <td className="num">{fmt(i.safetyStock)}</td>
                <td>{describeLotPolicy(i.lotPolicy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Lista de materiales</h3>
      <ul className="bom-list">
        {scenario.items
          .filter((i) => bom.some((l) => l.parent === i.code))
          .map((i) => (
            <li key={i.code}>
              <strong>{i.code}</strong> →{' '}
              {bom
                .filter((l) => l.parent === i.code)
                .map((l) => `${l.child} (${l.quantity})`)
                .join(', ')}
            </li>
          ))}
      </ul>
    </Section>
  );
}

export function Report({ scenario, result }: { scenario: Scenario; result: MrpResult }) {
  const today = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return (
    <article className="report">
      <header className="report-cover">
        <p className="report-kicker">Planificación y Control de la Producción · Ingeniería Industrial</p>
        <h1>Informe MRP I – {scenario.name}</h1>
        <p className="muted">
          Generado el {today} · Horizonte de {scenario.horizon} semanas · {result.records.length} ítems ·{' '}
          {result.orders.length} órdenes planificadas
        </p>
      </header>

      {IS_ARTIFACT && (
        <p className="note no-print">
          Para guardar este informe en PDF, abrí la app en tu computadora (<code>npm run dev</code>) o en GitHub
          Pages y usá el botón “Imprimir / PDF”. El visor de claude.ai no permite imprimir.
        </p>
      )}

      {result.issues.length > 0 && (
        <Section title="Observaciones sobre los datos">
          <IssueList issues={result.issues} />
        </Section>
      )}

      <div className="report-part">
        <InputSummary scenario={scenario} />
      </div>
      <div className="report-part">
        <ProductStructure scenario={scenario} result={result} />
      </div>
      <div className="report-part">
        <Section title="Explosión de necesidades (tablas MRP)">
          <MrpLegend />
          <div className="mrp-list">
            {result.records.map((r) => (
              <MrpTable key={r.code} record={r} horizon={result.horizon} />
            ))}
          </div>
        </Section>
        <Section title="Reporte de requerimientos brutos y netos" keepTogether>
          <RequirementsSummaryTable result={result} />
        </Section>
      </div>
      <div className="report-part">
        <OrderPlan result={result} />
      </div>
      <div className="report-part">
        <Purchases result={result} />
      </div>
      <div className="report-part">
        <Analysis scenario={scenario} result={result} />
      </div>
    </article>
  );
}
