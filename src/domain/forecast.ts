import { endItems, usableBomLines } from './bom';
import type { Scenario } from './types';

/** Recta de mínimos cuadrados y = intercept + slope · t, con t = 1, 2, … n. */
export interface LinearFit {
  intercept: number;
  slope: number;
  /** Coeficiente de determinación; null si la serie es constante o tiene un solo punto. */
  r2: number | null;
  n: number;
}

export function linearRegression(ys: readonly number[]): LinearFit {
  const n = ys.length;
  if (n === 0) return { intercept: 0, slope: 0, r2: null, n };
  const tMean = (n + 1) / 2;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  ys.forEach((y, i) => {
    const dt = i + 1 - tMean;
    sxy += dt * (y - yMean);
    sxx += dt * dt;
    syy += (y - yMean) ** 2;
  });
  const slope = sxx > 0 ? sxy / sxx : 0;
  const intercept = yMean - slope * tMean;
  const r2 = sxx > 0 && syy > 0 ? (slope * sxy) / syy : null;
  return { intercept, slope, r2, n };
}

/** Valor de la recta en la semana t (sin redondear). */
export const fitAt = (fit: LinearFit, t: number) => fit.intercept + fit.slope * t;

/** Unidades pronosticadas para la semana t: entero y nunca negativo. */
export const forecastAt = (fit: LinearFit, t: number) => Math.max(0, Math.round(fitAt(fit, t)));

/**
 * Última semana con demanda cargada en algún producto final (la serie "del modelo").
 * Los valores escritos a mano sobre semanas pronosticadas no cuentan.
 */
export function firmDemandWeeks(scenario: Scenario): number {
  const products = endItems(scenario.items, usableBomLines(scenario.items, scenario.bom));
  return products.reduce((last, p) => {
    for (let w = p.demand.length; w > last; w--) if (p.demand[w - 1] > 0) return w;
    return last;
  }, 0);
}

export interface ForecastCell {
  week: number;
  value: number;
  /** 'override' si el usuario escribió el valor sobre el pronóstico. */
  source: 'forecast' | 'override';
}

export interface ProductForecast {
  code: string;
  description: string;
  fit: LinearFit;
  cells: ForecastCell[];
}

export interface ForecastPlan {
  /** Última semana de la serie cargada; el pronóstico va de base + 1 a `to`. */
  base: number;
  from: number;
  to: number;
  products: ProductForecast[];
}

/**
 * Pronóstico de las semanas del horizonte que quedan después de la serie cargada.
 * Devuelve null si está desactivado, si no hay semanas por pronosticar o si no hay
 * demanda cargada desde la cual extrapolar.
 */
export function planForecast(scenario: Scenario): ForecastPlan | null {
  if (!scenario.forecastEnabled) return null;
  const base = firmDemandWeeks(scenario);
  if (base === 0 || base >= scenario.horizon) return null;
  const products = endItems(scenario.items, usableBomLines(scenario.items, scenario.bom));
  return {
    base,
    from: base + 1,
    to: scenario.horizon,
    products: products.map((p) => {
      const fit = linearRegression(Array.from({ length: base }, (_, t) => p.demand[t] ?? 0));
      const cells: ForecastCell[] = [];
      for (let week = base + 1; week <= scenario.horizon; week++) {
        const override = p.forecastOverrides?.[week - 1];
        cells.push(
          override !== undefined
            ? { week, value: override, source: 'override' }
            : { week, value: forecastAt(fit, week), source: 'forecast' },
        );
      }
      return { code: p.code, description: p.description, fit, cells };
    }),
  };
}

/**
 * Escenario con la demanda de los productos finales extendida por el pronóstico.
 * Es el que se usa para calcular el MRP; el escenario original no se modifica.
 */
export function applyForecast(scenario: Scenario, plan = planForecast(scenario)): Scenario {
  if (!plan) return scenario;
  const byCode = new Map(plan.products.map((p) => [p.code, p]));
  return {
    ...scenario,
    items: scenario.items.map((item) => {
      const product = byCode.get(item.code);
      if (!product) return item;
      const demand = Array.from({ length: plan.base }, (_, t) => item.demand[t] ?? 0);
      for (const cell of product.cells) demand[cell.week - 1] = cell.value;
      return { ...item, demand };
    }),
  };
}
