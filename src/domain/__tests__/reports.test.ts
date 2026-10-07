import { describe, expect, it } from 'vitest';
import { ejercicioOct26 } from '../../data/ejercicioOct26';
import { applyLotPolicy, describeLots } from '../lotSizing';
import { runMrp } from '../mrpEngine';
import { feasibilityAnalysis, orderSummaryByItem, ordersByReleaseWeek } from '../reports';

const ctx = (netRequirement: number) => ({
  period: 0,
  netRequirement,
  grossRequirements: [],
  scheduledReceipts: [],
  projectedOnHand: 0,
  safetyStock: 0,
  horizon: 1,
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
    expect(analysis.conclusions.some((c) => c.includes('riesgo de insatisfacción'))).toBe(true);
  });
});
