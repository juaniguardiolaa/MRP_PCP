import { Fragment, useState, type Dispatch } from 'react';
import { endItems, resolveItemType, usableBomLines } from '../domain/bom';
import type { Item, ItemTypeSetting, Scenario } from '../domain/types';
import type { ScenarioAction, WeekField } from '../state/useScenario';
import { NumberInput, Section, TYPE_LABEL, fmt, weekNumbers } from './common';

function CodeInput({
  code,
  taken,
  onRename,
}: {
  code: string;
  taken: (c: string) => boolean;
  onRename: (c: string) => void;
}) {
  const [draft, setDraft] = useState(code);
  const [prevCode, setPrevCode] = useState(code);
  if (code !== prevCode) {
    setPrevCode(code);
    setDraft(code);
  }
  const clean = draft.trim().toUpperCase();
  const invalid = !clean || (clean !== code && taken(clean));
  const commit = () => {
    if (invalid) setDraft(code);
    else if (clean !== code) onRename(clean);
  };
  return (
    <input
      className={`text-input code-input ${invalid ? 'invalid' : ''}`}
      value={draft}
      aria-label={`Código del ítem ${code}`}
      title={invalid ? 'Código vacío o repetido' : 'Código del ítem'}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}

/** Resumen "10 u. en S1; 5 u. en S3". */
function weeklySummary(series: number[], horizon: number): string {
  const parts = series
    .slice(0, horizon)
    .map((q, t) => (q ? `${fmt(q)} u. en S${t + 1}` : null))
    .filter(Boolean);
  return parts.length ? parts.join('; ') : 'Ninguna';
}

function WeeklyRow({
  item,
  field,
  label,
  horizon,
  dispatch,
}: {
  item: Item;
  field: WeekField;
  label: string;
  horizon: number;
  dispatch: Dispatch<ScenarioAction>;
}) {
  return (
    <tr>
      <th className="row-head">{label}</th>
      {weekNumbers(horizon).map((w) => (
        <td key={w}>
          <NumberInput
            label={`${label} de ${item.code} en semana ${w}`}
            value={item[field][w - 1] ?? 0}
            onChange={(value) => dispatch({ type: 'setWeekValue', code: item.code, field, week: w - 1, value })}
          />
        </td>
      ))}
    </tr>
  );
}

export function ItemsEditor({
  scenario,
  dispatch,
}: {
  scenario: Scenario;
  dispatch: Dispatch<ScenarioAction>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const bom = usableBomLines(scenario.items, scenario.bom);
  const finals = new Set(endItems(scenario.items, bom).map((i) => i.code));
  const codes = new Set(scenario.items.map((i) => i.code));
  const update = (code: string, patch: Partial<Omit<Item, 'code'>>) =>
    dispatch({ type: 'updateItem', code, patch });

  return (
    <Section
      title="Inventario y maestro de ítems"
      subtitle="Stock inicial, entregas programadas, lead time y política de loteo de cada ítem. Cualquier cambio recalcula el MRP al instante."
      actions={
        <button type="button" className="btn" onClick={() => dispatch({ type: 'addItem' })}>
          + Agregar ítem
        </button>
      }
    >
      <div className="table-scroll">
        <table className="grid-table items-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descripción</th>
              <th>Tipo</th>
              <th>Stock inicial</th>
              <th title="Stock de seguridad (opcional)">Stock seg.</th>
              <th>Lead time (sem.)</th>
              <th>Política de loteo</th>
              <th>Lote</th>
              <th>Entregas programadas</th>
              <th aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {scenario.items.map((item) => {
              const open = expanded === item.code;
              const auto = resolveItemType({ ...item, type: 'auto' }, bom);
              return (
                <Fragment key={item.code}>
                  <tr className={open ? 'row-open' : undefined}>
                    <td>
                      <CodeInput
                        code={item.code}
                        taken={(c) => codes.has(c)}
                        onRename={(to) => {
                          dispatch({ type: 'renameItem', from: item.code, to });
                          if (open) setExpanded(to);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="text-input"
                        value={item.description}
                        aria-label={`Descripción de ${item.code}`}
                        onChange={(e) => update(item.code, { description: e.currentTarget.value })}
                      />
                    </td>
                    <td>
                      <select
                        value={item.type}
                        aria-label={`Tipo de ${item.code}`}
                        onChange={(e) => update(item.code, { type: e.currentTarget.value as ItemTypeSetting })}
                      >
                        <option value="auto">Auto ({TYPE_LABEL[auto]})</option>
                        <option value="compra">Compra</option>
                        <option value="fabricacion">Fabricación</option>
                      </select>
                    </td>
                    <td>
                      <NumberInput
                        label={`Stock inicial de ${item.code}`}
                        value={item.initialStock}
                        onChange={(v) => update(item.code, { initialStock: v })}
                      />
                    </td>
                    <td>
                      <NumberInput
                        label={`Stock de seguridad de ${item.code}`}
                        value={item.safetyStock}
                        onChange={(v) => update(item.code, { safetyStock: v })}
                      />
                    </td>
                    <td>
                      <NumberInput
                        label={`Lead time de ${item.code}`}
                        value={item.leadTime}
                        onChange={(v) => update(item.code, { leadTime: Math.round(v) })}
                      />
                    </td>
                    <td>
                      <select
                        value={item.lotPolicy.kind}
                        aria-label={`Política de loteo de ${item.code}`}
                        onChange={(e) =>
                          update(item.code, {
                            lotPolicy:
                              e.currentTarget.value === 'FIXED'
                                ? { kind: 'FIXED', lotSize: item.lotPolicy.kind === 'FIXED' ? item.lotPolicy.lotSize : 50 }
                                : { kind: 'L4L' },
                          })
                        }
                      >
                        <option value="L4L">Lote por lote (L4L)</option>
                        <option value="FIXED">Lote fijo</option>
                      </select>
                    </td>
                    <td>
                      {item.lotPolicy.kind === 'FIXED' ? (
                        <NumberInput
                          label={`Tamaño de lote de ${item.code}`}
                          value={item.lotPolicy.lotSize}
                          min={1}
                          onChange={(v) => update(item.code, { lotPolicy: { kind: 'FIXED', lotSize: v } })}
                        />
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="link-btn"
                        aria-expanded={open}
                        onClick={() => setExpanded(open ? null : item.code)}
                      >
                        {open ? '▾' : '▸'} {weeklySummary(item.scheduledReceipts, scenario.horizon)}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="icon-btn"
                        title={`Eliminar ${item.code}`}
                        aria-label={`Eliminar ${item.code}`}
                        onClick={() => {
                          if (window.confirm(`¿Eliminar el ítem ${item.code} y sus relaciones en la BOM?`)) {
                            dispatch({ type: 'removeItem', code: item.code });
                          }
                        }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                  {open && (
                    <tr className="row-detail">
                      <td colSpan={10}>
                        <div className="table-scroll">
                          <table className="grid-table compact">
                            <thead>
                              <tr>
                                <th>{item.code} – cantidades por semana</th>
                                {weekNumbers(scenario.horizon).map((w) => (
                                  <th key={w}>S{w}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              <WeeklyRow
                                item={item}
                                field="scheduledReceipts"
                                label="Entregas programadas (RP)"
                                horizon={scenario.horizon}
                                dispatch={dispatch}
                              />
                              <WeeklyRow
                                item={item}
                                field="demand"
                                label={finals.has(item.code) ? 'Plan maestro (PMP)' : 'Demanda independiente'}
                                horizon={scenario.horizon}
                                dispatch={dispatch}
                              />
                            </tbody>
                          </table>
                        </div>
                        <p className="muted small">
                          La demanda independiente de un componente representa las “partes componentes fuera del
                          programa” (repuestos, servicio técnico) y se suma a sus necesidades brutas.
                        </p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
