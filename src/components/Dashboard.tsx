import { ArrowDown, ArrowRight, CalendarRange, ChartGantt, CircleCheck, GitFork, Network, Package, ShoppingCart, Table2, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import {
  dashboardSummary,
  numberOrders,
  ordersPerWeek,
  trailingEmptyDemand,
  type DashboardSummary,
  type WeekLoad,
} from '../domain/reports';
import type { Issue, MrpResult, Scenario } from '../domain/types';
import type { ViewId } from '../navigation';
import { IssueList, fmt } from './common';
import { PageHeader } from './shell/PageHeader';
import { ItemCode, StatusChip, TypeChip, type Tone } from './ui/Chips';
import { KpiTile } from './ui/KpiTile';
import { Panel } from './ui/Panel';

type Navigate = (view: ViewId, item?: string) => void;

interface FlowNode {
  view: ViewId;
  icon: LucideIcon;
  title: string;
  metric: string;
  tone: Tone;
}

function FlowButton({ node, onNavigate, emphasis }: { node: FlowNode; onNavigate: Navigate; emphasis?: boolean }) {
  const Icon = node.icon;
  return (
    <button
      type="button"
      className={`flow-node flow-${node.tone} ${emphasis ? 'flow-process' : ''}`}
      onClick={() => onNavigate(node.view)}
    >
      <span className="flow-icon">
        <Icon size={18} aria-hidden />
      </span>
      <span className="flow-text">
        <span className="flow-title">{node.title}</span>
        <span className="flow-metric">{node.metric}</span>
      </span>
      <span className={`flow-dot dot-${node.tone}`} aria-label={node.tone === 'critical' ? 'Requiere atención' : 'Correcto'} />
    </button>
  );
}

function FlowArrow() {
  return (
    <div className="flow-arrow" aria-hidden>
      <ArrowRight size={20} className="arrow-h" />
      <ArrowDown size={20} className="arrow-v" />
    </div>
  );
}

/** Esquema "Estructura del Sistema de MRP": entradas → proceso → entregables. */
function MrpFlow({ s, onNavigate }: { s: DashboardSummary; onNavigate: Navigate }) {
  const inputs: FlowNode[] = [
    { view: 'pmp', icon: CalendarRange, title: 'Plan maestro (PMP)', metric: `${s.productCount} productos · ${s.horizon} semanas`, tone: 'ok' },
    { view: 'bom', icon: Network, title: 'Lista de materiales', metric: `${s.bomLineCount} relaciones · ${s.levelCount} niveles`, tone: 'ok' },
    {
      view: 'items',
      icon: Package,
      title: 'Inventario e ítems',
      metric: `${s.itemCount} ítems · ${s.scheduledReceiptCount} entregas programadas`,
      tone: 'ok',
    },
  ];
  const process: FlowNode = {
    view: 'explosion',
    icon: Table2,
    title: 'Explosión MRP',
    metric: `${s.itemCount} ítems calculados nivel por nivel`,
    tone: 'ok',
  };
  const outputs: FlowNode[] = [
    { view: 'estructura', icon: GitFork, title: 'Estructura de producto', metric: `${s.levelCount} niveles`, tone: 'ok' },
    { view: 'ordenes', icon: ChartGantt, title: 'Plan de órdenes', metric: `${s.orderCount} órdenes planificadas`, tone: 'ok' },
    { view: 'compras', icon: ShoppingCart, title: 'Compras sugeridas', metric: `${s.purchaseOrders} solicitudes`, tone: 'ok' },
    {
      view: 'analisis',
      icon: TriangleAlert,
      title: 'Análisis y alertas',
      metric: s.pastDueCount ? `${s.pastDueCount} orden atrasada` : 'Plan factible',
      tone: s.pastDueCount ? 'critical' : 'ok',
    },
  ];
  return (
    <div className="flow">
      <div className="flow-col">
        <p className="flow-heading">Entradas</p>
        {inputs.map((n) => (
          <FlowButton key={n.view} node={n} onNavigate={onNavigate} />
        ))}
      </div>
      <FlowArrow />
      <div className="flow-col flow-col-center">
        <p className="flow-heading">Proceso</p>
        <FlowButton node={process} onNavigate={onNavigate} emphasis />
        <p className="flow-caption">Netea las necesidades con el stock, aplica el loteo y corre las órdenes según el lead time.</p>
      </div>
      <FlowArrow />
      <div className="flow-col">
        <p className="flow-heading">Entregables</p>
        {outputs.map((n) => (
          <FlowButton key={n.view} node={n} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

const CHART_W = 640;
const CHART_H = 220;
const PAD = { top: 12, right: 8, bottom: 28, left: 32 };
const BAR_MAX = 24;
const GAP = 2;

/** Barras apiladas de órdenes a emitir por semana (fabricación abajo, compra arriba). */
function WeekLoadChart({ load }: { load: WeekLoad[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...load.map((w) => w.fabricacion + w.compra));
  const step = max <= 6 ? 1 : max <= 12 ? 2 : 5;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const plotW = CHART_W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;
  const band = plotW / load.length;
  const barW = Math.min(BAR_MAX, band * 0.6);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;

  // Segmento con esquinas superiores redondeadas (4 px) y base recta.
  const segment = (x: number, y0: number, y1: number, rounded: boolean) => {
    const h = y0 - y1;
    if (h <= 0) return '';
    const r = rounded ? Math.min(4, h, barW / 2) : 0;
    return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + barW - r}Q${x + barW},${y1} ${x + barW},${y1 + r}V${y0}Z`;
  };

  const hovered = hover === null ? null : load[hover];

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="chart" role="img" aria-label="Órdenes a emitir por semana, por tipo">
        {ticks.map((t) => (
          <g key={t}>
            <line className="chart-grid" x1={PAD.left} x2={CHART_W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="chart-axis" x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="central">
              {t}
            </text>
          </g>
        ))}
        {load.map((w, i) => {
          const x = PAD.left + band * i + (band - barW) / 2;
          const base = y(0);
          const fabTop = y(w.fabricacion);
          const totalTop = y(w.fabricacion + w.compra);
          const compraBase = w.fabricacion ? fabTop - GAP : base;
          return (
            <g key={w.week} className={hover !== null && hover !== i ? 'chart-dim' : undefined}>
              <path className="bar-fabricacion-fill" d={segment(x, base, fabTop, w.compra === 0)} />
              {w.compra > 0 && <path className="bar-compra-fill" d={segment(x, compraBase, Math.min(totalTop, compraBase - 1), true)} />}
              <text className="chart-axis" x={x + barW / 2} y={CHART_H - 10} textAnchor="middle">
                {w.week === 0 ? '≤S0' : `S${w.week}`}
              </text>
              <rect
                className="chart-hit"
                x={PAD.left + band * i}
                y={PAD.top}
                width={band}
                height={plotH}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>
      {hovered && (
        <div
          className="chart-tip"
          style={{ left: `${((PAD.left + band * (hover! + 0.5)) / CHART_W) * 100}%` }}
          role="status"
        >
          <strong>{hovered.week === 0 ? 'Atrasadas (S0 o antes)' : `Semana ${hovered.week}`}</strong>
          <span>
            <i className="legend-swatch bar-fabricacion" /> Fabricación: {hovered.fabricacion}
          </span>
          <span>
            <i className="legend-swatch bar-compra" /> Compra: {hovered.compra}
          </span>
        </div>
      )}
    </div>
  );
}

const STEPS: { view: ViewId; title: string; text: string }[] = [
  { view: 'pmp', title: 'Cargá los datos maestros', text: 'Plan maestro, ítems con su inventario y lista de materiales.' },
  { view: 'explosion', title: 'Revisá la explosión MRP', text: 'Cómo se calcula cada ítem semana a semana.' },
  { view: 'ordenes', title: 'Emití las órdenes', text: 'Plan de órdenes de fabricación y compras sugeridas.' },
  { view: 'analisis', title: 'Controlá el plan', text: 'Atrasos, lead times acumulados e informe final.' },
];

function HowTo({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <ol className="howto">
      {STEPS.map((s, i) => (
        <li key={s.view}>
          <button type="button" className="howto-step" onClick={() => onNavigate(s.view)}>
            <span className="howto-num">{i + 1}</span>
            <span className="howto-text">
              <span className="howto-title">{s.title}</span>
              <span className="howto-desc">{s.text}</span>
            </span>
            <ArrowRight size={16} aria-hidden className="howto-arrow" />
          </button>
        </li>
      ))}
    </ol>
  );
}

export function Dashboard({ scenario, result, onNavigate }: { scenario: Scenario; result: MrpResult; onNavigate: Navigate }) {
  const blocked = result.issues.some((i) => i.severity === 'error');

  if (blocked) {
    return (
      <>
        <PageHeader view="inicio" eyebrow={`Escenario · ${scenario.name}`} />
        <Panel title="No se puede calcular el plan" subtitle="Corregí estos datos para ver los resultados." className="panel-critical">
          <IssueList issues={result.issues.filter((i) => i.severity === 'error')} />
          <div className="chip-row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('items')}>
              Ir a ítems
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('bom')}>
              Ir a lista de materiales
            </button>
          </div>
        </Panel>
        <Panel title="Cómo usar el sistema">
          <HowTo onNavigate={onNavigate} />
        </Panel>
      </>
    );
  }

  const s = dashboardSummary(scenario, result);
  const numbers = numberOrders(result.orders);
  const descriptions = new Map(result.records.map((r) => [r.code, r.description]));
  const gap = trailingEmptyDemand(scenario);
  const gapAlert: Issue[] = gap
    ? [
        {
          severity: 'warning',
          message:
            `El plan maestro no tiene demanda en ${gap.from === gap.to ? `S${gap.from}` : `S${gap.from} a S${gap.to}`}: ` +
            'el MRP no planifica nada en esas semanas. Cargá la demanda en el plan maestro.',
        },
      ]
    : [];
  const alerts = [...gapAlert, ...result.alerts.filter((a) => a.severity !== 'info')];

  return (
    <>
      <PageHeader view="inicio" eyebrow={`Escenario · ${scenario.name}`} />

      <div className="kpi-row">
        <KpiTile
          label="Órdenes planificadas"
          value={s.orderCount}
          detail={`${s.manufacturingOrders} de fabricación · ${s.purchaseOrders} de compra`}
          linkLabel="Ver plan de órdenes"
          onOpen={() => onNavigate('ordenes')}
        />
        <KpiTile
          label="Unidades a comprar"
          value={fmt(s.purchaseUnits)}
          detail={`En ${s.purchaseOrders} solicitudes de compra`}
          linkLabel="Ver compras"
          onOpen={() => onNavigate('compras')}
        />
        <KpiTile
          label="Órdenes atrasadas"
          value={s.pastDueCount}
          tone={s.pastDueCount ? 'critical' : 'ok'}
          detail={s.pastDueCount ? 'Debieron emitirse antes de la semana 1' : 'Todas se emiten a tiempo'}
          linkLabel="Ver análisis"
          onOpen={() => onNavigate('analisis')}
        />
        <KpiTile
          label="Lead time crítico"
          value={s.critical ? `${s.critical.weeks} sem.` : '—'}
          detail={s.critical ? `${s.critical.itemCode}: ${s.critical.path.join(' → ')}` : undefined}
          linkLabel="Ver lead times"
          onOpen={() => onNavigate('analisis')}
        />
      </div>

      <Panel title="Flujo del MRP" subtitle="Los datos de entrada alimentan el cálculo, y el cálculo produce los entregables. Hacé clic en cualquier caja.">
        <MrpFlow s={s} onNavigate={onNavigate} />
      </Panel>

      <div className="dash-grid">
        <Panel
          title="Para emitir en la semana 1"
          subtitle="Órdenes que hay que emitir ya, incluidas las atrasadas."
          actions={
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate('ordenes')}>
              Ver todas <ArrowRight size={14} aria-hidden />
            </button>
          }
          flush
        >
          {s.firstWeekOrders.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">N° orden</th>
                    <th scope="col">Ítem</th>
                    <th scope="col">Tipo</th>
                    <th scope="col" className="num">
                      Cantidad
                    </th>
                    <th scope="col">Recibir en</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {s.firstWeekOrders.map((o) => (
                    <tr key={`${o.itemCode}-${o.receiptWeek}`} className={o.pastDue ? 'row-late' : undefined}>
                      <td className="mono">{numbers.get(o)}</td>
                      <td>
                        <ItemCode code={o.itemCode} /> <span className="muted">{descriptions.get(o.itemCode)}</span>
                      </td>
                      <td>
                        <TypeChip type={o.type} />
                      </td>
                      <td className="num strong">{fmt(o.quantity)}</td>
                      <td>S{o.receiptWeek}</td>
                      <td>
                        {o.pastDue ? <StatusChip tone="critical">Atrasada</StatusChip> : <StatusChip tone="ok">A tiempo</StatusChip>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted panel-pad">No hay órdenes para emitir en la semana 1.</p>
          )}
        </Panel>

        <Panel
          title="Alertas"
          actions={
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate('analisis')}>
              Ver análisis <ArrowRight size={14} aria-hidden />
            </button>
          }
        >
          {alerts.length ? (
            <IssueList issues={alerts.slice(0, 4)} labels={{ error: 'Riesgo' }} />
          ) : (
            <p className="ok-state">
              <CircleCheck size={18} aria-hidden /> Sin alertas: todas las órdenes se emiten a tiempo.
            </p>
          )}
        </Panel>

        <Panel
          title="Órdenes a emitir por semana"
          subtitle="Cantidad de órdenes según la semana de emisión."
          actions={
            <p className="legend">
              <span className="legend-swatch bar-fabricacion" /> Fabricación
              <span className="legend-swatch bar-compra" /> Compra
            </p>
          }
        >
          <WeekLoadChart load={ordersPerWeek(result)} />
        </Panel>

        <Panel title="Cómo usar el sistema" subtitle="Los cuatro pasos del MRP, en orden.">
          <HowTo onNavigate={onNavigate} />
        </Panel>
      </div>
    </>
  );
}
