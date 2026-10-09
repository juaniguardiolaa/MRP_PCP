import { ArrowRight, Info } from 'lucide-react';
import { describeLotPolicy } from '../domain/lotSizing';
import { orderSummaryByItem } from '../domain/reports';
import type { MrpResult } from '../domain/types';
import type { ViewId } from '../navigation';
import { fmt, fmtMoney } from './common';
import { OrdersBoard, OrdersViewToggle, useOrdersView } from './OrdersBoard';
import { OrdersTable } from './OrderPlan';
import { PageHeader } from './shell/PageHeader';
import { ItemCode } from './ui/Chips';
import { Panel } from './ui/Panel';

export function PurchaseTotals({ result }: { result: MrpResult }) {
  const rows = orderSummaryByItem(result).filter((s) => s.type === 'compra');
  const descriptions = new Map(result.records.map((r) => [r.code, r.description]));
  const unitCosts = new Map(result.records.map((r) => [r.code, r.costs?.unitCost ?? 0]));
  const priced = rows.some((s) => (unitCosts.get(s.itemCode) ?? 0) > 0);
  const amount = (code: string, quantity: number) => quantity * (unitCosts.get(code) ?? 0);
  const totalAmount = rows.reduce((n, s) => n + amount(s.itemCode, s.totalQuantity), 0);
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
            {priced && (
              <>
                <th scope="col" className="num">
                  Costo unitario
                </th>
                <th scope="col" className="num">
                  Importe
                </th>
              </>
            )}
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
              {priced && (
                <>
                  <td className="num">{unitCosts.get(s.itemCode) ? fmtMoney(unitCosts.get(s.itemCode)!) : '—'}</td>
                  <td className="num strong">
                    {unitCosts.get(s.itemCode) ? fmtMoney(amount(s.itemCode, s.totalQuantity)) : '—'}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
        {priced && (
          <tfoot>
            <tr>
              <th scope="row" colSpan={7}>
                Importe total de las compras del horizonte
              </th>
              <td className="num total">{fmtMoney(totalAmount)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export function LotSizingNote({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="callout no-print">
      <Info size={16} aria-hidden />
      <div>
        <p>
          <strong>Cantidad económica de pedido:</strong> la cantidad de cada solicitud sale de la política de loteo del ítem.
          Para pedir la cantidad económica, cargá los costos y compará EOQ, costo total mínimo y costo unitario mínimo.
        </p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onOpen}>
          Ir a Cantidad económica de pedido <ArrowRight size={14} aria-hidden />
        </button>
      </div>
    </div>
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
      <LotSizingNote onOpen={() => onNavigate('loteo')} />
      <Panel title="Totales por ítem de compra" subtitle="Resumen de las compras del horizonte." flush keepTogether>
        <PurchaseTotals result={result} />
      </Panel>
    </>
  );
}
