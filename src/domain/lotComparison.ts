import {
  costsComplete,
  economicOrderQuantity,
  holdingCostPerWeek,
  l4lNetRequirements,
  leastTotalCostLot,
  leastUnitCostLot,
  type EoqCalc,
  type LotChoice,
} from './economicLot';
import { samePolicy } from './lotSizing';
import { runMrp } from './mrpEngine';
import type { Item, ItemCosts, LotPolicy, MrpRecord, MrpResult, Scenario } from './types';

/**
 * Comparación de técnicas de loteo para un ítem. Cada técnica se calcula con el mismo motor
 * MRP, sobre el ítem solo y con sus necesidades brutas actuales: así los números coinciden con
 * la explosión MRP. La comparación es por ítem: si cambia la política de un padre, cambian las
 * necesidades brutas de sus componentes.
 */

/** Registro MRP del ítem con otra política de loteo y las mismas NB y RP. */
export function simulatePolicy(record: MrpRecord, policy: LotPolicy, horizon: number): MrpRecord | null {
  const item: Item = {
    code: record.code,
    description: record.description,
    initialStock: record.initialStock,
    leadTime: record.leadTime,
    safetyStock: record.safetyStock,
    lotPolicy: policy,
    type: record.type,
    scheduledReceipts: record.rp,
    demand: record.nb,
    ...(record.costs ? { costs: record.costs } : {}),
  };
  const result = runMrp({ name: record.code, horizon, forecastEnabled: false, items: [item], bom: [] });
  return result.records[0] ?? null;
}

export interface WeekCost {
  week: number;
  nb: number;
  nn: number;
  /** Cantidad recibida por órdenes planificadas (ROP). */
  quantity: number;
  /** Inventario al cierre (D). */
  ending: number;
  holding: number;
  ordering: number;
  cumulative: number;
}

export interface PolicyEvaluation {
  policy: LotPolicy;
  record: MrpRecord;
  weeks: WeekCost[];
  orders: number;
  holdingCost: number;
  orderingCost: number;
  totalCost: number;
  /** Cantidad de órdenes que debieron emitirse antes de la semana 1. */
  pastDueQuantity: number;
}

/** Costo semana a semana: mantener = D_t · h; pedir = S en cada semana con ROP > 0. */
export function evaluatePolicy(record: MrpRecord, costs: ItemCosts): PolicyEvaluation {
  const h = holdingCostPerWeek(costs);
  let cumulative = 0;
  let holdingCost = 0;
  let orders = 0;
  const weeks = record.nb.map((nb, t) => {
    const holding = Math.max(0, record.d[t]) * h;
    const ordering = record.rop[t] > 0 ? costs.orderCost : 0;
    if (ordering) orders++;
    holdingCost += holding;
    cumulative += holding + ordering;
    return {
      week: t + 1,
      nb,
      nn: record.nn[t],
      quantity: record.rop[t],
      ending: record.d[t],
      holding,
      ordering,
      cumulative,
    };
  });
  const orderingCost = orders * costs.orderCost;
  return {
    policy: record.lotPolicy,
    record,
    weeks,
    orders,
    holdingCost,
    orderingCost,
    totalCost: holdingCost + orderingCost,
    pastDueQuantity: record.pastDueRelease,
  };
}

export interface LotDecision {
  /** Semana en que se recibe el lote. */
  week: number;
  choice: LotChoice;
}

/** Tablas de lotes de prueba de cada pedido, como en la presentación de la cátedra. */
export function lotDecisions(record: MrpRecord, kind: 'LTC' | 'LUC', horizon: number): LotDecision[] {
  if (!costsComplete(record.costs)) return [];
  const h = holdingCostPerWeek(record.costs);
  const S = record.costs.orderCost;
  const choose = kind === 'LTC' ? leastTotalCostLot : leastUnitCostLot;
  const decisions: LotDecision[] = [];
  for (let t = 0; t < horizon; t++) {
    if (!(record.rop[t] > 0)) continue;
    const onHand = t > 0 ? record.d[t - 1] : record.initialStock;
    const nets = l4lNetRequirements(record.nb, record.rp, record.safetyStock, onHand, t, horizon);
    decisions.push({ week: t + 1, choice: choose(nets, t + 1, h, S) });
  }
  return decisions;
}

/** EOQ del ítem con sus necesidades netas lote por lote del horizonte. */
export function eoqForRecord(record: MrpRecord, horizon: number): EoqCalc | null {
  if (!costsComplete(record.costs)) return null;
  const base = l4lNetRequirements(record.nb, record.rp, record.safetyStock, record.initialStock, 0, horizon);
  return economicOrderQuantity(base, record.costs);
}

