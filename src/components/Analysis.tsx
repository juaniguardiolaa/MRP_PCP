import { CircleCheck, TriangleAlert } from 'lucide-react';
import { endItemLeadTimes, feasibilityAnalysis, orderSummaryByItem } from '../domain/reports';
import type { MrpResult, Scenario } from '../domain/types';
import { IssueList, fmt } from './common';
import { PageHeader } from './shell/PageHeader';
import { ItemCode, StatusChip, TypeChip } from './ui/Chips';
import { Panel } from './ui/Panel';
import { Term } from './ui/Term';

export function FirstOrdersTable({ result }: { result: MrpResult }) {
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
            <th scope="col">Primera emisión</th>
            <th scope="col" className="num">
              Cantidad
            </th>
            <th scope="col">Recepción</th>
            <th scope="col" className="num">
              Órdenes
            </th>
          </tr>
        </thead>
        <tbody>
          {orderSummaryByItem(result).map((s) => {
            const late = s.firstReleaseWeek !== null && s.firstReleaseWeek < 1;
            return (
              <tr key={s.itemCode} className={late ? 'row-late' : s.type === 'compra' ? 'row-purchase' : undefined}>
                <th scope="row">
                  <ItemCode code={s.itemCode} />
                </th>
                <td className="num">{s.level}</td>
                <td>
                  <TypeChip type={s.type} />
                </td>
                <td>
                  {s.firstReleaseWeek === null ? '—' : `S${s.firstReleaseWeek}`}{' '}
                  {late && <StatusChip tone="critical">Atrasada</StatusChip>}
                </td>
                <td className="num">{s.orderCount ? fmt(s.firstQuantity) : '—'}</td>
                <td>{s.firstReceiptWeek === null ? '—' : `S${s.firstReceiptWeek}`}</td>
                <td className="num">{s.orderCount}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function LeadTimeTable({ scenario }: { scenario: Scenario }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Producto</th>
            <th scope="col" className="num">
              <Term id="LT_ACUM" />
            </th>
            <th scope="col">Ruta crítica</th>
            <th scope="col" className="num">
              Demanda dentro de esa ventana
            </th>
          </tr>
        </thead>
        <tbody>
          {endItemLeadTimes(scenario).map((lt) => (
            <tr key={lt.itemCode}>
              <th scope="row">
                <ItemCode code={lt.itemCode} />
              </th>
              <td className="num strong">{lt.weeks} sem.</td>
              <td>{lt.path.join(' → ')}</td>
              <td className="num">
                {fmt(lt.demandWithinWindow)} u. (S1–S{Math.min(lt.weeks, scenario.horizon)})
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Conclusions({ scenario, result }: { scenario: Scenario; result: MrpResult }) {
  const { conclusions, pastDueOrders } = feasibilityAnalysis(scenario, result);
  const risk = pastDueOrders.length > 0;
  return (
    <div className={risk ? 'verdict verdict-risk' : 'verdict verdict-ok'}>
      <div className="verdict-head">
        {risk ? <TriangleAlert size={20} aria-hidden /> : <CircleCheck size={20} aria-hidden />}
        <strong>{risk ? 'El plan tiene riesgo de incumplimiento' : 'El plan es factible'}</strong>
      </div>
      <ul>
        {conclusions.map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ul>
    </div>
  );
}

export function Analysis({ scenario, result }: { scenario: Scenario; result: MrpResult }) {
  return (
    <>
      <PageHeader view="analisis" />
      <Panel title="Conclusiones" subtitle="Punto 3 de la consigna, recalculado con los datos actuales." keepTogether>
        <Conclusions scenario={scenario} result={result} />
      </Panel>
      <div className="two-col">
        <Panel
          title="Primeras órdenes por ítem"
          subtitle="Cuándo hay que emitir la primera orden de cada ítem. Las filas resaltadas son de compra."
          flush
          keepTogether
        >
          <FirstOrdersTable result={result} />
        </Panel>
        <div className="stack">
          <Panel
            title="Lead times acumulados"
            subtitle="La demanda dentro de esa ventana solo se cubre con stock o con órdenes ya emitidas."
            flush
            keepTogether
          >
            <LeadTimeTable scenario={scenario} />
          </Panel>
          <Panel title="Alertas del cálculo" keepTogether>
            <IssueList
              issues={result.alerts}
              labels={{ error: 'Riesgo' }}
              empty="Sin alertas: todas las órdenes pueden emitirse a tiempo."
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
