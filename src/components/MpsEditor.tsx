import type { Dispatch } from 'react';
import { endItems, usableBomLines } from '../domain/bom';
import type { Scenario } from '../domain/types';
import { MAX_HORIZON } from '../domain/validation';
import type { ScenarioAction } from '../state/useScenario';
import { NumberInput, Section, fmt, weekNumbers } from './common';

export function MpsEditor({
  scenario,
  dispatch,
}: {
  scenario: Scenario;
  dispatch: Dispatch<ScenarioAction>;
}) {
  const weeks = weekNumbers(scenario.horizon);
  const products = endItems(scenario.items, usableBomLines(scenario.items, scenario.bom));

  return (
    <Section
      title="Plan Maestro de Producción (PMP)"
      subtitle="Necesidades brutas de los productos finales (pedidos de clientes + pronóstico) por semana. Los productos finales son los ítems que no son componente de ningún otro."
      actions={
        <label className="inline-field">
          Horizonte (semanas)
          <NumberInput
            label="Horizonte de planificación en semanas"
            value={scenario.horizon}
            min={1}
            onChange={(v) =>
              dispatch({ type: 'setHorizon', horizon: Math.min(MAX_HORIZON, Math.max(1, Math.round(v))) })
            }
          />
        </label>
      }
    >
      <div className="table-scroll">
        <table className="grid-table">
          <thead>
            <tr>
              <th className="sticky-col">Producto</th>
              {weeks.map((w) => (
                <th key={w}>S{w}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.code}>
                <th className="sticky-col row-head">
                  {p.code}
                  <span className="muted small"> {p.description}</span>
                </th>
                {weeks.map((w) => (
                  <td key={w}>
                    <NumberInput
                      label={`PMP de ${p.code} en semana ${w}`}
                      value={p.demand[w - 1] ?? 0}
                      onChange={(value) =>
                        dispatch({ type: 'setWeekValue', code: p.code, field: 'demand', week: w - 1, value })
                      }
                    />
                  </td>
                ))}
                <td className="total">{fmt(p.demand.slice(0, scenario.horizon).reduce((a, b) => a + b, 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {products.length === 0 && <p className="muted">No hay productos finales: revisá la lista de materiales.</p>}
    </Section>
  );
}
