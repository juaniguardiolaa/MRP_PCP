import type { ItemCosts } from './types';

/**
 * Técnicas de tamaño de lote por costos (material de la cátedra, "Determinación del tamaño
 * de los lotes"): cantidad económica de pedido (EOQ), costo total mínimo (LTC) y costo
 * unitario mínimo (LUC).
 *
 * Notación:
 *   C – costo unitario ($/u.)
 *   S – costo de pedido o de preparación ($/orden)
 *   i – costo de mantener, en % anual de C
 *   H – costo de mantener una unidad durante un año = C · i / 100
 *   h – costo de mantener una unidad durante una semana = H / 52
 */

export const WEEKS_PER_YEAR = 52;

const EPS = 1e-9;

const NO_COSTS: ItemCosts = { unitCost: 0, orderCost: 0, holdingRate: 0 };

/** Costos con un campo cambiado (si el ítem no tenía costos, los demás quedan en 0). */
export function withCost(costs: ItemCosts | undefined, field: keyof ItemCosts, value: number): ItemCosts {
  return { ...(costs ?? NO_COSTS), [field]: value };
}

/** Las técnicas por costos necesitan C, S e i mayores que 0. */
export function costsComplete(costs: ItemCosts | undefined | null): costs is ItemCosts {
  return !!costs && costs.unitCost > 0 && costs.orderCost > 0 && costs.holdingRate > 0;
}

/** H: costo de mantener una unidad durante un año. */
export function annualHoldingCost(costs: ItemCosts): number {
  return (costs.unitCost * costs.holdingRate) / 100;
}

/** h: costo de mantener una unidad durante una semana. */
export function holdingCostPerWeek(costs: ItemCosts): number {
  return (costs.unitCost * costs.holdingRate) / (100 * WEEKS_PER_YEAR);
}

/**
 * Necesidades netas semana a semana pidiendo lote por lote, desde la semana `from`
 * (índice 0 = semana 1) con `onHand` unidades disponibles al cierre de la semana anterior.
 * Si un lote cubre las semanas t..t+k−1, las necesidades netas siguientes no cambian, así
 * que esta serie sirve para evaluar todos los tamaños de lote posibles desde t.
 */
export function l4lNetRequirements(
  grossRequirements: readonly number[],
  scheduledReceipts: readonly number[],
  safetyStock: number,
  onHand: number,
  from = 0,
  horizon = grossRequirements.length,
): number[] {
  const out: number[] = [];
  let d = onHand;
  for (let t = from; t < horizon; t++) {
    const available = d + (scheduledReceipts[t] ?? 0);
    const nb = grossRequirements[t] ?? 0;
    const net = Math.max(0, nb + safetyStock - available);
    out.push(net);
    d = available + net - nb;
  }
  return out;
}

/** Un tamaño de lote de prueba: pedir en `firstWeek` lo necesario hasta `lastWeek`. */
export interface LotCandidate {
  firstWeek: number;
  lastWeek: number;
  quantity: number;
  holdingCost: number;
  orderCost: number;
  totalCost: number;
  /** (mantener + pedir) / cantidad. */
  unitCost: number;
}

export interface LotChoice {
  /** Filas evaluadas, como en la tabla de la cátedra. */
  rows: LotCandidate[];
  /** Índice de la fila elegida. */
  chosen: number;
  quantity: number;
}

/**
 * Recorre los lotes de prueba desde la semana `firstWeek`: el k-ésimo cubre las semanas
 * firstWeek..firstWeek+k−1. Las unidades de la semana j se mantienen (j − firstWeek) semanas.
 * `visit` devuelve false para dejar de evaluar.
 */
function evaluateCandidates(
  nets: readonly number[],
  firstWeek: number,
  h: number,
  S: number,
  visit: (row: LotCandidate, index: number, rows: readonly LotCandidate[]) => boolean,
): LotCandidate[] {
  const rows: LotCandidate[] = [];
  let quantity = 0;
  let holding = 0;
  for (let k = 0; k < nets.length; k++) {
    quantity += nets[k];
    holding += nets[k] * k * h;
    const row: LotCandidate = {
      firstWeek,
      lastWeek: firstWeek + k,
      quantity,
      holdingCost: holding,
      orderCost: S,
      totalCost: holding + S,
      unitCost: quantity > 0 ? (holding + S) / quantity : Infinity,
    };
    rows.push(row);
    if (!visit(row, k, rows)) break;
  }
  return rows;
}

/**
 * Costo total mínimo (LTC): se elige el lote en el que el costo de mantener y el de pedir
 * son más parecidos. Se evalúa hasta el primer lote en que mantener alcanza a S (como el costo
 * de mantener nunca baja, después la diferencia solo crece). Si hay empate, el lote más chico.
 */
export function leastTotalCostLot(nets: readonly number[], firstWeek: number, h: number, S: number): LotChoice {
  let chosen = 0;
  const rows = evaluateCandidates(nets, firstWeek, h, S, (row, k, seen) => {
    if (Math.abs(row.holdingCost - S) < Math.abs(seen[chosen].holdingCost - S) - EPS) chosen = k;
    return row.holdingCost < S - EPS;
  });
  return { rows, chosen, quantity: rows[chosen]?.quantity ?? 0 };
}

/**
 * Costo unitario mínimo (LUC): se elige el lote con el menor costo por unidad. Se evalúa hasta
 * que el costo unitario sube; las semanas sin necesidad no lo cambian y el recorrido sigue.
 * Si hay empate, el lote más chico.
 */
export function leastUnitCostLot(nets: readonly number[], firstWeek: number, h: number, S: number): LotChoice {
  let chosen = 0;
  const rows = evaluateCandidates(nets, firstWeek, h, S, (row, k, seen) => {
    const previous = k > 0 ? seen[k - 1].unitCost : Infinity;
    if (row.unitCost > previous + EPS) return false;
    if (row.unitCost < seen[chosen].unitCost - EPS) chosen = k;
    return true;
  });
  return { rows, chosen, quantity: rows[chosen]?.quantity ?? 0 };
}

/** Datos y resultado de la fórmula EOQ = √(2·D·S / H). */
export interface EoqCalc {
  /** Suma de las necesidades netas del horizonte (lote por lote). */
  totalNet: number;
  weeks: number;
  averageWeekly: number;
  /** D: demanda anual estimada = promedio semanal × 52. */
  annualDemand: number;
  orderCost: number;
  /** H: costo anual de mantener una unidad. */
  annualHolding: number;
  /** Valor exacto de la fórmula. */
  exact: number;
  /** EOQ redondeada a unidades enteras. */
  quantity: number;
}

/**
 * Cantidad económica de pedido con la demanda anual estimada a partir de las necesidades
 * netas del horizonte (como en el ejemplo de la cátedra: 525 u. en 8 semanas → 3.412,5 u./año).
 */
export function economicOrderQuantity(baseNets: readonly number[], costs: ItemCosts): EoqCalc | null {
  if (!costsComplete(costs)) return null;
  const totalNet = baseNets.reduce((a, b) => a + b, 0);
  const weeks = baseNets.length;
  const averageWeekly = weeks ? totalNet / weeks : 0;
  const annualDemand = averageWeekly * WEEKS_PER_YEAR;
  const annualHolding = annualHoldingCost(costs);
  const exact = Math.sqrt((2 * annualDemand * costs.orderCost) / annualHolding);
  return {
    totalNet,
    weeks,
    averageWeekly,
    annualDemand,
    orderCost: costs.orderCost,
    annualHolding,
    exact,
    quantity: annualDemand > 0 ? Math.max(1, Math.round(exact)) : 0,
  };
}
