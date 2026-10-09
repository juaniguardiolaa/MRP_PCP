import {
  costsComplete,
  economicOrderQuantity,
  holdingCostPerWeek,
  l4lNetRequirements,
  leastTotalCostLot,
  leastUnitCostLot,
} from './economicLot';
import type { Item, ItemCosts, LotPolicy, LotPolicyKind, PlannedOrder } from './types';

/**
 * Información que recibe una política de loteo al decidir cuánto pedir en un período.
 * Incluye la serie completa de NB y RP para que las técnicas que agrupan períodos
 * futuros (EOQ, LTC, LUC) decidan sin tocar el motor.
 */
export interface LotSizingContext {
  /** Índice del período (0 = semana 1). */
  period: number;
  /** Necesidad neta del período (NN_t > 0). */
  netRequirement: number;
  grossRequirements: readonly number[];
  scheduledReceipts: readonly number[];
  /** Inventario proyectado al cierre del período anterior (D_{t-1}). */
  projectedOnHand: number;
  safetyStock: number;
  horizon: number;
  /** Stock inicial del ítem (D_0), para estimar la demanda de la EOQ. */
  initialStock: number;
  costs?: ItemCosts;
}

interface LotSizingRule<P extends LotPolicy> {
  /** Nombre completo, para los selectores. */
  label: string;
  /** Sigla o nombre corto, para tablas y tarjetas. */
  short: string;
  /** Qué hace la técnica, en una frase. */
  help: string;
  /** Necesita costos (si faltan, el motor calcula lote por lote). */
  needsCosts: boolean;
  describe: (policy: P) => string;
  /** Cantidad a recibir en el período (ROP_t). Debe ser ≥ netRequirement. */
  decide: (ctx: LotSizingContext, policy: P) => number;
}

type Rules = { [K in LotPolicyKind]: LotSizingRule<Extract<LotPolicy, { kind: K }>> };

/** Necesidades netas lote por lote desde el período actual, para evaluar lotes de prueba. */
const lookahead = (ctx: LotSizingContext) =>
  l4lNetRequirements(
    ctx.grossRequirements,
    ctx.scheduledReceipts,
    ctx.safetyStock,
    ctx.projectedOnHand,
    ctx.period,
    ctx.horizon,
  );

export const lotSizingRules: Rules = {
  L4L: {
    label: 'Lote por lote (L4L)',
    short: 'L4L',
    help: 'Pide exactamente la necesidad neta de cada semana.',
    needsCosts: false,
    describe: () => 'L4L',
    decide: (ctx) => ctx.netRequirement,
  },
  FIXED: {
    label: 'Lote fijo',
    short: 'Lote fijo',
    help: 'Pide múltiplos del tamaño de lote: si falta más que un lote, pide varios.',
    needsCosts: false,
    describe: (p) => `Lote fijo de ${p.lotSize}`,
    // Si la necesidad neta supera el lote, se piden tantos lotes como hagan falta.
    decide: (ctx, p) =>
      p.lotSize > 0 ? Math.ceil(ctx.netRequirement / p.lotSize) * p.lotSize : ctx.netRequirement,
  },
  EOQ: {
    label: 'Cantidad económica de pedido (EOQ)',
    short: 'EOQ',
    help:
      'Pide siempre la cantidad económica √(2·D·S/H), calculada con la demanda promedio del horizonte. ' +
      'Si la necesidad neta es mayor, pide la necesidad neta.',
    needsCosts: true,
    describe: () => 'EOQ (cantidad económica)',
    decide: (ctx) => {
      if (!costsComplete(ctx.costs)) return ctx.netRequirement;
      const base = l4lNetRequirements(
        ctx.grossRequirements,
        ctx.scheduledReceipts,
        ctx.safetyStock,
        ctx.initialStock,
        0,
        ctx.horizon,
      );
      return Math.max(economicOrderQuantity(base, ctx.costs)?.quantity ?? 0, ctx.netRequirement);
    },
  },
  LTC: {
    label: 'Costo total mínimo (LTC)',
    short: 'LTC',
    help: 'Agrupa semanas en un mismo lote hasta que el costo de mantener se iguala con el costo de pedir.',
    needsCosts: true,
    describe: () => 'LTC (costo total mínimo)',
    decide: (ctx) =>
      costsComplete(ctx.costs)
        ? leastTotalCostLot(lookahead(ctx), ctx.period + 1, holdingCostPerWeek(ctx.costs), ctx.costs.orderCost)
            .quantity
        : ctx.netRequirement,
  },
  LUC: {
    label: 'Costo unitario mínimo (LUC)',
    short: 'LUC',
    help: 'Agrupa semanas en un mismo lote mientras baja el costo por unidad (mantener más pedir, dividido la cantidad).',
    needsCosts: true,
    describe: () => 'LUC (costo unitario mínimo)',
    decide: (ctx) =>
      costsComplete(ctx.costs)
        ? leastUnitCostLot(lookahead(ctx), ctx.period + 1, holdingCostPerWeek(ctx.costs), ctx.costs.orderCost)
            .quantity
        : ctx.netRequirement,
  },
};

