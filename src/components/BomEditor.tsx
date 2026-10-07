import { useState, type Dispatch } from 'react';
import type { Scenario } from '../domain/types';
import type { ScenarioAction } from '../state/useScenario';
import { NumberInput, Section } from './common';

export function BomEditor({
  scenario,
  dispatch,
}: {
  scenario: Scenario;
  dispatch: Dispatch<ScenarioAction>;
}) {
  const codes = scenario.items.map((i) => i.code);
  const [parent, setParent] = useState(codes[0] ?? '');
  const [child, setChild] = useState(codes[1] ?? '');
  const [quantity, setQuantity] = useState(1);

  const lines = scenario.bom
    .map((line, index) => ({ line, index }))
    .sort((a, b) => a.line.parent.localeCompare(b.line.parent));

  const options = (current: string) => (
    <>
      {!codes.includes(current) && <option value={current}>{current || '—'} (no existe)</option>}
      {codes.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </>
  );

  return (
    <Section
      title="Lista de materiales (BOM)"
      subtitle="Relaciones padre → componente con su coeficiente de uso (unidades del componente por unidad del padre). Los cambios de ingeniería se cargan acá."
    >
      <div className="bom-layout">
        <div className="table-scroll">
          <table className="grid-table">
            <thead>
              <tr>
                <th>Padre</th>
                <th>Componente</th>
                <th>Coeficiente de uso</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {lines.map(({ line, index }) => (
                <tr key={index}>
                  <td>
                    <select
                      value={line.parent}
                      aria-label="Padre"
                      onChange={(e) => dispatch({ type: 'updateBomLine', index, patch: { parent: e.currentTarget.value } })}
                    >
                      {options(line.parent)}
                    </select>
                  </td>
                  <td>
                    <select
                      value={line.child}
                      aria-label="Componente"
                      onChange={(e) => dispatch({ type: 'updateBomLine', index, patch: { child: e.currentTarget.value } })}
                    >
                      {options(line.child)}
                    </select>
                  </td>
                  <td>
                    <NumberInput
                      label={`Coeficiente de ${line.child} en ${line.parent}`}
                      value={line.quantity}
                      min={1}
                      onChange={(v) => dispatch({ type: 'updateBomLine', index, patch: { quantity: v } })}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Eliminar ${line.parent} → ${line.child}`}
                      title="Eliminar relación"
                      onClick={() => dispatch({ type: 'removeBomLine', index })}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form
          className="card add-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (parent && child && quantity > 0) {
              dispatch({ type: 'addBomLine', line: { parent, child, quantity } });
            }
          }}
        >
          <h3>Agregar relación</h3>
          <label>
            Padre
            <select value={parent} onChange={(e) => setParent(e.currentTarget.value)}>
              {options(parent)}
            </select>
          </label>
          <label>
            Componente
            <select value={child} onChange={(e) => setChild(e.currentTarget.value)}>
              {options(child)}
            </select>
          </label>
          <label>
            Coeficiente de uso
            <NumberInput label="Coeficiente de uso" value={quantity} min={1} onChange={setQuantity} />
          </label>
          <button type="submit" className="btn" disabled={!parent || !child || parent === child || quantity <= 0}>
            + Agregar
          </button>
        </form>
      </div>
    </Section>
  );
}
