import { cumulativeLeadTime, endItems, usableBomLines } from './bom';
import type { ItemType, LotPolicy, MrpResult, PlannedOrder, Scenario } from './types';

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

export interface WeekOrders {
  /** Semana de emisión; 0 agrupa las órdenes atrasadas (S0 o antes). */
  week: number;
  orders: PlannedOrder[];
}

/** Órdenes planificadas agrupadas por semana de emisión ("qué pedir y cuándo"). */
export function ordersByReleaseWeek(orders: PlannedOrder[], type?: ItemType): WeekOrders[] {
  const groups = new Map<number, PlannedOrder[]>();
  for (const o of orders) {
    if (type && o.type !== type) continue;
    const week = Math.max(0, o.releaseWeek);
    groups.set(week, [...(groups.get(week) ?? []), o]);
  }
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([week, os]) => ({ week, orders: os }));
}

export interface ItemOrderSummary {
  itemCode: string;
  type: ItemType;
  level: number;
  lotPolicy: LotPolicy;
  orderCount: number;
  totalQuantity: number;
  /** Primera semana de emisión (≤ 0 si está atrasada) o null si no hay órdenes. */
  firstReleaseWeek: number | null;
  firstQuantity: number;
  firstReceiptWeek: number | null;
  pastDueCount: number;
}

/** Resumen de órdenes por ítem, en el orden de los registros MRP. */
export function orderSummaryByItem(result: MrpResult): ItemOrderSummary[] {
  return result.records.map((r) => {
    const os = result.orders.filter((o) => o.itemCode === r.code);
    const first = os.reduce<PlannedOrder | null>(
      (best, o) => (best === null || o.releaseWeek < best.releaseWeek ? o : best),
      null,
    );
    return {
      itemCode: r.code,
      type: r.type,
      level: r.level,
      lotPolicy: r.lotPolicy,
      orderCount: os.length,
      totalQuantity: sum(os.map((o) => o.quantity)),
      firstReleaseWeek: first?.releaseWeek ?? null,
      firstQuantity: first?.quantity ?? 0,
      firstReceiptWeek: first?.receiptWeek ?? null,
      pastDueCount: os.filter((o) => o.pastDue).length,
    };
  });
}

export interface RequirementsSummary {
  itemCode: string;
  level: number;
  type: ItemType;
  grossTotal: number;
  scheduledTotal: number;
  netTotal: number;
  plannedTotal: number;
  endingInventory: number;
  averageInventory: number;
}

/** Reporte de requerimientos brutos y netos del horizonte. */
export function requirementsSummary(result: MrpResult): RequirementsSummary[] {
  return result.records.map((r) => ({
    itemCode: r.code,
    level: r.level,
    type: r.type,
    grossTotal: sum(r.nb),
    scheduledTotal: sum(r.rp),
    netTotal: sum(r.nn),
    plannedTotal: sum(r.rop),
    endingInventory: r.d[r.d.length - 1] ?? r.initialStock,
    averageInventory: r.d.length ? sum(r.d) / r.d.length : r.initialStock,
  }));
}

export interface EndItemLeadTime {
  itemCode: string;
  weeks: number;
  /** Camino crítico, p. ej. ['B', 'G', 'H', 'E']. */
  path: string[];
  /** Demanda del producto dentro de la ventana del lead time acumulado. */
  demandWithinWindow: number;
}

/** Lead time acumulado (ruta crítica) de cada producto final. */
export function endItemLeadTimes(scenario: Scenario): EndItemLeadTime[] {
  const bom = usableBomLines(scenario.items, scenario.bom);
  return endItems(scenario.items, bom).map((item) => {
    const { weeks, path } = cumulativeLeadTime(item.code, scenario.items, bom);
    const window = Math.min(weeks, scenario.horizon);
    return {
      itemCode: item.code,
      weeks,
      path,
      demandWithinWindow: sum(item.demand.slice(0, window)),
    };
  });
}

export interface FeasibilityAnalysis {
  /** Primera semana en que se emite una orden de compra (null si no hay). */
  firstPurchaseWeek: number | null;
  firstPurchaseItems: string[];
  pastDueOrders: PlannedOrder[];
  leadTimes: EndItemLeadTime[];
  conclusions: string[];
}

const weekLabel = (w: number) => (w >= 1 ? `S${w}` : `S${w} (antes del horizonte)`);

/** Punto 3 de la consigna: primeras órdenes de materias primas y riesgo por lead times. */
export function feasibilityAnalysis(scenario: Scenario, result: MrpResult): FeasibilityAnalysis {
  const purchases = result.orders.filter((o) => o.type === 'compra');
  const firstPurchaseWeek = purchases.length
    ? Math.min(...purchases.map((o) => o.releaseWeek))
    : null;
  const firstPurchaseItems = [
    ...new Set(purchases.filter((o) => o.releaseWeek === firstPurchaseWeek).map((o) => o.itemCode)),
  ];
  const pastDueOrders = result.orders.filter((o) => o.pastDue);
  const leadTimes = endItemLeadTimes(scenario);

  const conclusions: string[] = [];
  if (firstPurchaseWeek !== null) {
    const firsts = orderSummaryByItem(result)
      .filter((s) => s.type === 'compra' && s.firstReleaseWeek !== null)
      .sort((a, b) => a.firstReleaseWeek! - b.firstReleaseWeek! || a.itemCode.localeCompare(b.itemCode))
      .map((s) => {
        if (s.firstReleaseWeek! >= 1) return `${s.itemCode} en S${s.firstReleaseWeek} (${s.firstQuantity} u.)`;
        const next = purchases.find((o) => o.itemCode === s.itemCode && !o.pastDue);
        return (
          `${s.itemCode} en ${weekLabel(s.firstReleaseWeek!)}, atrasada (${s.firstQuantity} u.` +
          (next ? `; su primera orden a tiempo es en S${next.releaseWeek})` : ')')
        );
      });
    conclusions.push(`Primeras órdenes de compra de materias primas: ${firsts.join('; ')}.`);
  }
  for (const lt of leadTimes) {
    conclusions.push(
      `El lead time acumulado de ${lt.itemCode} es de ${lt.weeks} semanas (ruta crítica ${lt.path.join(' → ')}): ` +
        `la demanda de las semanas 1 a ${Math.min(lt.weeks, scenario.horizon)} (${lt.demandWithinWindow} u.) ` +
        `solo puede cubrirse con stock inicial, recepciones programadas o componentes ya disponibles.`,
    );
  }
  if (pastDueOrders.length) {
    const detail = pastDueOrders
      .map((o) => `${o.itemCode}: ${o.quantity} u. para S${o.receiptWeek}, emisión en S${o.releaseWeek}`)
      .join('; ');
    conclusions.push(
      `Existe riesgo de insatisfacción de la demanda en las primeras semanas: ${pastDueOrders.length} ` +
        `orden(es) debieron emitirse antes de la semana 1 (${detail}). Hay que acelerar esas entregas ` +
        `(pedido urgente, reducir el lead time) o replanificar el PMP.`,
    );
  } else {
    conclusions.push(
      'No hay órdenes atrasadas: con el stock y las recepciones programadas actuales, todas las ' +
        'órdenes pueden emitirse dentro del horizonte y la demanda queda cubierta.',
    );
  }

  return { firstPurchaseWeek, firstPurchaseItems, pastDueOrders, leadTimes, conclusions };
}
