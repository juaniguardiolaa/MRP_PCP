import { useState } from 'react';
import { describeOrderLot } from '../domain/lotSizing';
import { numberOrders, ordersByReleaseWeek } from '../domain/reports';
import type { ItemType, MrpResult, PlannedOrder } from '../domain/types';
import type { ViewId } from '../navigation';
import { fmt, weekNumbers } from './common';
import { OrdersBoard, OrdersViewToggle, useOrdersView } from './OrdersBoard';
import { PageHeader } from './shell/PageHeader';
import { ItemCode, StatusChip, TypeChip } from './ui/Chips';
import { Panel } from './ui/Panel';
import { SegmentedControl } from './ui/SegmentedControl';
import { Term } from './ui/Term';

/** Columna de la grilla para una semana: 1 = etiqueta, 2 = "S0 o antes", 3 = S1, ... */
const col = (week: number) => (week >= 1 ? week + 2 : 2);

/** Reparte las órdenes de un ítem en carriles para que las barras no se superpongan. */
function assignLanes(orders: PlannedOrder[]) {
  const laneEnds: number[] = [];
  return orders.map((o) => {
    const start = col(o.releaseWeek);
    const end = Math.max(col(o.receiptWeek), start + 1);
    let lane = laneEnds.findIndex((e) => e <= start);
    if (lane === -1) lane = laneEnds.push(end) - 1;
    else laneEnds[lane] = end;
    return { order: o, start, end, lane };
  });
}

