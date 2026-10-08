import { Info, RotateCcw, TriangleAlert } from 'lucide-react';
import type { Dispatch } from 'react';
import { endItems, usableBomLines } from '../domain/bom';
import type { ForecastPlan, LinearFit } from '../domain/forecast';
import type { WeekRange } from '../domain/reports';
import type { Scenario } from '../domain/types';
import { MAX_HORIZON } from '../domain/validation';
import type { ScenarioAction } from '../state/useScenario';
import { NumberInput, fmt } from './common';
import { ForecastChart } from './ForecastChart';
import { PageHeader } from './shell/PageHeader';
import { ItemCode, StatusChip, type Tone } from './ui/Chips';
import { Panel } from './ui/Panel';
import { Term } from './ui/Term';
import { WeekGrid } from './ui/WeekGrid';

const dec = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function equation(fit: LinearFit) {
  const sign = fit.slope < 0 ? '−' : '+';
  return `y = ${dec(fit.intercept)} ${sign} ${dec(Math.abs(fit.slope))}·t`;
}

export function fitQuality(fit: LinearFit): { tone: Tone; label: string } {
  if (fit.r2 === null) return { tone: 'neutral', label: 'Serie constante' };
  if (fit.r2 < 0.3) return { tone: 'warn', label: 'Tendencia débil' };
  if (fit.r2 < 0.7) return { tone: 'info', label: 'Tendencia moderada' };
  return { tone: 'ok', label: 'Tendencia fuerte' };
}

/** Clase y texto de una celda del PMP según sea demanda cargada, pronóstico o valor a mano. */
export function forecastCell(plan: ForecastPlan | null, code: string) {
  const cells = plan?.products.find((p) => p.code === code)?.cells ?? [];
  const at = (week: number) => cells.find((c) => c.week === week);
  return {
    cellClass: (week: number) => {
      const c = at(week);
      return c ? (c.source === 'override' ? 'cell-override' : 'cell-forecast') : undefined;
    },
    cellTitle: (week: number) => {
      const c = at(week);
      if (!c) return undefined;
      return c.source === 'override'
        ? 'Valor escrito a mano sobre el pronóstico'
        : 'Pronóstico por regresión lineal: escribí un valor para reemplazarlo';
    },
  };
}

export function ForecastLegend() {
  return (
    <p className="legend">
      <span className="legend-dot dot-history" /> Demanda cargada
      <span className="legend-dash" /> Recta de regresión
      <span className="legend-dot dot-forecast" /> Pronóstico
      <span className="legend-dot dot-override" /> Escrita a mano
    </p>
  );
}

export function ForecastPanel({ scenario, plan }: { scenario: Scenario; plan: ForecastPlan }) {
  return (
    <div className="forecast-grid">
      {plan.products.map((p) => {
        const quality = fitQuality(p.fit);
        const history = Array.from(
          { length: plan.base },
          (_, t) => scenario.items.find((i) => i.code === p.code)?.demand[t] ?? 0,
        );
        return (
          <figure key={p.code} className="forecast-card">
            <figcaption>
              <span className="forecast-title">
                <ItemCode code={p.code} /> {p.description}
              </span>
              <span className="chip-row">
                <code className="formula">{equation(p.fit)}</code>
                <StatusChip tone={quality.tone}>
                  R² {p.fit.r2 === null ? '—' : dec(p.fit.r2)} · {quality.label}
                </StatusChip>
              </span>
            </figcaption>
            <ForecastChart product={p} history={history} base={plan.base} />
            <p className="forecast-values">
              {p.cells.map((c) => (
                <span key={c.week} className={c.source === 'override' ? 'override' : undefined}>
                  S{c.week}: <strong>{fmt(c.value)}</strong>
                </span>
              ))}
            </p>
          </figure>
        );
      })}
    </div>
  );
}

