import { describe, expect, it } from 'vitest';
import { ejercicioOct26 } from '../../data/ejercicioOct26';
import { parseScenario } from '../../state/scenarioIO';
import { scenarioReducer } from '../../state/useScenario';
import { applyForecast, firmDemandWeeks, linearRegression, planForecast } from '../forecast';
import { runMrp } from '../mrpEngine';
import { trailingEmptyDemand } from '../reports';

const extended = (horizon = 16) => ({ ...ejercicioOct26(), horizon });
const cells = (code: string, s = extended()) =>
  planForecast(s)!.products.find((p) => p.code === code)!.cells.map((c) => c.value);

describe('regresión lineal', () => {
  it('ajusta la recta de mínimos cuadrados de la demanda de A', () => {
    // A: 10 30 10 0 0 30 30 40 40 20 20 20 → Σ(t−t̄)(y−ȳ) = 205, Σ(t−t̄)² = 143
    const fit = linearRegression([10, 30, 10, 0, 0, 30, 30, 40, 40, 20, 20, 20]);
    expect(fit.slope).toBeCloseTo(205 / 143, 10);
    expect(fit.intercept).toBeCloseTo(250 / 12 - (205 / 143) * 6.5, 10);
    expect(fit.r2).toBeCloseTo(0.1405, 3);
  });

  it('una serie constante tiene pendiente 0 y R² indefinido', () => {
    expect(linearRegression([5, 5, 5])).toEqual({ intercept: 5, slope: 0, r2: null, n: 3 });
  });
});

describe('pronóstico de las semanas sin demanda', () => {
  it('la serie cargada del ejercicio llega a la semana 12', () => {
    expect(firmDemandWeeks(ejercicioOct26())).toBe(12);
  });

  it('no pronostica nada si el horizonte no pasa de la serie cargada', () => {
    expect(planForecast(ejercicioOct26())).toBeNull();
  });

  it('prolonga la tendencia de A y de B en S13–S16', () => {
    const plan = planForecast(extended())!;
    expect([plan.from, plan.to]).toEqual([13, 16]);
    expect(cells('A')).toEqual([30, 32, 33, 34]);
    expect(cells('B')).toEqual([26, 27, 28, 30]);
  });

  it('se puede desactivar', () => {
    expect(planForecast({ ...extended(), forecastEnabled: false })).toBeNull();
  });

  it('un valor escrito a mano reemplaza al pronóstico sin cambiar la recta', () => {
    const s = scenarioReducer(extended(), { type: 'setWeekValue', code: 'A', field: 'demand', week: 13, value: 50 });
    const a = s.items.find((i) => i.code === 'A')!;
    expect(a.demand).toHaveLength(12);
    expect(a.forecastOverrides).toEqual({ 13: 50 });
    expect(cells('A', s)).toEqual([30, 50, 33, 34]);
    expect(planForecast(s)!.products[0].cells[1].source).toBe('override');
  });

  it('con el pronóstico apagado, escribir extiende la serie cargada', () => {
    const s = scenarioReducer({ ...extended(), forecastEnabled: false }, {
      type: 'setWeekValue', code: 'A', field: 'demand', week: 12, value: 25,
    });
    expect(s.items.find((i) => i.code === 'A')!.demand[12]).toBe(25);
  });

  it('descartar los valores a mano vuelve al pronóstico', () => {
    let s = scenarioReducer(extended(), { type: 'setWeekValue', code: 'B', field: 'demand', week: 12, value: 99 });
    s = scenarioReducer(s, { type: 'clearForecastOverrides' });
    expect(cells('B', s)).toEqual([26, 27, 28, 30]);
  });

  it('el MRP calcula con la demanda pronosticada', () => {
    const effective = applyForecast(extended());
    expect(trailingEmptyDemand(effective)).toBeNull();
    const a = runMrp(effective).records.find((r) => r.code === 'A')!;
    expect(a.nb.slice(12)).toEqual([30, 32, 33, 34]);
    expect(a.eop.slice(12, 15)).toEqual([32, 33, 34]);
  });

  it('exportar e importar conserva los valores escritos a mano', () => {
    const s = scenarioReducer(extended(), { type: 'setWeekValue', code: 'A', field: 'demand', week: 14, value: 40 });
    expect(parseScenario(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
});
