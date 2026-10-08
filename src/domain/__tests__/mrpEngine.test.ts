import { describe, expect, it } from 'vitest';
import { ejercicioOct26 } from '../../data/ejercicioOct26';
import { runMrp } from '../mrpEngine';
import type { Item, Scenario } from '../types';

const record = (scenario: Scenario, code: string) => {
  const r = runMrp(scenario).records.find((x) => x.code === code);
  if (!r) throw new Error(`sin registro para ${code}`);
  return r;
};

describe('Ejercicio MRP oct. 26 (datos de la consigna)', () => {
  const scenario = ejercicioOct26();
  const result = runMrp(scenario);

  it('no tiene errores de datos', () => {
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(result.records).toHaveLength(9);
  });

  it('procesa los ítems por código de nivel inferior', () => {
    expect(result.records.map((r) => `${r.code}${r.level}`)).toEqual([
      'A0', 'B0', 'C1', 'F1', 'G1', 'D2', 'H2', 'E3', 'I3',
    ]);
  });

  // Valores verificados a mano con la lógica de la cátedra.
  const expected: Record<string, { nb: number[]; nn: number[]; rop: number[]; eop: number[]; d: number[] }> = {
    A: {
      nb: [10, 30, 10, 0, 0, 30, 30, 40, 40, 20, 20, 20],
      nn: [0, 10, 10, 0, 0, 30, 30, 40, 40, 20, 20, 20],
      rop: [0, 10, 10, 0, 0, 30, 30, 40, 40, 20, 20, 20],
      eop: [10, 10, 0, 0, 30, 30, 40, 40, 20, 20, 20, 0],
      d: [20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    B: {
      nb: [10, 10, 10, 10, 30, 10, 20, 30, 10, 20, 30, 20],
      nn: [0, 0, 0, 0, 30, 10, 20, 30, 10, 20, 30, 20],
      rop: [0, 0, 0, 0, 30, 10, 20, 30, 10, 20, 30, 20],
      eop: [0, 0, 30, 10, 20, 30, 10, 20, 30, 20, 0, 0],
      d: [30, 20, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    C: {
      nb: [20, 20, 0, 0, 60, 60, 80, 80, 40, 40, 40, 0],
      nn: [0, 0, 0, 0, 40, 50, 80, 60, 0, 40, 30, 0],
      rop: [0, 0, 0, 0, 50, 50, 100, 100, 0, 50, 50, 0],
      eop: [0, 0, 0, 50, 50, 100, 100, 0, 50, 50, 0, 0],
      d: [40, 20, 20, 20, 10, 0, 20, 40, 0, 10, 20, 20],
    },
    D: {
      nb: [10, 10, 90, 130, 190, 320, 270, 100, 210, 180, 20, 0],
      nn: [0, 0, 70, 100, 190, 310, 180, 80, 190, 170, 0, 0],
      rop: [0, 0, 100, 100, 200, 400, 200, 100, 200, 200, 0, 0],
      eop: [100, 100, 200, 400, 200, 100, 200, 200, 0, 0, 0, 0],
      d: [30, 20, 30, 0, 10, 90, 20, 20, 10, 30, 10, 10],
    },
    E: {
      nb: [70, 20, 20, 220, 170, 370, 320, 20, 150, 150, 0, 0],
      nn: [0, 0, 20, 190, 160, 330, 300, 20, 120, 120, 0, 0],
      rop: [0, 0, 50, 200, 200, 350, 300, 50, 150, 150, 0, 0],
      eop: [50, 200, 200, 350, 300, 50, 150, 150, 0, 0, 0, 0],
      d: [20, 0, 30, 10, 40, 20, 0, 30, 30, 30, 30, 30],
    },
    F: {
      nb: [10, 10, 60, 20, 70, 90, 60, 80, 80, 60, 20, 0],
      nn: [0, 0, 60, 0, 50, 40, 0, 80, 60, 20, 0, 0],
      rop: [0, 0, 100, 0, 100, 100, 0, 100, 100, 100, 0, 0],
      eop: [0, 100, 0, 100, 100, 0, 100, 100, 100, 0, 0, 0],
      d: [10, 0, 40, 20, 50, 60, 0, 20, 40, 80, 60, 60],
    },
    G: {
      nb: [0, 0, 30, 10, 20, 30, 10, 20, 30, 20, 0, 0],
      nn: [0, 0, 20, 10, 10, 20, 10, 10, 20, 20, 0, 0],
      rop: [0, 0, 20, 20, 20, 20, 20, 20, 20, 20, 0, 0],
      eop: [20, 20, 20, 20, 20, 20, 20, 20, 0, 0, 0, 0],
      d: [10, 10, 0, 10, 10, 0, 10, 10, 0, 0, 0, 0],
    },
    H: {
      nb: [20, 20, 20, 20, 20, 20, 20, 20, 0, 0, 0, 0],
      nn: [0, 10, 0, 0, 20, 0, 10, 0, 0, 0, 0, 0],
      rop: [0, 50, 0, 0, 50, 0, 50, 0, 0, 0, 0, 0],
      eop: [50, 0, 0, 50, 0, 50, 0, 0, 0, 0, 0, 0],
      d: [10, 40, 20, 0, 30, 10, 40, 20, 20, 20, 20, 20],
    },
    I: {
      nb: [50, 0, 0, 50, 0, 50, 0, 0, 0, 0, 0, 0],
      nn: [10, 0, 0, 50, 0, 50, 0, 0, 0, 0, 0, 0],
      rop: [10, 0, 0, 50, 0, 50, 0, 0, 0, 0, 0, 0],
      eop: [0, 0, 50, 0, 50, 0, 0, 0, 0, 0, 0, 0],
      d: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
  };

  for (const [code, exp] of Object.entries(expected)) {
    it(`tabla MRP de ${code}`, () => {
      const r = result.records.find((x) => x.code === code)!;
      expect(r.nb).toEqual(exp.nb);
      expect(r.nn).toEqual(exp.nn);
      expect(r.rop).toEqual(exp.rop);
      expect(r.eop).toEqual(exp.eop);
      expect(r.d).toEqual(exp.d);
    });
  }

  it('detecta la orden atrasada de I (10 u. que debieron emitirse en S0)', () => {
    const late = result.orders.filter((o) => o.pastDue);
    expect(late).toEqual([
      expect.objectContaining({ itemCode: 'I', quantity: 10, releaseWeek: 0, receiptWeek: 1 }),
    ]);
    expect(result.records.find((r) => r.code === 'I')!.pastDueRelease).toBe(10);
    expect(result.alerts.some((a) => a.severity === 'error' && a.itemCode === 'I')).toBe(true);
  });

  it('las órdenes planificadas coinciden con las filas EOP', () => {
    for (const r of result.records) {
      const fromOrders = new Array(12).fill(0);
      for (const o of result.orders) {
        if (o.itemCode === r.code && !o.pastDue) fromOrders[o.releaseWeek - 1] += o.quantity;
      }
      expect(fromOrders).toEqual(r.eop);
    }
  });
});

describe('Ejemplo de la cátedra (tijera TJ, diapositivas 13–16)', () => {
  const H = 9;
  const blank = (code: string, initialStock: number, leadTime: number, safetyStock = 0): Item => ({
    code,
    description: code,
    initialStock,
    leadTime,
    safetyStock,
    lotPolicy: { kind: 'L4L' },
    type: 'auto',
    scheduledReceipts: [],
    demand: [],
  });
  const scenario: Scenario = {
    name: 'Tijera',
    horizon: H,
    forecastEnabled: false,
    items: [
      { ...blank('TJ', 550, 2, 50), demand: [0, 0, 400, 600, 0, 800, 300, 0, 0] },
      blank('D', 500, 1),
      blank('T', 300, 1, 125),
      blank('I', 700, 2),
    ],
    bom: [
      { parent: 'TJ', child: 'D', quantity: 1 },
      { parent: 'TJ', child: 'T', quantity: 2 },
      { parent: 'TJ', child: 'I', quantity: 1 },
    ],
  };

  it('reproduce las NN y EOP de TJ', () => {
    const r = record(scenario, 'TJ');
    expect(r.nn).toEqual([0, 0, 0, 500, 0, 800, 300, 0, 0]);
    expect(r.eop).toEqual([0, 500, 0, 800, 300, 0, 0, 0, 0]);
  });

  it('reproduce las EOP de D, I y T', () => {
    expect(record(scenario, 'D').eop).toEqual([0, 0, 800, 300, 0, 0, 0, 0, 0]);
    expect(record(scenario, 'I').eop).toEqual([0, 600, 300, 0, 0, 0, 0, 0, 0]);
    const t = record(scenario, 'T');
    expect(t.nb).toEqual([0, 1000, 0, 1600, 600, 0, 0, 0, 0]);
    expect(t.nn).toEqual([0, 825, 0, 1600, 600, 0, 0, 0, 0]);
    expect(t.eop).toEqual([825, 0, 1600, 600, 0, 0, 0, 0, 0]);
  });
});

describe('Casos particulares', () => {
  const base = (over: Partial<Item>): Item => ({
    code: 'X',
    description: '',
    initialStock: 0,
    leadTime: 1,
    safetyStock: 0,
    lotPolicy: { kind: 'L4L' },
    type: 'auto',
    scheduledReceipts: [],
    demand: [],
    ...over,
  });

  it('con lead time 0 la orden se emite la misma semana', () => {
    const s: Scenario = {
      name: 't',
      horizon: 3,
      forecastEnabled: false,
      items: [base({ leadTime: 0, demand: [0, 5, 0] })],
      bom: [],
    };
    const r = record(s, 'X');
    expect(r.eop).toEqual([0, 5, 0]);
    expect(r.rop).toEqual([0, 5, 0]);
  });

  it('lote fijo pide varios lotes cuando la necesidad neta supera el lote', () => {
    const s: Scenario = {
      name: 't',
      horizon: 3,
      forecastEnabled: false,
      items: [base({ lotPolicy: { kind: 'FIXED', lotSize: 100 }, demand: [0, 310, 30] })],
      bom: [],
    };
    const r = record(s, 'X');
    expect(r.rop).toEqual([0, 400, 0]);
    expect(r.d).toEqual([0, 90, 60]);
  });

  it('un componente común suma las necesidades de todos sus padres', () => {
    const s: Scenario = {
      name: 't',
      horizon: 3,
      forecastEnabled: false,
      items: [
        base({ code: 'P', leadTime: 0, demand: [0, 0, 4] }),
        base({ code: 'Q', leadTime: 0, demand: [0, 0, 1] }),
        base({ code: 'K', leadTime: 0 }),
      ],
      bom: [
        { parent: 'P', child: 'K', quantity: 2 },
        { parent: 'Q', child: 'K', quantity: 3 },
      ],
    };
    expect(record(s, 'K').nb).toEqual([0, 0, 11]);
  });

  it('una orden atrasada carga las necesidades de sus componentes en S1', () => {
    const s: Scenario = {
      name: 't',
      horizon: 3,
      forecastEnabled: false,
      items: [base({ code: 'P', leadTime: 2, demand: [5, 0, 0] }), base({ code: 'K', leadTime: 0 })],
      bom: [{ parent: 'P', child: 'K', quantity: 2 }],
    };
    expect(record(s, 'P').pastDueRelease).toBe(5);
    expect(record(s, 'K').nb).toEqual([10, 0, 0]);
  });

  it('una BOM con ciclo no se calcula y se informa el error', () => {
    const s: Scenario = {
      name: 't',
      horizon: 3,
      forecastEnabled: false,
      items: [base({ code: 'P' }), base({ code: 'K' })],
      bom: [
        { parent: 'P', child: 'K', quantity: 1 },
        { parent: 'K', child: 'P', quantity: 1 },
      ],
    };
    const result = runMrp(s);
    expect(result.records).toEqual([]);
    expect(result.issues.some((i) => i.severity === 'error' && i.message.includes('ciclo'))).toBe(true);
  });
});