/** Políticas en el orden en que se muestran. */
export const LOT_POLICY_KINDS: LotPolicyKind[] = ['L4L', 'FIXED', 'EOQ', 'LTC', 'LUC'];

const ruleFor = (policy: LotPolicy) => lotSizingRules[policy.kind] as unknown as LotSizingRule<LotPolicy>;

export function applyLotPolicy(policy: LotPolicy, ctx: LotSizingContext): number {
  return ruleFor(policy).decide(ctx, policy);
}

export function describeLotPolicy(policy: LotPolicy): string {
  return ruleFor(policy).describe(policy);
}

export function lotPolicyShort(policy: LotPolicy): string {
  return policy.kind === 'FIXED' ? `Lote fijo ${policy.lotSize}` : lotSizingRules[policy.kind].short;
}

/** EOQ, LTC y LUC necesitan costos. */
export function isEconomicKind(kind: LotPolicyKind): boolean {
  return lotSizingRules[kind].needsCosts;
}

/** Política con la que calcula el motor: lote por lote si la técnica necesita costos que faltan. */
export function effectiveLotPolicy(item: Pick<Item, 'lotPolicy' | 'costs'>): LotPolicy {
  return isEconomicKind(item.lotPolicy.kind) && !costsComplete(item.costs) ? { kind: 'L4L' } : item.lotPolicy;
}

export function samePolicy(a: LotPolicy, b: LotPolicy): boolean {
  if (a.kind === 'FIXED' && b.kind === 'FIXED') return a.lotSize === b.lotSize;
  return a.kind === b.kind;
}

/** Texto "4 × 100" para una cantidad pedida con lote fijo. */
export function describeLots(policy: LotPolicy, quantity: number): string | null {
  if (policy.kind !== 'FIXED' || policy.lotSize <= 0) return null;
  return `${quantity / policy.lotSize} × ${policy.lotSize}`;
}

/** Cómo se armó la cantidad de una orden: "4 × 100", "L4L" o "LTC · S1–S5" (semanas que cubre). */
export function describeOrderLot(
  order: Pick<PlannedOrder, 'lotPolicy' | 'quantity' | 'receiptWeek' | 'coversThrough'>,
): string {
  const { lotPolicy } = order;
  if (lotPolicy.kind === 'FIXED') return describeLots(lotPolicy, order.quantity) ?? 'Lote fijo';
  if (lotPolicy.kind === 'L4L') return 'L4L';
  const short = lotSizingRules[lotPolicy.kind].short;
  return order.coversThrough > order.receiptWeek
    ? `${short} · S${order.receiptWeek}–S${order.coversThrough}`
    : short;
}
