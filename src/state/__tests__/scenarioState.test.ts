import { describe, expect, it } from 'vitest';
import { ejercicioOct26 } from '../../data/ejercicioOct26';
import { parseScenario } from '../scenarioIO';
import { scenarioReducer } from '../useScenario';

describe('edición del escenario', () => {
  it('renombrar un ítem actualiza la BOM', () => {
    const s = scenarioReducer(ejercicioOct26(), { type: 'renameItem', from: 'D', to: 'D1' });
    expect(s.items.some((i) => i.code === 'D1')).toBe(true);
    expect(s.bom.filter((l) => l.child === 'D1')).toHaveLength(3);
    expect(s.bom.some((l) => l.child === 'D')).toBe(false);
  });

  it('eliminar un ítem elimina sus relaciones', () => {
    const s = scenarioReducer(ejercicioOct26(), { type: 'removeItem', code: 'G' });
    expect(s.bom.some((l) => l.parent === 'G' || l.child === 'G')).toBe(false);
  });

  it('cargar un valor semanal extiende la serie si hace falta', () => {
    const s = scenarioReducer(ejercicioOct26(), {
      type: 'setWeekValue', code: 'I', field: 'scheduledReceipts', week: 14, value: 7,
    });
    const i = s.items.find((x) => x.code === 'I')!;
    expect(i.scheduledReceipts).toHaveLength(15);
    expect(i.scheduledReceipts[14]).toBe(7);
  });

  it('agrega ítems con código libre', () => {
    const s = scenarioReducer(ejercicioOct26(), { type: 'addItem' });
    expect(s.items.at(-1)!.code).toBe('J');
  });

  it('exportar e importar conserva el escenario', () => {
    const original = ejercicioOct26();
    expect(parseScenario(JSON.parse(JSON.stringify(original)))).toEqual(original);
  });

  it('rechaza archivos sin items o bom', () => {
    expect(() => parseScenario({ name: 'x' })).toThrow();
  });
});
