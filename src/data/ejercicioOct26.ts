import type { Item, LotPolicy, Scenario } from '../domain/types';

const HORIZON = 12;

const weeks = (values: Record<number, number> = {}): number[] =>
  Array.from({ length: HORIZON }, (_, t) => values[t + 1] ?? 0);

const item = (
  code: string,
  description: string,
  initialStock: number,
  scheduledReceipts: Record<number, number>,
  leadTime: number,
  lotPolicy: LotPolicy,
  demand: number[] = weeks(),
): Item => ({
  code,
  description,
  initialStock,
  leadTime,
  safetyStock: 0,
  lotPolicy,
  type: 'auto',
  scheduledReceipts: weeks(scheduledReceipts),
  demand,
});

const L4L: LotPolicy = { kind: 'L4L' };
const fixed = (lotSize: number): LotPolicy => ({ kind: 'FIXED', lotSize });

/** Datos de "Ejercicio MRP oct.26" (PCP – Ingeniería Industrial, UTN FRH). */
export function ejercicioOct26(): Scenario {
  return {
    name: 'Ejercicio MRP oct. 26',
    horizon: HORIZON,
    forecastEnabled: true,
    items: [
      item('A', 'Producto A', 20, { 1: 10 }, 1, L4L, [10, 30, 10, 0, 0, 30, 30, 40, 40, 20, 20, 20]),
      item('B', 'Producto B', 40, {}, 2, L4L, [10, 10, 10, 10, 30, 10, 20, 30, 10, 20, 30, 20]),
      item('C', 'Componente C', 10, { 1: 50 }, 1, fixed(50)),
      item('D', 'Componente D', 40, {}, 2, fixed(100)),
      item('E', 'Componente E', 40, { 1: 50 }, 2, fixed(50)),
      item('F', 'Componente F', 20, {}, 1, fixed(100)),
      item('G', 'Componente G', 10, {}, 2, fixed(20)),
      item('H', 'Componente H', 10, { 1: 20 }, 1, fixed(50)),
      item('I', 'Componente I', 10, { 1: 30 }, 1, L4L),
    ],
    bom: [
      { parent: 'A', child: 'F', quantity: 1 },
      { parent: 'A', child: 'C', quantity: 2 },
      { parent: 'A', child: 'D', quantity: 1 },
      { parent: 'C', child: 'D', quantity: 2 },
      { parent: 'C', child: 'E', quantity: 3 },
      { parent: 'B', child: 'F', quantity: 2 },
      { parent: 'B', child: 'G', quantity: 1 },
      { parent: 'B', child: 'D', quantity: 3 },
      { parent: 'G', child: 'H', quantity: 1 },
      { parent: 'G', child: 'E', quantity: 1 },
      { parent: 'H', child: 'I', quantity: 1 },
      { parent: 'H', child: 'E', quantity: 1 },
    ],
  };
}
