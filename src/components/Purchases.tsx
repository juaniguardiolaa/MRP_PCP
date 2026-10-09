import { Info } from 'lucide-react';
import { describeLotPolicy } from '../domain/lotSizing';
import { orderSummaryByItem } from '../domain/reports';
import type { MrpResult } from '../domain/types';
import type { ViewId } from '../navigation';
import { fmt } from './common';
import { OrdersBoard, OrdersViewToggle, useOrdersView } from './OrdersBoard';
import { OrdersTable } from './OrderPlan';
import { PageHeader } from './shell/PageHeader';
import { ItemCode } from './ui/Chips';
import { Panel } from './ui/Panel';

export function PurchaseTotals({ result }: { result: MrpResult }) {
  const rows = orderSummaryByItem(result).filter((s) => s.type === 'compra');
  const descriptions = new Map(result.records.map((r) => [r.code, r.description]));
  if (!rows.length) return <p className="muted panel-pad">No hay ítems de compra.</p>;
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Ítem</th>
            <th scope="col">Política de loteo</th>
            <th scope="col" className="num">
              Solicitudes
            </th>
            <th scope="col" className="num">
              Cantidad total
            </th>
            <th scope="col">Primera emisión</th>
            <th scope="col" className="num">
              Primera cantidad
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.itemCode} className={s.pastDueCount ? 'row-late' : undefined}>
              <th scope="row">
                <ItemCode code={s.itemCode} /> <span className="muted">{descriptions.get(s.itemCode)}</span>
              </th>
              <td>{describeLotPolicy(s.lotPolicy)}</td>
              <td className="num">{s.orderCount}</td>
              <td className="num strong">{fmt(s.totalQuantity)}</td>
              <td className={s.pastDueCount ? 'text-critical' : undefined}>
                {s.firstReleaseWeek === null ? '—' : `S${s.firstReleaseWeek}`}
              </td>
              <td className="num">{s.orderCount ? fmt(s.firstQuantity) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EoqNote() {
  return (
    <p className="callout">
      <Info size={16} aria-hidden />
      <span>
        <strong>Cantidad económica de pedido:</strong> el cálculo por costos (EOQ, costo total mínimo y costo unitario
        mínimo) llega en la próxima etapa. Por ahora la cantidad sugerida es la que surge de la política de loteo de cada
        ítem.
      </span>
    </p>
  );
}

export function Purchases({
  result,
  onNavigate,
}: {
  result: MrpResult;
  onNavigate: (view: ViewId, item?: string) => void;
}) {
  const [view, setView] = useOrdersView();
  const purchases = result.orders.filter((o) => o.type === 'compra');
  const units = purchases.reduce((n, o) => n + o.quantity, 0);
  return (
    <>
      <PageHeader view="compras" />
      <Panel
        title="Solicitudes de compra sugeridas"
        subtitle={`${purchases.length} solicitudes por ${fmt(units)} unidades en total, agrupadas por semana de emisión.`}
        actions={<OrdersViewToggle value={view} onChange={setView} />}
        flush
      >
        {view === 'tablero' ? (
          <OrdersBoard result={result} type="compra" onOpenItem={(code) => onNavigate('explosion', code)} />
        ) : (
          <OrdersTable result={result} type="compra" />
        )}
      </Panel>
      <EoqNote />
      <Panel title="Totales por ítem de compra" subtitle="Resumen de las compras del horizonte." flush keepTogether>
        <PurchaseTotals result={result} />
      </Panel>
    </>
  );
}