export function MpsEditor({
  scenario,
  plan,
  emptyWeeks,
  dispatch,
}: {
  /** Escenario original (sin pronóstico aplicado). */
  scenario: Scenario;
  plan: ForecastPlan | null;
  /** Semanas finales que siguen sin demanda después de aplicar el pronóstico. */
  emptyWeeks: WeekRange | null;
  dispatch: Dispatch<ScenarioAction>;
}) {
  const products = endItems(scenario.items, usableBomLines(scenario.items, scenario.bom));
  const values = (code: string, demand: number[]) => {
    const cells = plan?.products.find((p) => p.code === code)?.cells ?? [];
    const out = Array.from({ length: scenario.horizon }, (_, t) => demand[t] ?? 0);
    for (const c of cells) out[c.week - 1] = c.value;
    return out;
  };
  const rows = products.map((p) => ({ product: p, values: values(p.code, p.demand) }));
  const totals = Array.from({ length: scenario.horizon }, (_, t) => rows.reduce((sum, r) => sum + r.values[t], 0));
  const hasOverrides = !!plan?.products.some((p) => p.cells.some((c) => c.source === 'override'));
  const source = emptyWeeks && emptyWeeks.from > 1 ? emptyWeeks.from - 1 : null;
  const repeatLastWeek = () => {
    if (!emptyWeeks || source === null) return;
    for (const r of rows) {
      for (let w = emptyWeeks.from; w <= emptyWeeks.to; w++) {
        dispatch({ type: 'setWeekValue', code: r.product.code, field: 'demand', week: w - 1, value: r.values[source - 1] });
      }
    }
  };
  const range = (r: WeekRange) => (r.from === r.to ? `S${r.from}` : `S${r.from} a S${r.to}`);

  return (
    <>
      <PageHeader
        view="pmp"
        actions={
          <>
            <label className="switch" htmlFor="forecast-enabled" title="Completar las semanas sin demanda con regresión lineal">
              <input
                id="forecast-enabled"
                type="checkbox"
                role="switch"
                checked={scenario.forecastEnabled}
                onChange={(e) => dispatch({ type: 'setForecastEnabled', enabled: e.currentTarget.checked })}
              />
              <span className="switch-track" aria-hidden />
              Pronóstico automático
            </label>
            <label className="inline-field" htmlFor="horizon">
              Horizonte
              <span className="input-unit">
                <NumberInput
                  id="horizon"
                  label="Horizonte de planificación en semanas"
                  value={scenario.horizon}
                  min={1}
                  onChange={(v) =>
                    dispatch({ type: 'setHorizon', horizon: Math.min(MAX_HORIZON, Math.max(1, Math.round(v))) })
                  }
                />
                <span className="unit">semanas</span>
              </span>
            </label>
          </>
        }
      />

      {emptyWeeks && (
        <div className="callout callout-warn" role="status">
          <TriangleAlert size={16} aria-hidden />
          <div>
            <p>
              <strong>
                {emptyWeeks.from === emptyWeeks.to
                  ? `La semana S${emptyWeeks.from} no tiene`
                  : `Las semanas ${range(emptyWeeks)} no tienen`}{' '}
                demanda cargada.
              </strong>{' '}
              El MRP solo planifica lo que pide el plan maestro, así que en esas semanas no va a haber necesidades ni
              órdenes.{' '}
              {scenario.forecastEnabled
                ? 'El pronóstico da 0 para todos los productos: cargá la demanda en las columnas resaltadas.'
                : 'Activá el pronóstico automático o cargá la demanda en las columnas resaltadas.'}
            </p>
            <div className="chip-row">
              {!scenario.forecastEnabled && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => dispatch({ type: 'setForecastEnabled', enabled: true })}
                >
                  Activar pronóstico
                </button>
              )}
              {source !== null && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={repeatLastWeek}>
                  Repetir la demanda de S{source}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {plan && (
        <div className="callout" role="status">
          <Info size={16} aria-hidden />
          <div>
            <p>
              <strong>{range(plan)}: pronóstico por regresión lineal</strong> sobre la demanda cargada de S1 a S{plan.base}.
              Las celdas marcadas con <span className="forecast-tag">P</span> son pronóstico; si escribís un valor, reemplaza
              al pronóstico de esa semana.
            </p>
            {hasOverrides && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => dispatch({ type: 'clearForecastOverrides' })}
              >
                <RotateCcw size={14} aria-hidden /> Volver al pronóstico en todas las semanas
              </button>
            )}
          </div>
        </div>
      )}

      <Panel
        title={
          <>
            Necesidades brutas de productos finales <Term id="NB" />
          </>
        }
        subtitle="Pedidos de clientes más pronóstico, en unidades por semana."
        flush
      >
        {products.length ? (
          <WeekGrid
            caption="Plan maestro de producción"
            horizon={scenario.horizon}
            marked={emptyWeeks}
            forecastFrom={plan?.from}
            rows={[
              ...rows.map(({ product: p, values: v }) => ({
                id: p.code,
                label: `${p.code} · ${p.description}`,
                values: v,
                ...forecastCell(plan, p.code),
                onChange: (week: number, value: number) =>
                  dispatch({ type: 'setWeekValue', code: p.code, field: 'demand', week, value }),
              })),
              { id: 'total', label: 'Total semanal', values: totals },
            ]}
          />
        ) : (
          <p className="muted panel-pad">No hay productos finales: revisá la lista de materiales.</p>
        )}
      </Panel>

      {plan && (
        <Panel
          title={
            <>
              Pronóstico por <Term id="PRONOSTICO">regresión lineal</Term>
            </>
          }
          subtitle={`Recta de mínimos cuadrados ajustada a S1–S${plan.base} de cada producto y prolongada hasta S${plan.to}.`}
          actions={<ForecastLegend />}
        >
          <ForecastPanel scenario={scenario} plan={plan} />
        </Panel>
      )}
    </>
  );
}
