import { ArrowRight, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { describeLots } from '../domain/lotSizing';
import { numberOrders, ordersByReleaseWeek } from '../domain/reports';
import type { ItemType, MrpResult, PlannedOrder } from '../domain/types';
import { fmt, weekNumbers } from './common';
import { ItemCode, StatusChip, TypeChip } from './ui/Chips';
import { SegmentedControl } from './ui/SegmentedControl';

export type OrdersView = 'tablero' | 'tabla';

const VIEW_KEY = 'mrp-pcp:orders-view';

/** Vista elegida para las listas de órdenes (tablero o tabla), recordada en el navegador. */
export function useOrdersView() {
  const [view, setView] = useState<OrdersView>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'tabla' ? 'tabla' : 'tablero';
    } catch {
      return 'tablero';
    }
  });
  const change = (next: OrdersView) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // sin almacenamiento
    }
  };
  return [view, change] as const;
}

export function OrdersViewToggle({ value, onChange }: { value: OrdersView; onChange: (v: OrdersView) => void }) {
  return (
    <SegmentedControl<OrdersView>
      label="Vista de las órdenes"
      value={value}
      onChange={onChange}
      options={[
        { value: 'tablero', label: 'Tablero' },
        { value: 'tabla', label: 'Tabla' },
      ]}
    />
  );
}

function OrderCard({
  order,
  number,
  description,
  onOpen,
}: {
  order: PlannedOrder;
  number: string;
  description: string;
  onOpen: () => void;
}) {
  const lots = describeLots(order.lotPolicy, order.quantity);
  const leadTime = order.receiptWeek - order.releaseWeek;
  return (
    <button
      type="button"
      className={order.pastDue ? 'order-card order-card-late' : 'order-card'}
      onClick={onOpen}
      title={`Ver la explosión MRP de ${order.itemCode}`}
    >
      <span className="order-card-top">
        <span className="order-number">{number}</span>
        <TypeChip type={order.type} />
      </span>
      <span className="order-card-item">
        <ItemCode code={order.itemCode} />
        <span className="order-card-desc">{description}</span>
      </span>
      <span className="order-card-qty">
        <strong>{fmt(order.quantity)} u.</strong>
        <span>{lots ?? 'L4L'}</span>
      </span>
      {order.pastDue ? (
        <StatusChip tone="critical">
          <TriangleAlert size={12} aria-hidden /> Atrasada: emitir ya
        </StatusChip>
      ) : null}
      <span className="order-card-foot">
        Recibir en <strong>S{order.receiptWeek}</strong> · LT {leadTime} sem.
        <ArrowRight size={14} aria-hidden className="order-card-arrow" />
      </span>
    </button>
  );
}

/**
 * Tablero kanban: una columna por semana de emisión (≤S0 para las atrasadas) y una tarjeta
 * por orden. Las semanas sin órdenes quedan como columnas angostas para no perder la secuencia.
 */
export function OrdersBoard({
  result,
  orders = result.orders,
  type,
  onOpenItem,
}: {
  result: MrpResult;
  orders?: PlannedOrder[];
  type?: ItemType;
  onOpenItem: (code: string) => void;
}) {
  const numbers = numberOrders(result.orders);
  const descriptions = new Map(result.records.map((r) => [r.code, r.description]));
  const byWeek = new Map(ordersByReleaseWeek(orders, type).map((g) => [g.week, g.orders]));
  const weeks = [...(byWeek.has(0) ? [0] : []), ...weekNumbers(result.horizon)];
  const total = [...byWeek.values()].reduce((n, os) => n + os.length, 0);
  if (!total) return <p className="muted panel-pad">No hay órdenes planificadas con este filtro.</p>;

  return (
    <div className="board-scroll" role="region" aria-label="Órdenes por semana de emisión" tabIndex={0}>
      <div className="board">
        {weeks.map((week) => {
          const list = byWeek.get(week) ?? [];
          const fab = list.filter((o) => o.type === 'fabricacion').length;
          const oc = list.length - fab;
          const classes = ['board-col', week === 0 && 'board-col-late', !list.length && 'board-col-empty']
            .filter(Boolean)
            .join(' ');
          return (
            <section key={week} className={classes} aria-label={week === 0 ? 'Órdenes atrasadas' : `Semana ${week}`}>
              <header className="board-col-head">
                <span className="board-col-title">
                  {week === 0 ? '≤S0 · Atrasadas' : list.length ? `Semana ${week}` : `S${week}`}
                  {week === 1 && list.length > 0 && <StatusChip tone="info">Ahora</StatusChip>}
                </span>
                {list.length > 0 && (
                  <span className="board-col-count">
                    {list.length} {list.length === 1 ? 'orden' : 'órdenes'}
                    {!type && (
                      <span className="muted">
                        {' · '}
                        {[fab && `${fab} OF`, oc && `${oc} OC`].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                )}
              </header>
              {list.length ? (
                <div className="board-cards">
                  {list.map((o) => (
                    <OrderCard
                      key={`${o.itemCode}-${o.receiptWeek}`}
                      order={o}
                      number={numbers.get(o) ?? ''}
                      description={descriptions.get(o.itemCode) ?? ''}
                      onOpen={() => onOpenItem(o.itemCode)}
                    />
                  ))}
                </div>
              ) : (
                <p className="board-empty">Sin órdenes</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
