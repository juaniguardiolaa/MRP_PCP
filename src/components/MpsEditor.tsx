import type { Dispatch } from 'react';
import { endItems, usableBomLines } from '../domain/bom';
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
