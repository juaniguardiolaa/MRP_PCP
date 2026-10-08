import { Plus, Trash2 } from 'lucide-react';
import { useState, type Dispatch } from 'react';
import { childrenOf, resolveItemType, usableBomLines } from '../domain/bom';
import type { Scenario } from '../domain/types';
import type { ScenarioAction } from '../state/useScenario';
import { IssueList, NumberInput } from './common';
import { TreeGallery, TreeLegend } from './ProductStructure';
import { PageHeader } from './shell/PageHeader';
import { ItemCode, TypeChip } from './ui/Chips';
import { ItemList } from './ui/ItemList';
import { Panel } from './ui/Panel';
import { Term } from './ui/Term';

export function BomEditor({
  scenario,
  dispatch,
  issues,
}: {
  scenario: Scenario;
  dispatch: Dispatch<ScenarioAction>;
  /** Problemas de datos de la BOM (sin ítem asociado). */
  issues: { severity: 'error' | 'warning' | 'info'; message: string }[];
}) {
  const bom = usableBomLines(scenario.items, scenario.bom);
  const parents = scenario.items.filter((i) => scenario.bom.some((l) => l.parent === i.code));
  const others = scenario.items.filter((i) => !parents.includes(i));
  const [selected, setSelected] = useState<string | null>(parents[0]?.code ?? null);
  const parent = scenario.items.find((i) => i.code === selected) ?? parents[0] ?? null;

  // Índice de cada línea en scenario.bom, para editarla o quitarla.
  const lines = parent
    ? scenario.bom.map((line, index) => ({ line, index })).filter(({ line }) => line.parent === parent.code)
    : [];
  const candidates = parent
    ? scenario.items.filter((i) => i.code !== parent.code && !lines.some(({ line }) => line.child === i.code))
    : [];
  const [child, setChild] = useState('');
  const [quantity, setQuantity] = useState(1);
  const childCode = candidates.some((c) => c.code === child) ? child : (candidates[0]?.code ?? '');
  const itemType = (code: string) => {
    const item = scenario.items.find((i) => i.code === code);
    return item ? resolveItemType(item, bom) : 'compra';
  };

  return (
    <>
      <PageHeader view="bom" />
      {issues.length > 0 && <IssueList issues={issues} />}
      <div className="master-detail">
        <ItemList
          label="Conjuntos"
          selected={parent?.code ?? null}
          onSelect={setSelected}
          entries={parents.map((p) => ({
            code: p.code,
            title: p.description || `Ítem ${p.code}`,
            meta: `${childrenOf(scenario.bom, p.code).length} componentes`,
          }))}
          footer={
            others.length > 0 && (
              <label className="field-label" htmlFor="bom-new-parent">
                Agregar componentes a…
                <select
                  id="bom-new-parent"
                  value=""
                  onChange={(e) => e.currentTarget.value && setSelected(e.currentTarget.value)}
                >
                  <option value="">Elegir un ítem</option>
                  {others.map((i) => (
                    <option key={i.code} value={i.code}>
                      {i.code} · {i.description}
                    </option>
                  ))}
                </select>
              </label>
            )
          }
        />

        {parent ? (
          <div className="sheet">
            <Panel
              title={
                <>
                  Componentes de <ItemCode code={parent.code} /> {parent.description}
                </>
              }
              subtitle={
                <>
                  El <Term id="COEF">coeficiente de uso</Term> indica cuántas unidades del componente lleva una unidad de{' '}
                  {parent.code}.
                </>
              }
              flush
            >
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Componente</th>
                      <th scope="col">Tipo</th>
                      <th scope="col" className="num">
                        Coeficiente
                      </th>
                      <th scope="col">
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map(({ line, index }) => {
                      const item = scenario.items.find((i) => i.code === line.child);
                      return (
                        <tr key={index}>
                          <td>
                            <ItemCode code={line.child} /> {item?.description ?? <span className="text-critical">no existe</span>}
                          </td>
                          <td>
                            <TypeChip type={itemType(line.child)} />
                          </td>
                          <td className="cell-input">
                            <NumberInput
                              label={`Coeficiente de ${line.child} en ${line.parent}`}
                              value={line.quantity}
                              min={1}
                              onChange={(v) => dispatch({ type: 'updateBomLine', index, patch: { quantity: v } })}
                            />
                          </td>
                          <td className="cell-actions">
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label={`Quitar ${line.child} de ${line.parent}`}
                              title="Quitar componente"
                              onClick={() => dispatch({ type: 'removeBomLine', index })}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {lines.length === 0 && (
                      <tr>
                        <td colSpan={4} className="muted">
                          {parent.code} todavía no tiene componentes. Agregá el primero abajo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (childCode && quantity > 0) {
                    dispatch({ type: 'addBomLine', line: { parent: parent.code, child: childCode, quantity } });
                  }
                }}
              >
                <label className="field-label" htmlFor="bom-child">
                  Componente
                  <select id="bom-child" value={childCode} onChange={(e) => setChild(e.currentTarget.value)}>
                    {candidates.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} · {c.description}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-label" htmlFor="bom-qty">
                  Coeficiente
                  <NumberInput id="bom-qty" label="Coeficiente de uso" value={quantity} min={1} onChange={setQuantity} />
                </label>
                <button type="submit" className="btn btn-primary" disabled={!childCode || quantity <= 0}>
                  <Plus size={16} aria-hidden /> Agregar componente
                </button>
              </form>
            </Panel>
          </div>
        ) : (
          <Panel title="Sin conjuntos">
            <p className="muted">Elegí un ítem en “Agregar componentes a…” para armar su lista de materiales.</p>
          </Panel>
        )}
      </div>

      <Panel title="Vista del árbol" subtitle="Se actualiza al instante. El ítem elegido aparece resaltado." actions={<TreeLegend />}>
        <TreeGallery scenario={scenario} highlight={parent?.code} />
      </Panel>
    </>
  );
}
