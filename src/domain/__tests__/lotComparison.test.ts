import { describe, expect, it } from 'vitest';
import { COSTOS_CATEDRA, NN_EJEMPLO_CATEDRA } from '../../data/costosCatedra';
import { ejercicioOct26 } from '../../data/ejercicioOct26';
import { compareInPlan, compareLotPolicies, evaluatePolicy, lotDecisions, recommendLotPolicies } from '../lotComparison';
import { describeOrderLot } from '../lotSizing';
import { runMrp } from '../mrpEngine';
import type { Item, LotPolicy, Scenario } from '../types';

const ejemplo = (lotPolicy: LotPolicy, patch: Partial<Item> = {}): Scenario => ({
  name: 'Ejemplo de la cátedra',
  horizon: 8,
  forecastEnabled: false,
  bom: [],
  items: [
    {
      code: 'X',
      description: 'Producto del ejemplo',
      initialStock: 0,
      leadTime: 0,
      safetyStock: 0,
      lotPolicy,
      type: 'auto',
      scheduledReceipts: [],
      demand: NN_EJEMPLO_CATEDRA,
      costs: COSTOS_CATEDRA,
      ...patch,
    },
  ],
});

const run = (lotPolicy: LotPolicy, patch?: Partial<Item>) => {
  const result = runMrp(ejemplo(lotPolicy, patch));
  return { result, record: result.records[0] };
};

const total = (lotPolicy: LotPolicy, patch?: Partial<Item>) => {
  const { record } = run(lotPolicy, patch);
  return evaluatePolicy(record, record.costs!);
};

describe('técnicas de loteo en el motor MRP (ejemplo de la cátedra)', () => {
  it('L4L: una orden por semana, $376', () => {
    const { record } = run({ kind: 'L4L' });
    expect(record.rop).toEqual(NN_EJEMPLO_CATEDRA);
    expect(total({ kind: 'L4L' }).totalCost).toBeCloseTo(376, 6);
  });

  it('LTC: 335 en S1 y 190 en S6, $140,50', () => {
    const { result, record } = run({ kind: 'LTC' });
    expect(record.rop).toEqual([335, 0, 0, 0, 0, 190, 0, 0]);
    expect(record.d).toEqual([285, 225, 155, 95, 0, 115, 55, 0]);
    const e = total({ kind: 'LTC' });
    expect(e.holdingCost).toBeCloseTo(46.5, 6);
    expect(e.orderingCost).toBe(94);
    expect(e.totalCost).toBeCloseTo(140.5, 6);
    expect(result.orders.map((o) => o.coversThrough)).toEqual([5, 8]);
    expect(result.orders.map(describeOrderLot)).toEqual(['LTC · S1–S5', 'LTC · S6–S8']);
  });

  it('LUC: 410 en S1 y 115 en S7, $153,50', () => {
    const { result, record } = run({ kind: 'LUC' });
    expect(record.rop).toEqual([410, 0, 0, 0, 0, 0, 115, 0]);
    const e = total({ kind: 'LUC' });
    expect(e.holdingCost).toBeCloseTo(59.5, 6);
    expect(e.totalCost).toBeCloseTo(153.5, 6);
    expect(result.orders.map((o) => o.coversThrough)).toEqual([6, 8]);
  });

  it('EOQ: 351 en S1 y S6, $171,05', () => {
    const { result, record } = run({ kind: 'EOQ' });
    expect(record.rop).toEqual([351, 0, 0, 0, 0, 351, 0, 0]);
    expect(record.d).toEqual([301, 241, 171, 111, 16, 292, 232, 177]);
    expect(total({ kind: 'EOQ' }).totalCost).toBeCloseTo(171.05, 6);
    expect(result.orders.map((o) => o.coversThrough)).toEqual([5, 8]);
  });

  it('EOQ pide la necesidad neta cuando es mayor que la cantidad económica', () => {
    // Promedio 50 u./semana → D = 2.600, EOQ = √(2 × 2.600 × 47 ÷ 2,60) ≈ 307; la semana 1 necesita 400.
    const { record } = run({ kind: 'EOQ' }, { demand: [400, 0, 0, 0, 0, 0, 0, 0] });
    expect(record.rop[0]).toBe(400);
  });

  it('el stock de seguridad suma el mismo costo de mantener a todas las técnicas', () => {
    // 10 u. de stock de seguridad durante 8 semanas: 10 × 8 × $0,05 = $4.
    const ss = { safetyStock: 10 };
    expect(run({ kind: 'LTC' }, ss).record.rop).toEqual([345, 0, 0, 0, 0, 190, 0, 0]);
    expect(total({ kind: 'L4L' }, ss).totalCost).toBeCloseTo(380, 6);
    expect(total({ kind: 'LTC' }, ss).totalCost).toBeCloseTo(144.5, 6);
    expect(compareLotPolicies(run({ kind: 'L4L' }, ss).record, 8)!.baseHolding).toBeCloseTo(4, 6);
  });
});

