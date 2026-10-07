import { describeLots } from '../domain/lotSizing';
import { ordersByReleaseWeek } from '../domain/reports';
import type { ItemType, MrpResult, PlannedOrder } from '../domain/types';
import { Section, TYPE_LABEL, TypeBadge, fmt, weekNumbers } from './common';

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

export function OrderGantt({ result }: { result: MrpResult }) {
  const weeks = weekNumbers(result.horizon);
  const template = `minmax(84px, 110px) repeat(${result.horizon + 1}, minmax(40px, 1fr))`;
  return (
    <div className="table-scroll">
      <div className="gantt" style={{ minWidth: 110 + (result.horizon + 1) * 44 }}>
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
        {result.records.map((r) => {
          const bars = assignLanes(result.orders.filter((o) => o.itemCode === r.code));
          const lanes = Math.max(1, ...bars.map((b) => b.lane + 1));
          return (
            <div
              key={r.code}
              className="gantt-row"
              style={{ gridTemplateColumns: template, gridTemplateRows: `repeat(${lanes}, 26px)` }}
            >
              <div className="gantt-label" style={{ gridRow: `1 / span ${lanes}` }}>
                <strong>{r.code}</strong> <span className="muted small">N{r.level} · LT {r.leadTime}</span>
              </div>
              {[0, ...weeks].map((w) => (
                <div
                  key={w}
                  className={`gantt-cell gantt-bg ${w === 0 ? 'gantt-late-col' : ''}`}
                  style={{ gridColumn: col(w), gridRow: `1 / span ${lanes}` }}
                />
              ))}
              {bars.map(({ order: o, start, end, lane }) => {
                const lots = describeLots(o.lotPolicy, o.quantity);
                const title =
                  `${o.itemCode}: ${fmt(o.quantity)} u.${lots ? ` (${lots})` : ''} – ` +
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
    <p className="legend small">
      <span className="legend-swatch bar-fabricacion" /> Orden de fabricación
      <span className="legend-swatch bar-compra" /> Orden de compra
      <span className="legend-swatch bar-late" /> Atrasada
      <span className="muted">
        · Cada barra empieza en la semana de emisión (EOP) y termina cuando se recibe la orden (ROP).
      </span>
    </p>
  );
}

/** Calendario de acciones: qué pedir, cuánto y cuándo. */
export function OrdersByWeekTable({ result, type }: { result: MrpResult; type?: ItemType }) {
  const groups = ordersByReleaseWeek(result.orders, type);
  if (!groups.length) return <p className="muted">No hay órdenes planificadas en el horizonte.</p>;
  return (
    <div className="table-scroll">
      <table className="grid-table orders-table">
        <thead>
          <tr>
            <th>Emitir en</th>
            <th>Ítem</th>
            {!type && <th>Tipo</th>}
            <th>Cantidad</th>
            <th>Lotes</th>
            <th>Recibir en</th>
            <th>Estado</th>
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.week} className="week-group">
            {g.orders.map((o, k) => (
              <tr key={`${o.itemCode}-${o.receiptWeek}`} className={o.pastDue ? 'row-late' : undefined}>
                {k === 0 && (
                  <th className="row-head week-cell" rowSpan={g.orders.length}>
                    {g.week === 0 ? 'S0 o antes' : `S${g.week}`}
                  </th>
                )}
                <td>
                  <strong>{o.itemCode}</strong>
                </td>
                {!type && (
                  <td>
                    <TypeBadge type={o.type} />
                  </td>
                )}
                <td className="num">{fmt(o.quantity)}</td>
                <td className="num">{describeLots(o.lotPolicy, o.quantity) ?? 'L4L'}</td>
                <td className="num">S{o.receiptWeek}</td>
                <td>
                  {o.pastDue ? (
                    <span className="badge badge-late">Atrasada (S{o.releaseWeek})</span>
                  ) : (
                    <span className="badge badge-ok">A tiempo</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

export function OrderPlan({ result }: { result: MrpResult }) {
  const count = (t: ItemType) => result.orders.filter((o) => o.type === t).length;
  return (
    <>
      <Section
        title="Diagrama de pedidos"
        subtitle={`${result.orders.length} órdenes planificadas: ${count('fabricacion')} de ${TYPE_LABEL.fabricacion.toLowerCase()} y ${count('compra')} de ${TYPE_LABEL.compra.toLowerCase()}.`}
      >
        <GanttLegend />
        <OrderGantt result={result} />
      </Section>
      <Section
        title="Calendario de órdenes"
        subtitle="Qué pedir, en qué cantidad y cuándo emitir cada orden de compra o de fabricación."
      >
        <OrdersByWeekTable result={result} />
      </Section>
    </>
  );
}
