import { describeLotPolicy } from '../domain/lotSizing';
import { orderSummaryByItem } from '../domain/reports';
import type { MrpResult } from '../domain/types';
import { Section, fmt } from './common';
import { OrdersByWeekTable } from './OrderPlan';

export function PurchaseTotals({ result }: { result: MrpResult }) {
  const rows = orderSummaryByItem(result).filter((s) => s.type === 'compra');
  if (!rows.length) return <p className="muted">No hay ítems de compra.</p>;
  return (
    <div className="table-scroll">
      <table className="grid-table">
        <thead>
          <tr>
            <th>Ítem</th>
            <th>Política de loteo</th>
            <th>Órdenes</th>
            <th>Cantidad total</th>
            <th>Primera emisión</th>
            <th>Primera cantidad</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.itemCode} className={s.pastDueCount ? 'row-late' : undefined}>
              <th className="row-head">{s.itemCode}</th>
              <td>{describeLotPolicy(s.lotPolicy)}</td>
              <td className="num">{s.orderCount}</td>
              <td className="num">{fmt(s.totalQuantity)}</td>
              <td className="num">{s.firstReleaseWeek === null ? '—' : `S${s.firstReleaseWeek}`}</td>
              <td className="num">{s.orderCount ? fmt(s.firstQuantity) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Purchases({ result }: { result: MrpResult }) {
  return (
    <>
      <Section
        title="Sugerencia de compras"
        subtitle="Órdenes de compra a emitir por semana para los ítems de abastecimiento externo, con la cantidad que resulta de la política de loteo de cada ítem."
      >
        <OrdersByWeekTable result={result} type="compra" />
        <p className="note">
          <strong>Cantidad económica de pedido:</strong> el cálculo por costos (EOQ, costo total mínimo y costo
          unitario mínimo) queda para la próxima etapa. Por ahora la cantidad sugerida es la que surge de la política
          de loteo cargada (L4L o lote fijo).
        </p>
      </Section>
      <Section title="Totales por ítem de compra" subtitle="Resumen de las compras del horizonte." keepTogether>
        <PurchaseTotals result={result} />
      </Section>
    </>
  );
}
