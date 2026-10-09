import { describe, expect, it } from 'vitest';
import { ejercicioOct26 } from '../../data/ejercicioOct26';
import { applyLotPolicy, describeLots } from '../lotSizing';
import { runMrp } from '../mrpEngine';
import {
  dashboardSummary,
  feasibilityAnalysis,
  numberOrders,
  orderSummaryByItem,
  ordersByReleaseWeek,
  ordersPerWeek,
  trailingEmptyDemand,
} from '../reports';

const ctx = (netRequirement: number) => ({
  period: 0,
  netRequirement,
  grossRequirements: [],
  scheduledReceipts: [],
  projectedOnHand: 0,
  safetyStock: 0,
  horizon: 1,
  initialStock: 0,
});

describe('políticas de loteo', () => {
  it('L4L pide exactamente la necesidad neta', () => {
    expect(applyLotPolicy({ kind: 'L4L' }, ctx(37))).toBe(37);
  });
  it('lote fijo redondea a múltiplos del lote', () => {
    expect(applyLotPolicy({ kind: 'FIXED', lotSize: 50 }, ctx(10))).toBe(50);
    expect(applyLotPolicy({ kind: 'FIXED', lotSize: 50 }, ctx(50))).toBe(50);
    expect(applyLotPolicy({ kind: 'FIXED', lotSize: 100 }, ctx(310))).toBe(400);
    expect(describeLots({ kind: 'FIXED', lotSize: 100 }, 400)).toBe('4 × 100');
  });
});

describe('reportes del ejercicio', () => {
  const scenario = ejercicioOct26();
  const result = runMrp(scenario);

  it('agrupa las compras por semana de emisión', () => {
    const weeks = ordersByReleaseWeek(result.orders, 'compra');
    expect(weeks[0]).toEqual({
      week: 0,
      orders: [expect.objectContaining({ itemCode: 'I', quantity: 10 })],
    });
    expect(weeks[1].week).toBe(1);
    expect(weeks[1].orders.map((o) => `${o.itemCode}:${o.quantity}`)).toEqual(['D:100', 'E:50']);
  });

  it('resume la primera orden de cada ítem', () => {
    const byCode = Object.fromEntries(orderSummaryByItem(result).map((s) => [s.itemCode, s]));
    expect(byCode.E.firstReleaseWeek).toBe(1);
    expect(byCode.F.firstReleaseWeek).toBe(2);
    expect(byCode.H.firstReleaseWeek).toBe(1);
    expect(byCode.I.firstReleaseWeek).toBe(0);
    expect(byCode.D.totalQuantity).toBe(1500);
  });

  it('informa el riesgo por lead times acumulados', () => {
    const analysis = feasibilityAnalysis(scenario, result);
    expect(analysis.firstPurchaseWeek).toBe(0);
    expect(analysis.firstPurchaseItems).toEqual(['I']);
    expect(analysis.pastDueOrders).toHaveLength(1);
    expect(analysis.leadTimes.map((l) => [l.itemCode, l.weeks])).toEqual([
      ['A', 4],
      ['B', 7],
    ]);
    expect(analysis.conclusions[0]).toBe(
      'Primeras órdenes de compra de materias primas: I en S0 (antes del horizonte), atrasada ' +
        '(10 u.; su primera orden a tiempo es en S3); D en S1 (100 u.); E en S1 (50 u.); F en S2 (100 u.).',
    );
    expect(analysis.conclusions.some((c) => c.includes('riesgo de insatisfacción'))).toBe(true);
  });
});

describe('panel de inicio', () => {
  const scenario = ejercicioOct26();
  const result = runMrp(scenario);

  it('resume los indicadores del ejercicio', () => {
    const s = dashboardSummary(scenario, result);
    expect(s).toMatchObject({
      itemCount: 9,
      productCount: 2,
      horizon: 12,
      bomLineCount: 12,
      levelCount: 4,
      scheduledReceiptCount: 5,
      orderCount: 59,
      manufacturingOrders: 34,
      purchaseOrders: 25,
      purchaseUnits: 3660,
      pastDueCount: 1,
    });
    expect(s.critical).toMatchObject({ itemCode: 'B', weeks: 7 });
    expect(s.firstWeekOrders.map((o) => o.itemCode)).toEqual(['I', 'A', 'G', 'D', 'H', 'E']);
  });

  it('cuenta las órdenes por semana de emisión', () => {
    const load = ordersPerWeek(result);
    expect(load).toHaveLength(13);
    expect(load[0]).toEqual({ week: 0, fabricacion: 0, compra: 1 });
    expect(load[1]).toEqual({ week: 1, fabricacion: 3, compra: 2 });
    expect(load.reduce((n, w) => n + w.fabricacion + w.compra, 0)).toBe(59);
  });

  it('numera las órdenes por tipo en orden de emisión', () => {
    const numbers = numberOrders(result.orders);
    const of = (code: string, week: number) =>
      numbers.get(result.orders.find((o) => o.itemCode === code && o.releaseWeek === week)!);
    expect(of('I', 0)).toBe('OC-001');
    expect(of('A', 1)).toBe('OF-001');
    expect(of('D', 1)).toBe('OC-002');
    expect(new Set(numbers.values()).size).toBe(59);
  });
});

describe('semanas sin demanda al final del horizonte', () => {
  it('el ejercicio tiene demanda hasta la semana 12', () => {
    expect(trailingEmptyDemand(ejercicioOct26())).toBeNull();
  });

  it('al ampliar el horizonte detecta las semanas nuevas sin PMP', () => {
    expect(trailingEmptyDemand({ ...ejercicioOct26(), horizon: 16 })).toEqual({ from: 13, to: 16 });
  });

  it('basta con que un producto tenga demanda para que la semana cuente', () => {
    const s = { ...ejercicioOct26(), horizon: 16 };
    s.items = s.items.map((i) => (i.code === 'A' ? { ...i, demand: [...i.demand, 25] } : i));
    expect(trailingEmptyDemand(s)).toEqual({ from: 14, to: 16 });
  });
});
