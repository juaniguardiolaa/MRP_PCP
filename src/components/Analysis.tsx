import { endItemLeadTimes, feasibilityAnalysis, orderSummaryByItem } from '../domain/reports';
import type { MrpResult, Scenario } from '../domain/types';
import { IssueList, Section, TypeBadge, fmt } from './common';

export function FirstOrdersTable({ result }: { result: MrpResult }) {
  return (
    <div className="table-scroll">
      <table className="grid-table">
        <thead>
          <tr>
            <th>Ítem</th>
            <th>Nivel</th>
            <th>Tipo</th>
            <th>Primera emisión</th>
            <th>Cantidad</th>
            <th>Recepción</th>
            <th>Órdenes en el horizonte</th>
          </tr>
        </thead>
        <tbody>
          {orderSummaryByItem(result).map((s) => {
            const late = s.firstReleaseWeek !== null && s.firstReleaseWeek < 1;
            return (
              <tr key={s.itemCode} className={late ? 'row-late' : s.type === 'compra' ? 'row-purchase' : undefined}>
                <th className="row-head">{s.itemCode}</th>
                <td className="num">{s.level}</td>
                <td>
                  <TypeBadge type={s.type} />
                </td>
                <td className="num">
                  {s.firstReleaseWeek === null ? '—' : `S${s.firstReleaseWeek}`}
                  {late && <span className="badge badge-late">atrasada</span>}
                </td>
                <td className="num">{s.orderCount ? fmt(s.firstQuantity) : '—'}</td>
                <td className="num">{s.firstReceiptWeek === null ? '—' : `S${s.firstReceiptWeek}`}</td>
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
  const leadTimes = endItemLeadTimes(scenario);
  return (
    <div className="table-scroll">
      <table className="grid-table">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Lead time acumulado</th>
            <th>Ruta crítica</th>
            <th>Demanda dentro de esa ventana</th>
          </tr>
        </thead>
        <tbody>
          {leadTimes.map((lt) => (
            <tr key={lt.itemCode}>
              <th className="row-head">{lt.itemCode}</th>
              <td className="num">{lt.weeks} sem.</td>
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
  return (
    <div className={`card conclusions ${pastDueOrders.length ? 'conclusions-risk' : 'conclusions-ok'}`}>
      <h3>Conclusiones</h3>
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
      <Section
        title="Análisis técnico y factibilidad"
        subtitle="Punto 3 de la consigna, recalculado con los datos cargados."
        keepTogether
      >
        <Conclusions scenario={scenario} result={result} />
      </Section>
      <Section
        title="3.1 Primeras órdenes por ítem"
        subtitle="Semana en que debe emitirse la primera orden de cada ítem para no retrasar la entrega final. Las filas resaltadas son ítems de compra (materias primas)."
        keepTogether
      >
        <FirstOrdersTable result={result} />
      </Section>
      <Section
        title="3.2 Lead times acumulados"
        subtitle="Tiempo mínimo para obtener cada producto final partiendo de cero. La demanda dentro de esa ventana depende del stock y de las órdenes ya emitidas."
        keepTogether
      >
        <LeadTimeTable scenario={scenario} />
      </Section>
      <Section title="Alertas del cálculo" keepTogether>
        <IssueList
          issues={result.alerts}
          labels={{ error: 'Riesgo' }}
          empty="Sin alertas: todas las órdenes pueden emitirse a tiempo."
        />
      </Section>
    </>
  );
}
