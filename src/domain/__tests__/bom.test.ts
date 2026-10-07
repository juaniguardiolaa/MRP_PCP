import { describe, expect, it } from 'vitest';
import { ejercicioOct26 } from '../../data/ejercicioOct26';
import {
  buildProductTree,
  cumulativeLeadTime,
  endItems,
  lowLevelCodes,
  resolveItemType,
  treeDepth,
} from '../bom';

const { items, bom } = ejercicioOct26();

describe('estructura de producto', () => {
  it('identifica los productos finales', () => {
    expect(endItems(items, bom).map((i) => i.code)).toEqual(['A', 'B']);
  });

  it('calcula los códigos de nivel inferior', () => {
    expect(lowLevelCodes(items, bom)).toEqual({
      A: 0, B: 0, C: 1, F: 1, G: 1, D: 2, H: 2, E: 3, I: 3,
    });
  });

  it('arma el árbol de cada producto con sus niveles', () => {
    const a = buildProductTree('A', bom);
    expect(a.children.map((c) => `${c.code}(${c.quantity})`)).toEqual(['F(1)', 'C(2)', 'D(1)']);
    expect(treeDepth(a)).toBe(2);
    expect(treeDepth(buildProductTree('B', bom))).toBe(3);
  });

  it('calcula el lead time acumulado (ruta crítica)', () => {
    expect(cumulativeLeadTime('A', items, bom)).toEqual({ weeks: 4, path: ['A', 'C', 'D'] });
    expect(cumulativeLeadTime('B', items, bom)).toEqual({ weeks: 7, path: ['B', 'G', 'H', 'E'] });
  });

  it('deduce el tipo de abastecimiento desde la BOM', () => {
    const type = (code: string) => resolveItemType(items.find((i) => i.code === code)!, bom);
    expect(['D', 'E', 'F', 'I'].map(type)).toEqual(['compra', 'compra', 'compra', 'compra']);
    expect(['A', 'B', 'C', 'G', 'H'].map(type)).toEqual([
      'fabricacion', 'fabricacion', 'fabricacion', 'fabricacion', 'fabricacion',
    ]);
  });
});