describe('sin costos', () => {
  it('una técnica por costos calcula lote por lote y avisa', () => {
    const { result, record } = run({ kind: 'LTC' }, { costs: undefined });
    expect(record.rop).toEqual(NN_EJEMPLO_CATEDRA);
    expect(record.lotPolicy).toEqual({ kind: 'L4L' });
    expect(result.issues).toEqual([
      expect.objectContaining({ severity: 'warning', itemCode: 'X', message: expect.stringContaining('LTC necesita') }),
    ]);
    expect(compareLotPolicies(record, 8)).toBeNull();
  });
  it('los costos negativos son un error', () => {
    const { result } = run({ kind: 'L4L' }, { costs: { unitCost: -1, orderCost: 47, holdingRate: 26 } });
    expect(result.issues.some((i) => i.severity === 'error' && i.message.includes('negativos'))).toBe(true);
  });
});

describe('comparación de técnicas', () => {
  it('compara todas las técnicas y recomienda LTC', () => {
    const { record } = run({ kind: 'FIXED', lotSize: 100 });
    const cmp = compareLotPolicies(record, 8)!;
    expect(cmp.options.map((o) => o.policy.kind)).toEqual(['L4L', 'FIXED', 'EOQ', 'LTC', 'LUC']);
    expect(cmp.options.map((o) => Math.round(o.evaluation.totalCost * 100) / 100)).toEqual([
      376,
      expect.any(Number),
      171.05,
      140.5,
      153.5,
    ]);
    expect(cmp.best.policy.kind).toBe('LTC');
    expect(cmp.current.policy).toEqual({ kind: 'FIXED', lotSize: 100 });
    expect(cmp.eoq.quantity).toBe(351);
    expect(cmp.baseHolding).toBe(0);
  });

  it('arma las tablas de lotes de prueba de cada pedido', () => {
    const { record } = run({ kind: 'LUC' });
    const decisions = lotDecisions(record, 'LUC', 8);
    expect(decisions.map((d) => [d.week, d.choice.quantity, d.choice.rows.length])).toEqual([
      [1, 410, 7],
      [7, 115, 2],
    ]);
  });
});

describe('ejercicio con los costos de la cátedra', () => {
  const conCostos = (lotPolicy?: LotPolicy): Scenario => {
    const s = ejercicioOct26();
    return {
      ...s,
      items: s.items.map((i) => ({ ...i, costs: COSTOS_CATEDRA, ...(lotPolicy ? { lotPolicy } : {}) })),
    };
  };

  it('los costos no cambian el resultado con las políticas de la consigna', () => {
    const base = runMrp(ejercicioOct26());
    const withCosts = runMrp(conCostos());
    expect(withCosts.records.map((r) => r.rop)).toEqual(base.records.map((r) => r.rop));
  });

  it.each(['EOQ', 'LTC', 'LUC'] as const)('%s calcula todos los ítems sin errores', (kind) => {
    const result = runMrp(conCostos({ kind }));
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
    for (const r of result.records) {
      expect(r.d.every((d) => d >= r.safetyStock)).toBe(true);
      expect(r.rop.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(r.nn.reduce((a, b) => a + b, 0));
    }
  });

  it('las recomendaciones quedan estables después de aplicarlas', () => {
    const scenario = conCostos();
    const changes = recommendLotPolicies(scenario);
    expect(Object.keys(changes).length).toBeGreaterThan(0);
    const applied: Scenario = {
      ...scenario,
      items: scenario.items.map((i) => (changes[i.code] ? { ...i, lotPolicy: changes[i.code] } : i)),
    };
    expect(recommendLotPolicies(applied)).toEqual({});
    for (const cmp of compareInPlan(applied, runMrp(applied)).values()) {
      expect(cmp!.best).toBe(cmp!.current);
    }
  });

  it('no recomienda técnicas que dejan órdenes atrasadas en los componentes', () => {
    const scenario = conCostos();
    const pastDue = (s: Scenario) => runMrp(s).records.reduce((n, r) => n + r.pastDueRelease, 0);
    const changes = recommendLotPolicies(scenario);
    const applied: Scenario = {
      ...scenario,
      items: scenario.items.map((i) => (changes[i.code] ? { ...i, lotPolicy: changes[i.code] } : i)),
    };
    expect(pastDue(applied)).toBeLessThanOrEqual(pastDue(scenario));
    // Pedir A con LUC es lo más barato para A solo, pero deja atrasados a sus componentes.
    const a = compareInPlan(scenario, runMrp(scenario)).get('A')!;
    const luc = a.options.find((o) => o.policy.kind === 'LUC')!;
    expect(luc.evaluation.totalCost).toBeLessThan(a.best.evaluation.totalCost);
    expect(luc.extraPastDue).toBeGreaterThan(0);
  });

  it('el ítem I no recomienda agrandar su orden atrasada', () => {
    const scenario = conCostos();
    const i = compareInPlan(scenario, runMrp(scenario)).get('I')!;
    expect(i.options.find((o) => o.policy.kind === 'LTC')!.extraPastDue).toBe(100);
    expect(i.best.policy.kind).toBe('L4L');
  });
});