export interface LotOption {
  policy: LotPolicy;
  evaluation: PolicyEvaluation;
  /**
   * Unidades que la técnica suma a las órdenes atrasadas respecto del lote por lote: del ítem
   * o, si se compara dentro del plan, de todo el plan (el ítem y sus componentes).
   */
  extraPastDue: number;
}

export interface LotComparison {
  code: string;
  costs: ItemCosts;
  /** Costo de mantener por unidad y semana. */
  h: number;
  eoq: EoqCalc;
  options: LotOption[];
  /** La más económica entre las que no suman órdenes atrasadas. */
  best: LotOption;
  current: LotOption;
  /**
   * Costo de mantener del lote por lote: corresponde al stock que ya existe (stock inicial,
   * entregas programadas, stock de seguridad) y es igual en todas las técnicas.
   */
  baseHolding: number;
}

const TOLERANCE = 1e-6;

const withPolicies = (scenario: Scenario, policies: Record<string, LotPolicy>): Scenario => ({
  ...scenario,
  items: scenario.items.map((i) => (policies[i.code] ? { ...i, lotPolicy: policies[i.code] } : i)),
});

const totalPastDue = (result: MrpResult) => result.records.reduce((n, r) => n + r.pastDueRelease, 0);

/**
 * Costo de cada técnica para el ítem y la recomendada: la más económica entre las que no suman
 * órdenes atrasadas (en un empate gana la actual). Con `plan`, las órdenes atrasadas se cuentan
 * en todo el plan, porque un lote grande de un padre puede dejar atrasados a sus componentes.
 */
export function compareLotPolicies(record: MrpRecord, horizon: number, plan?: Scenario): LotComparison | null {
  const costs = record.costs;
  const eoq = eoqForRecord(record, horizon);
  if (!costsComplete(costs) || !eoq) return null;
  const policies: LotPolicy[] = [
    { kind: 'L4L' },
    ...(record.lotPolicy.kind === 'FIXED' ? [record.lotPolicy] : []),
    { kind: 'EOQ' },
    { kind: 'LTC' },
    { kind: 'LUC' },
  ];
  const options: LotOption[] = [];
  for (const policy of policies) {
    const sim = simulatePolicy(record, policy, horizon);
    if (sim) options.push({ policy, evaluation: evaluatePolicy(sim, costs), extraPastDue: 0 });
  }
  if (!options.length) return null;
  const pastDue = (o: LotOption) =>
    plan ? totalPastDue(runMrp(withPolicies(plan, { [record.code]: o.policy }))) : o.evaluation.pastDueQuantity;
  const basePastDue = pastDue(options[0]);
  for (const o of options) o.extraPastDue = Math.max(0, pastDue(o) - basePastDue);
  const eligible = (o: LotOption) => o.extraPastDue <= TOLERANCE;
  const current = options.find((o) => samePolicy(o.policy, record.lotPolicy)) ?? options[0];
  let best = eligible(current) ? current : options[0];
  for (const o of options) {
    if (eligible(o) && o.evaluation.totalCost < best.evaluation.totalCost - TOLERANCE) best = o;
  }
  return {
    code: record.code,
    costs,
    h: holdingCostPerWeek(costs),
    eoq,
    options,
    best,
    current,
    baseHolding: options[0].evaluation.holdingCost,
  };
}

/** Comparación de cada ítem dentro del plan (órdenes atrasadas contadas en todo el plan). */
export function compareInPlan(scenario: Scenario, result: MrpResult): Map<string, LotComparison | null> {
  return new Map(result.records.map((r) => [r.code, compareLotPolicies(r, scenario.horizon, scenario)] as const));
}

/**
 * Técnica más económica de cada ítem con costos, decidida de arriba hacia abajo: primero los
 * productos finales y después cada nivel con las necesidades que generan las políticas ya
 * elegidas para sus padres. No elige técnicas que sumen órdenes atrasadas al plan. Devuelve
 * solo los ítems cuya política cambia.
 */
export function recommendLotPolicies(scenario: Scenario): Record<string, LotPolicy> {
  const changes: Record<string, LotPolicy> = {};
  let result = runMrp(scenario);
  if (!result.records.length) return changes;
  const levels = [...new Set(result.records.map((r) => r.level))].sort((a, b) => a - b);
  for (const level of levels) {
    let changed = false;
    for (const record of result.records.filter((r) => r.level === level)) {
      const comparison = compareLotPolicies(record, scenario.horizon, withPolicies(scenario, changes));
      if (comparison && !samePolicy(comparison.best.policy, record.lotPolicy)) {
        changes[record.code] = comparison.best.policy;
        changed = true;
      }
    }
    if (changed) result = runMrp(withPolicies(scenario, changes));
  }
  return changes;
}
