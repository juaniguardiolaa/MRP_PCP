import type { LotPolicy, LotPolicyKind } from './types';

/**
 * Información que recibe una política de loteo al decidir cuánto pedir en un período.
 * Incluye la serie completa de NB y RP para que las técnicas que agrupan períodos
 * futuros (EOQ, LTC, LUC, POQ – próxima etapa) puedan implementarse sin tocar el motor.
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
}

interface LotSizingRule<P extends LotPolicy> {
  label: string;
  describe: (policy: P) => string;
  /** Cantidad a recibir en el período (ROP_t). Debe ser ≥ netRequirement. */
  decide: (ctx: LotSizingContext, policy: P) => number;
}

type Rules = { [K in LotPolicyKind]: LotSizingRule<Extract<LotPolicy, { kind: K }>> };

export const lotSizingRules: Rules = {
  L4L: {
    label: 'Lote por lote (L4L)',
    describe: () => 'L4L',
    decide: (ctx) => ctx.netRequirement,
  },
  FIXED: {
    label: 'Lote fijo',
    describe: (p) => `Lote fijo de ${p.lotSize}`,
    // Si la necesidad neta supera el lote, se piden tantos lotes como hagan falta.
    decide: (ctx, p) =>
      p.lotSize > 0 ? Math.ceil(ctx.netRequirement / p.lotSize) * p.lotSize : ctx.netRequirement,
  },
};

export function applyLotPolicy(policy: LotPolicy, ctx: LotSizingContext): number {
  switch (policy.kind) {
    case 'L4L':
      return lotSizingRules.L4L.decide(ctx, policy);
    case 'FIXED':
      return lotSizingRules.FIXED.decide(ctx, policy);
  }
}

export function describeLotPolicy(policy: LotPolicy): string {
  switch (policy.kind) {
    case 'L4L':
      return lotSizingRules.L4L.describe(policy);
    case 'FIXED':
      return lotSizingRules.FIXED.describe(policy);
  }
}

/** Texto "4 × 100" para una cantidad pedida con lote fijo. */
export function describeLots(policy: LotPolicy, quantity: number): string | null {
  if (policy.kind !== 'FIXED' || policy.lotSize <= 0) return null;
  return `${quantity / policy.lotSize} × ${policy.lotSize}`;
}
