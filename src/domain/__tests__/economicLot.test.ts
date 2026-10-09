import { describe, expect, it } from 'vitest';
import { COSTOS_CATEDRA, NN_EJEMPLO_CATEDRA } from '../../data/costosCatedra';
import {
  annualHoldingCost,
  costsComplete,
  economicOrderQuantity,
  holdingCostPerWeek,
  l4lNetRequirements,
  leastTotalCostLot,
  leastUnitCostLot,
} from '../economicLot';

const h = holdingCostPerWeek(COSTOS_CATEDRA);
const S = COSTOS_CATEDRA.orderCost;

describe('costos de la cátedra', () => {
  it('convierte el % anual a costo semanal y anual por unidad', () => {
    expect(h).toBeCloseTo(0.05, 10);
    expect(annualHoldingCost(COSTOS_CATEDRA)).toBeCloseTo(2.6, 10);
  });
  it('exige C, S e i mayores que 0', () => {
    expect(costsComplete(COSTOS_CATEDRA)).toBe(true);
    expect(costsComplete(undefined)).toBe(false);
    expect(costsComplete({ unitCost: 10, orderCost: 0, holdingRate: 26 })).toBe(false);
  });
});

describe('necesidades netas lote por lote', () => {
  it('considera stock disponible, entregas programadas y stock de seguridad', () => {
    expect(l4lNetRequirements([10, 10, 10], [0, 15, 0], 5, 12)).toEqual([3, 0, 5]);
  });
  it('arranca desde la semana indicada', () => {
    expect(l4lNetRequirements(NN_EJEMPLO_CATEDRA, [], 0, 0, 5)).toEqual([75, 60, 55]);
  });
});

describe('costo total mínimo (LTC)', () => {
  it('reproduce la tabla de la cátedra desde la semana 1', () => {
    const choice = leastTotalCostLot(NN_EJEMPLO_CATEDRA, 1, h, S);
    expect(choice.rows.map((r) => [r.lastWeek, r.quantity])).toEqual([
      [1, 50],
      [2, 110],
      [3, 180],
      [4, 240],
      [5, 335],
      [6, 410],
    ]);
    const holding = [0, 3, 10, 19, 38, 56.75];
    choice.rows.forEach((r, i) => expect(r.holdingCost).toBeCloseTo(holding[i], 6));
    expect(choice.chosen).toBe(4);
    expect(choice.quantity).toBe(335);
  });
  it('al final del horizonte elige el mejor lote evaluado', () => {
    const choice = leastTotalCostLot([75, 60, 55], 6, h, S);
    expect(choice.rows.map((r) => r.holdingCost)).toEqual([0, expect.closeTo(3, 6), expect.closeTo(8.5, 6)]);
    expect(choice.quantity).toBe(190);
  });
  it('en un empate elige el lote más chico', () => {
    // H = 0, 5, 15 con S = 10: |5 − 10| = |15 − 10|.
    expect(leastTotalCostLot([10, 5, 5], 1, 1, 10).quantity).toBe(15);
  });
  it('sin costo de pedir pide lote por lote', () => {
    expect(leastTotalCostLot([10, 20, 30], 1, 0.05, 0).quantity).toBe(10);
  });
});

describe('costo unitario mínimo (LUC)', () => {
  it('reproduce la tabla de la cátedra desde la semana 1', () => {
    const choice = leastUnitCostLot(NN_EJEMPLO_CATEDRA, 1, h, S);
    const unit = [0.94, 0.4545, 0.3167, 0.275, 0.2537, 0.253, 0.259];
    expect(choice.rows).toHaveLength(7);
    choice.rows.forEach((r, i) => expect(r.unitCost).toBeCloseTo(unit[i], 4));
    expect(choice.chosen).toBe(5);
    expect(choice.quantity).toBe(410);
  });
  it('elige el lote de las semanas 7 y 8', () => {
    const choice = leastUnitCostLot([60, 55], 7, h, S);
    expect(choice.rows.map((r) => r.unitCost)).toEqual([expect.closeTo(0.7833, 4), expect.closeTo(0.4326, 4)]);
    expect(choice.quantity).toBe(115);
  });
  it('sigue evaluando en las semanas sin necesidad y en un empate elige el lote más chico', () => {
    const choice = leastUnitCostLot([50, 0, 60], 1, h, S);
    expect(choice.rows).toHaveLength(3);
    expect(choice.rows[1].unitCost).toBeCloseTo(choice.rows[0].unitCost, 10);
    expect(choice.quantity).toBe(110);
  });
});

describe('cantidad económica de pedido (EOQ)', () => {
  it('reproduce el cálculo de la cátedra', () => {
    const eoq = economicOrderQuantity(NN_EJEMPLO_CATEDRA, COSTOS_CATEDRA)!;
    expect(eoq.totalNet).toBe(525);
    expect(eoq.annualDemand).toBeCloseTo(3412.5, 6);
    expect(eoq.annualHolding).toBeCloseTo(2.6, 6);
    expect(eoq.exact).toBeCloseTo(351.25, 2);
    expect(eoq.quantity).toBe(351);
  });
  it('no se calcula sin costos completos', () => {
    expect(economicOrderQuantity(NN_EJEMPLO_CATEDRA, { unitCost: 10, orderCost: 47, holdingRate: 0 })).toBeNull();
  });
  it('vale 0 si no hay necesidades', () => {
    expect(economicOrderQuantity([0, 0], COSTOS_CATEDRA)?.quantity).toBe(0);
  });
});
