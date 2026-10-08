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

export interface DashboardSummary {
  itemCount: number;
  productCount: number;
  horizon: number;
  bomLineCount: number;
  /** Cantidad de niveles de la estructura (nivel máximo + 1). */
  levelCount: number;
  /** Entregas programadas (semanas con RP > 0) dentro del horizonte. */
  scheduledReceiptCount: number;
  orderCount: number;
  manufacturingOrders: number;
  purchaseOrders: number;
  purchaseUnits: number;
  pastDueCount: number;
  /** Producto con mayor lead time acumulado. */
  critical: EndItemLeadTime | null;
  /** Órdenes a emitir en la semana 1, incluidas las atrasadas. */
  firstWeekOrders: PlannedOrder[];
}

/** Indicadores del panel de inicio. */
export function dashboardSummary(scenario: Scenario, result: MrpResult): DashboardSummary {
  const bom = usableBomLines(scenario.items, scenario.bom);
  const leadTimes = endItemLeadTimes(scenario);
  const purchases = result.orders.filter((o) => o.type === 'compra');
  return {
    itemCount: scenario.items.length,
    productCount: endItems(scenario.items, bom).length,
    horizon: scenario.horizon,
    bomLineCount: bom.length,
    levelCount: result.records.reduce((max, r) => Math.max(max, r.level + 1), 0),
    scheduledReceiptCount: scenario.items.reduce(
      (n, i) => n + i.scheduledReceipts.slice(0, scenario.horizon).filter((q) => q > 0).length,
      0,
    ),
    orderCount: result.orders.length,
    manufacturingOrders: result.orders.length - purchases.length,
    purchaseOrders: purchases.length,
    purchaseUnits: sum(purchases.map((o) => o.quantity)),
    pastDueCount: result.orders.filter((o) => o.pastDue).length,
    critical: leadTimes.reduce<EndItemLeadTime | null>(
      (best, lt) => (best === null || lt.weeks > best.weeks ? lt : best),
      null,
    ),
    firstWeekOrders: result.orders.filter((o) => o.releaseWeek <= 1),
  };
}

export interface WeekLoad {
  /** Semana de emisión; 0 agrupa las órdenes atrasadas. */
  week: number;
  fabricacion: number;
  compra: number;
}

/** Cantidad de órdenes a emitir por semana, separadas por tipo (incluye la semana 0). */
export function ordersPerWeek(result: MrpResult): WeekLoad[] {
  const weeks: WeekLoad[] = Array.from({ length: result.horizon + 1 }, (_, week) => ({
    week,
    fabricacion: 0,
    compra: 0,
  }));
  for (const o of result.orders) {
    const w = weeks[Math.min(Math.max(0, o.releaseWeek), result.horizon)];
    w[o.type] += 1;
  }
  return weeks;
}

/**
 * Número de cada orden, en el orden de emisión: OF-001… para fabricación y OC-001… para
 * compra. Las claves son los objetos de `orders`.
 */
export function numberOrders(orders: PlannedOrder[]): Map<PlannedOrder, string> {
  const counters: Record<ItemType, number> = { fabricacion: 0, compra: 0 };
  const prefix: Record<ItemType, string> = { fabricacion: 'OF', compra: 'OC' };
  return new Map(
    orders.map((o) => {
      counters[o.type] += 1;
      return [o, `${prefix[o.type]}-${String(counters[o.type]).padStart(3, '0')}`];
    }),
  );
}

export interface WeekRange {
  from: number;
  to: number;
}

/**
 * Semanas al final del horizonte en las que ningún producto final tiene demanda (p. ej.
 * al ampliar el horizonte sin cargar el PMP). En esas semanas el MRP no tiene nada que
 * planificar. Devuelve null si la última semana tiene demanda o si no hay productos finales.
 */
export function trailingEmptyDemand(scenario: Scenario): WeekRange | null {
  const products = endItems(scenario.items, usableBomLines(scenario.items, scenario.bom));
  if (!products.length) return null;
  let from = scenario.horizon + 1;
  while (from > 1 && products.every((p) => !(p.demand[from - 2] > 0))) from--;
  return from <= scenario.horizon ? { from, to: scenario.horizon } : null;
}
