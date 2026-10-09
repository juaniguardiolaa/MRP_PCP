import { endItems, resolveItemType, usableBomLines } from '../domain/bom';
import type { ForecastPlan } from '../domain/forecast';
import { costsComplete } from '../domain/economicLot';
import { describeLotPolicy } from '../domain/lotSizing';
import type { MrpResult, Scenario } from '../domain/types';
import { IS_ARTIFACT } from '../env';
import { Conclusions, FirstOrdersTable, LeadTimeTable } from './Analysis';
import { IssueList, TYPE_LABEL, fmt, fmtDec, fmtMoney, weekNumbers } from './common';
import { ComparisonTable, CostsTable, useLotComparisons } from './LotSizing';
import { ForecastLegend, ForecastPanel, forecastCell } from './MpsEditor';
import { MrpLegend, MrpTable, RequirementsSummaryTable } from './MrpTables';
import { GanttLegend, OrderGantt, OrdersTable } from './OrderPlan';
import { LevelTable, TreeGallery, TreeLegend } from './ProductStructure';
import { PurchaseTotals } from './Purchases';
import { PageHeader } from './shell/PageHeader';
import { ItemCode } from './ui/Chips';
import { Panel } from './ui/Panel';

function InputSummary({ scenario, forecast }: { scenario: Scenario; forecast: ForecastPlan | null }) {
  const bom = usableBomLines(scenario.items, scenario.bom);
  const showCosts = scenario.items.some((i) => i.costs);
  const weeks = weekNumbers(scenario.horizon);
  const receipts = (series: number[]) =>
    series
      .slice(0, scenario.horizon)
      .map((q, t) => (q ? `${fmt(q)} u. en S${t + 1}` : null))
      .filter(Boolean)
      .join('; ') || 'Ninguna';

  return (
    <>
      <Panel
        title="Plan maestro de producción"
        subtitle={
          `Necesidades brutas por semana. Horizonte de ${scenario.horizon} semanas.` +
          (forecast ? ` S${forecast.from}–S${forecast.to} (P): pronóstico por regresión lineal.` : '')
        }
        flush
        keepTogether
      >
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Producto</th>
                {weeks.map((w) => (
                  <th key={w} scope="col" className={forecast && w >= forecast.from ? 'num col-forecast' : 'num'}>
                    S{w}
                    {forecast && w >= forecast.from && <span className="forecast-tag">P</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {endItems(scenario.items, bom).map((p) => {
                const cell = forecastCell(forecast, p.code);
                return (
                  <tr key={p.code}>
                    <th scope="row">
                      <ItemCode code={p.code} />
                    </th>
                    {weeks.map((w) => (
                      <td key={w} className={['num', cell.cellClass(w)].filter(Boolean).join(' ')}>
                        {fmt(p.demand[w - 1] ?? 0)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {forecast && (
        <Panel
          title="Pronóstico por regresión lineal"
          subtitle={`Recta ajustada a S1–S${forecast.base} de cada producto.`}
          actions={<ForecastLegend />}
          keepTogether
        >
          <ForecastPanel scenario={scenario} plan={forecast} />
        </Panel>
      )}

      <Panel title="Inventario, lead times y políticas de loteo" flush keepTogether>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Ítem</th>
                <th scope="col">Tipo</th>
                <th scope="col" className="num">
                  Stock inicial
                </th>
                <th scope="col">Entregas programadas</th>
                <th scope="col" className="num">
                  Lead time
                </th>
                <th scope="col" className="num">
                  Stock seg.
                </th>
                <th scope="col">Política de loteo</th>
                {showCosts && <th scope="col">Costos (C · S · i)</th>}
              </tr>
            </thead>
            <tbody>
              {scenario.items.map((i) => (
                <tr key={i.code}>
                  <th scope="row">
                    <ItemCode code={i.code} />
                  </th>
                  <td>{TYPE_LABEL[resolveItemType(i, bom)]}</td>
                  <td className="num">{fmt(i.initialStock)}</td>
                  <td>{receipts(i.scheduledReceipts)}</td>
                  <td className="num">{i.leadTime} sem.</td>
                  <td className="num">{fmt(i.safetyStock)}</td>
                  <td>{describeLotPolicy(i.lotPolicy)}</td>
                  {showCosts && (
                    <td className="nowrap">
                      {costsComplete(i.costs)
                        ? `${fmtMoney(i.costs.unitCost)} · ${fmtMoney(i.costs.orderCost)} · ${fmtDec(i.costs.holdingRate)} %`
                        : '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Lista de materiales" keepTogether>
        <ul className="bom-list">
          {scenario.items
            .filter((i) => bom.some((l) => l.parent === i.code))
            .map((i) => (
              <li key={i.code}>
                <ItemCode code={i.code} /> →{' '}
                {bom
                  .filter((l) => l.parent === i.code)
                  .map((l) => `${l.child} (${l.quantity})`)
                  .join(', ')}
              </li>
            ))}
        </ul>
      </Panel>
    </>
  );
}

export function Report({
  scenario,
  result,
  forecast,
}: {
  scenario: Scenario;
  result: MrpResult;
  forecast: ForecastPlan | null;
}) {
  const comparisons = useLotComparisons(scenario, result);
  const withCosts = result.records.some((r) => comparisons.get(r.code));
  const analysisNumber = withCosts ? 7 : 6;
  const today = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return (
    <>
      <div className="no-print">
        <PageHeader view="informe" />
        {IS_ARTIFACT && (
          <p className="callout">
            Para guardar este informe en PDF, abrí la app en tu computadora (<code>npm run dev</code>) o en GitHub Pages y
            usá “Imprimir / PDF”. El visor de claude.ai no permite imprimir.
          </p>
        )}
      </div>

      <article className="report">
        <header className="report-cover">
          <p className="eyebrow">Planificación y Control de la Producción · Ingeniería Industrial · UTN FRH</p>
          <h1>Informe MRP I · {scenario.name}</h1>
          <p className="muted">
            Generado el {today} · Horizonte de {scenario.horizon} semanas · {result.records.length} ítems · {result.orders.length}{' '}
            órdenes planificadas
          </p>
        </header>

        {result.issues.length > 0 && (
          <Panel title="Observaciones sobre los datos">
            <IssueList issues={result.issues} />
          </Panel>
        )}

        <section className="report-part">
          <h2 className="report-title">1. Datos de entrada</h2>
          <InputSummary scenario={scenario} forecast={forecast} />
        </section>

        <section className="report-part">
          <h2 className="report-title">2. Estructura del producto</h2>
          <Panel title="Árbol de cada producto final" actions={<TreeLegend />} keepTogether>
            <TreeGallery scenario={scenario} />
          </Panel>
          <Panel title="Códigos de nivel inferior" flush keepTogether>
            <LevelTable scenario={scenario} result={result} />
          </Panel>
        </section>

        <section className="report-part">
          <h2 className="report-title">3. Explosión de necesidades</h2>
          <Panel title="Registro MRP por ítem" actions={<MrpLegend />}>
            <div className="mrp-stack">
              {result.records.map((r) => (
                <MrpTable key={r.code} record={r} horizon={result.horizon} showHeader />
              ))}
            </div>
          </Panel>
          <Panel title="Resumen de requerimientos brutos y netos" flush keepTogether>
            <RequirementsSummaryTable result={result} />
          </Panel>
        </section>

        <section className="report-part">
          <h2 className="report-title">4. Plan de órdenes</h2>
          <Panel title="Diagrama de pedidos" actions={<GanttLegend />}>
            <OrderGantt result={result} />
          </Panel>
          <Panel title="Órdenes planificadas" subtitle="OF = orden de fabricación, OC = orden de compra." flush>
            <OrdersTable result={result} />
          </Panel>
        </section>

        <section className="report-part">
          <h2 className="report-title">5. Compras sugeridas</h2>
          <Panel title="Solicitudes de compra" flush>
            <OrdersTable result={result} type="compra" />
          </Panel>
          <Panel title="Totales por ítem de compra" flush keepTogether>
            <PurchaseTotals result={result} />
          </Panel>
        </section>

        {withCosts && (
          <section className="report-part">
            <h2 className="report-title">6. Costos y tamaño de lote</h2>
            <Panel
              title="Costos por ítem"
              subtitle="C = costo unitario ($/u.), S = costo de pedido o preparación ($/orden), i = costo de mantener (% anual). h = C · i / 5200."
              flush
              keepTogether
            >
              <CostsTable records={result.records} />
            </Panel>
            <Panel
              title="Comparación de técnicas de loteo"
              subtitle="Costo del horizonte (mantener + pedir) de cada técnica, con las necesidades brutas de este plan. Resaltada, la recomendada: la más económica que no suma órdenes atrasadas."
              flush
              keepTogether
            >
              <ComparisonTable records={result.records} comparisons={comparisons} />
            </Panel>
          </section>
        )}

        <section className="report-part">
          <h2 className="report-title">{analysisNumber}. Análisis técnico y factibilidad</h2>
          <Panel title="Conclusiones" keepTogether>
            <Conclusions scenario={scenario} result={result} />
          </Panel>
          <Panel title="Primeras órdenes por ítem" flush keepTogether>
            <FirstOrdersTable result={result} />
          </Panel>
          <Panel title="Lead times acumulados" flush keepTogether>
            <LeadTimeTable scenario={scenario} />
          </Panel>
        </section>
      </article>
    </>
  );
}
