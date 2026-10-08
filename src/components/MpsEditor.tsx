import { TriangleAlert } from 'lucide-react';
import type { Dispatch } from 'react';
import { endItems, usableBomLines } from '../domain/bom';
import { trailingEmptyDemand } from '../domain/reports';
import type { Scenario } from '../domain/types';
import { MAX_HORIZON } from '../domain/validation';
import type { ScenarioAction } from '../state/useScenario';
import { NumberInput } from './common';
import { PageHeader } from './shell/PageHeader';
import { Panel } from './ui/Panel';
import { Term } from './ui/Term';
import { WeekGrid } from './ui/WeekGrid';

export function MpsEditor({ scenario, dispatch }: { scenario: Scenario; dispatch: Dispatch<ScenarioAction> }) {
  const products = endItems(scenario.items, usableBomLines(scenario.items, scenario.bom));
  const totals = Array.from({ length: scenario.horizon }, (_, t) =>
    products.reduce((sum, p) => sum + (p.demand[t] ?? 0), 0),
  );
  const gap = trailingEmptyDemand(scenario);
  const source = gap && gap.from > 1 ? gap.from - 1 : null;
  const repeatLastWeek = () => {
    if (!gap || source === null) return;
    for (const p of products) {
      const value = p.demand[source - 1] ?? 0;
      for (let w = gap.from; w <= gap.to; w++) {
        dispatch({ type: 'setWeekValue', code: p.code, field: 'demand', week: w - 1, value });
      }
    }
  };

  return (
    <>
      <PageHeader
        view="pmp"
        actions={
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
        }
      />
      {gap && (
        <div className="callout callout-warn" role="status">
          <TriangleAlert size={16} aria-hidden />
          <div>
            <p>
              <strong>
                {gap.from === gap.to ? `La semana S${gap.from} no tiene` : `Las semanas S${gap.from} a S${gap.to} no tienen`} demanda
                cargada.
              </strong>{' '}
              El MRP solo planifica lo que pide el plan maestro, así que en esas semanas no va a haber necesidades ni
              órdenes. Cargá la demanda en las columnas resaltadas
              {source !== null && <>, o repetí la de S{source} como punto de partida</>}.
            </p>
            {source !== null && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={repeatLastWeek}>
                Repetir la demanda de S{source}
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
      >
        {products.length ? (
          <WeekGrid
            caption="Plan maestro de producción"
            horizon={scenario.horizon}
            marked={gap}
            rows={[
              ...products.map((p) => ({
                id: p.code,
                label: `${p.code} · ${p.description}`,
                values: p.demand,
                onChange: (week: number, value: number) =>
                  dispatch({ type: 'setWeekValue', code: p.code, field: 'demand', week, value }),
              })),
              { id: 'total', label: 'Total semanal', values: totals },
            ]}
          />
        ) : (
          <p className="muted">No hay productos finales: revisá la lista de materiales.</p>
        )}
      </Panel>
    </>
  );
}