export function OrderGantt({ result, orders = result.orders }: { result: MrpResult; orders?: PlannedOrder[] }) {
  const weeks = weekNumbers(result.horizon);
  const template = `minmax(96px, 120px) repeat(${result.horizon + 1}, minmax(40px, 1fr))`;
  const numbers = numberOrders(result.orders);
  const records = result.records.filter((r) => orders.some((o) => o.itemCode === r.code));
  if (!records.length) return <p className="muted">No hay órdenes con este filtro.</p>;
  return (
    <div className="table-scroll">
      <div className="gantt" style={{ minWidth: 120 + (result.horizon + 1) * 44 }}>
        <div className="gantt-row gantt-head" style={{ gridTemplateColumns: template }}>
          <div className="gantt-label">Ítem</div>
          <div className="gantt-cell gantt-late-col" title="Emisiones atrasadas (semana 0 o antes)">
            ≤S0
          </div>
          {weeks.map((w) => (
            <div key={w} className="gantt-cell">
              S{w}
            </div>
          ))}
        </div>
        {records.map((r) => {
          const bars = assignLanes(orders.filter((o) => o.itemCode === r.code));
          const lanes = Math.max(1, ...bars.map((b) => b.lane + 1));
          return (
            <div
              key={r.code}
              className="gantt-row"
              style={{ gridTemplateColumns: template, gridTemplateRows: `repeat(${lanes}, 26px)` }}
            >
              <div className="gantt-label" style={{ gridRow: `1 / span ${lanes}` }}>
                <ItemCode code={r.code} />
                <span className="gantt-meta">N{r.level} · LT {r.leadTime}</span>
              </div>
              {[0, ...weeks].map((w) => (
                <div
                  key={w}
                  className={`gantt-bg ${w === 0 ? 'gantt-late-col' : ''}`}
                  style={{ gridColumn: col(w), gridRow: `1 / span ${lanes}` }}
                />
              ))}
              {bars.map(({ order: o, start, end, lane }) => {
                const title =
                  `${numbers.get(o)} · ${o.itemCode}: ${fmt(o.quantity)} u. (${describeOrderLot(o)}) – ` +
                  `emitir en S${o.releaseWeek}, recibir en S${o.receiptWeek}` +
                  (o.pastDue ? ' – ATRASADA' : '');
                return (
                  <div
                    key={`${o.releaseWeek}-${o.receiptWeek}-${lane}`}
                    className={`gantt-bar bar-${o.type} ${o.pastDue ? 'bar-late' : ''}`}
                    style={{ gridColumn: `${start} / ${end}`, gridRow: lane + 1 }}
                    title={title}
                  >
                    {fmt(o.quantity)}
                    <span className="bar-arrive">→S{o.receiptWeek}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function GanttLegend() {
  return (
    <p className="legend">
      <span className="legend-swatch bar-fabricacion" /> Fabricación
      <span className="legend-swatch bar-compra" /> Compra
      <span className="legend-swatch bar-late" /> Atrasada
      <span className="legend-note">La barra va de la emisión a la recepción.</span>
    </p>
  );
}

/** Órdenes agrupadas por semana de emisión, con su número. */
export function OrdersTable({
  result,
  orders = result.orders,
  type,
}: {
  result: MrpResult;
  orders?: PlannedOrder[];
  /** Si se indica, la tabla es de un solo tipo y no muestra la columna Tipo. */
  type?: ItemType;
}) {
  const numbers = numberOrders(result.orders);
  const descriptions = new Map(result.records.map((r) => [r.code, r.description]));
  const groups = ordersByReleaseWeek(orders, type);
  if (!groups.length) return <p className="muted panel-pad">No hay órdenes planificadas con este filtro.</p>;
  return (
    <div className="table-scroll">
      <table className="data-table orders-table">
        <thead>
          <tr>
            <th scope="col">{type === 'compra' ? 'N° OC' : 'N° orden'}</th>
            <th scope="col">Emitir en</th>
            <th scope="col">Ítem</th>
            {!type && <th scope="col">Tipo</th>}
            <th scope="col" className="num">
              Cantidad
            </th>
            <th scope="col" className="num">
              Lotes
            </th>
            <th scope="col">{type === 'compra' ? 'Necesaria en' : 'Recibir en'}</th>
            <th scope="col">Estado</th>
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.week} className="week-group">
            {g.orders.map((o) => (
              <tr key={`${o.itemCode}-${o.receiptWeek}`} className={o.pastDue ? 'row-late' : undefined}>
                <td className="mono">{numbers.get(o)}</td>
                <td>{o.pastDue ? <span className="text-critical">S{o.releaseWeek}</span> : `S${o.releaseWeek}`}</td>
                <td>
                  <ItemCode code={o.itemCode} /> <span className="muted">{descriptions.get(o.itemCode)}</span>
                </td>
                {!type && (
                  <td>
                    <TypeChip type={o.type} />
                  </td>
                )}
                <td className="num strong">{fmt(o.quantity)}</td>
                <td className="num">{describeOrderLot(o)}</td>
                <td>S{o.receiptWeek}</td>
                <td>
                  {o.pastDue ? <StatusChip tone="critical">Atrasada</StatusChip> : <StatusChip tone="ok">A tiempo</StatusChip>}
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

type TypeFilter = 'todas' | ItemType;

export function OrderPlan({
  result,
  onNavigate,
}: {
  result: MrpResult;
  onNavigate: (view: ViewId, item?: string) => void;
}) {
  const [type, setType] = useState<TypeFilter>('todas');
  const [view, setView] = useOrdersView();
  const [item, setItem] = useState('');
  const orders = result.orders.filter((o) => (type === 'todas' || o.type === type) && (!item || o.itemCode === item));
  const count = (t: ItemType) => orders.filter((o) => o.type === t).length;

  return (
    <>
      <PageHeader
        view="ordenes"
        actions={
          <>
            <SegmentedControl<TypeFilter>
              label="Tipo de orden"
              value={type}
              onChange={setType}
              options={[
                { value: 'todas', label: 'Todas' },
                { value: 'fabricacion', label: 'Fabricación' },
                { value: 'compra', label: 'Compra' },
              ]}
            />
            <select aria-label="Filtrar por ítem" value={item} onChange={(e) => setItem(e.currentTarget.value)}>
              <option value="">Todos los ítems</option>
              {result.records.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code} · {r.description}
                </option>
              ))}
            </select>
          </>
        }
      />
      <Panel
        title="Diagrama de pedidos"
        subtitle={`${orders.length} órdenes: ${count('fabricacion')} de fabricación y ${count('compra')} de compra.`}
        actions={<GanttLegend />}
      >
        <OrderGantt result={result} orders={orders} />
      </Panel>
      <Panel
        title="Órdenes planificadas"
        subtitle={
          <>
            Agrupadas por semana de emisión (<Term id="EOP" />
            ). OF = orden de fabricación, OC = orden de compra.
            {view === 'tablero' && ' Hacé clic en una tarjeta para ver la explosión MRP del ítem.'}
          </>
        }
        actions={<OrdersViewToggle value={view} onChange={setView} />}
        flush
      >
        {view === 'tablero' ? (
          <OrdersBoard result={result} orders={orders} onOpenItem={(code) => onNavigate('explosion', code)} />
        ) : (
          <OrdersTable result={result} orders={orders} />
        )}
      </Panel>
    </>
  );
}
