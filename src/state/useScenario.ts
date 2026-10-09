import { useEffect, useReducer } from 'react';
import { ejercicioOct26 } from '../data/ejercicioOct26';
import { endItems, usableBomLines } from '../domain/bom';
import { firmDemandWeeks } from '../domain/forecast';
import type { BomLine, Item, ItemCosts, LotPolicy, Scenario } from '../domain/types';
import { loadStoredScenario, storeScenario } from './scenarioIO';

export type WeekField = 'scheduledReceipts' | 'demand';

export type ScenarioAction =
  | { type: 'setName'; name: string }
  | { type: 'setHorizon'; horizon: number }
  | { type: 'updateItem'; code: string; patch: Partial<Omit<Item, 'code'>> }
  | { type: 'renameItem'; from: string; to: string }
  | { type: 'setWeekValue'; code: string; field: WeekField; week: number; value: number }
  | { type: 'addItem' }
  | { type: 'removeItem'; code: string }
  | { type: 'addBomLine'; line: BomLine }
  | { type: 'updateBomLine'; index: number; patch: Partial<BomLine> }
  | { type: 'removeBomLine'; index: number }
  | { type: 'setForecastEnabled'; enabled: boolean }
  | { type: 'clearForecastOverrides' }
  /** Carga los mismos costos en todos los ítems. */
  | { type: 'setAllCosts'; costs: ItemCosts }
  /** Cambia la política de loteo de varios ítems a la vez. */
  | { type: 'setLotPolicies'; policies: Record<string, LotPolicy> }
  | { type: 'load'; scenario: Scenario }
  | { type: 'reset' };

function mapItem(s: Scenario, code: string, fn: (i: Item) => Item): Scenario {
  return { ...s, items: s.items.map((i) => (i.code === code ? fn(i) : i)) };
}

/** Próximo código libre (A..Z, AA, AB, ...), el mismo que usa la acción addItem. */
export function nextItemCode(items: Item[]): string {
  const codes = new Set(items.map((i) => i.code));
  for (let n = 0; ; n++) {
    // A..Z, luego AA, AB, ...
    let code = '';
    let k = n;
    do {
      code = String.fromCharCode(65 + (k % 26)) + code;
      k = Math.floor(k / 26) - 1;
    } while (k >= 0);
    if (!codes.has(code)) return code;
  }
}

export function scenarioReducer(s: Scenario, a: ScenarioAction): Scenario {
  switch (a.type) {
    case 'setName':
      return { ...s, name: a.name };
    case 'setHorizon':
      return { ...s, horizon: a.horizon };
    case 'updateItem':
      return mapItem(s, a.code, (i) => ({ ...i, ...a.patch }));
    case 'renameItem': {
      if (a.from === a.to) return s;
      const rename = (c: string) => (c === a.from ? a.to : c);
      return {
        ...s,
        items: s.items.map((i) => (i.code === a.from ? { ...i, code: a.to } : i)),
        bom: s.bom.map((l) => ({ ...l, parent: rename(l.parent), child: rename(l.child) })),
      };
    }
    case 'setWeekValue': {
      // Con el pronóstico activo, lo que se escribe después de la serie cargada de un
      // producto final reemplaza al pronóstico sin alterar la serie de la regresión.
      const isFinal = endItems(s.items, usableBomLines(s.items, s.bom)).some((i) => i.code === a.code);
      if (a.field === 'demand' && s.forecastEnabled && isFinal && a.week >= firmDemandWeeks(s) && firmDemandWeeks(s) > 0) {
        return mapItem(s, a.code, (i) => ({
          ...i,
          forecastOverrides: { ...i.forecastOverrides, [a.week]: a.value },
        }));
      }
      return mapItem(s, a.code, (i) => {
        const series = [...i[a.field]];
        while (series.length <= a.week) series.push(0);
        series[a.week] = a.value;
        return { ...i, [a.field]: series };
      });
    }
    case 'setAllCosts':
      return { ...s, items: s.items.map((i) => ({ ...i, costs: { ...a.costs } })) };
    case 'setLotPolicies':
      return {
        ...s,
        items: s.items.map((i) => (a.policies[i.code] ? { ...i, lotPolicy: a.policies[i.code] } : i)),
      };
    case 'addItem': {
      const code = nextItemCode(s.items);
      const item: Item = {
        code,
        description: `Ítem ${code}`,
        initialStock: 0,
        leadTime: 1,
        safetyStock: 0,
        lotPolicy: { kind: 'L4L' },
        type: 'auto',
        scheduledReceipts: [],
        demand: [],
      };
      return { ...s, items: [...s.items, item] };
    }
    case 'removeItem':
      return {
        ...s,
        items: s.items.filter((i) => i.code !== a.code),
        bom: s.bom.filter((l) => l.parent !== a.code && l.child !== a.code),
      };
    case 'addBomLine':
      return { ...s, bom: [...s.bom, a.line] };
    case 'updateBomLine':
      return { ...s, bom: s.bom.map((l, i) => (i === a.index ? { ...l, ...a.patch } : l)) };
    case 'removeBomLine':
      return { ...s, bom: s.bom.filter((_, i) => i !== a.index) };
    case 'setForecastEnabled':
      return { ...s, forecastEnabled: a.enabled };
    case 'clearForecastOverrides':
      return {
        ...s,
        items: s.items.map((i) => {
          if (!i.forecastOverrides) return i;
          const copy = { ...i };
          delete copy.forecastOverrides;
          return copy;
        }),
      };
    case 'load':
      return a.scenario;
    case 'reset':
      return ejercicioOct26();
  }
}

/** Escenario editable, autoguardado en el navegador. */
export function useScenario() {
  const [scenario, dispatch] = useReducer(
    scenarioReducer,
    undefined,
    () => loadStoredScenario() ?? ejercicioOct26(),
  );
  useEffect(() => storeScenario(scenario), [scenario]);
  return [scenario, dispatch] as const;
}
