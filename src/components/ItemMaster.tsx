import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { useState, type Dispatch, type ReactNode } from 'react';
import { childrenOf, endItems, parentsOf, resolveItemType, usableBomLines } from '../domain/bom';
import type { ForecastPlan } from '../domain/forecast';
import { annualHoldingCost, costsComplete, holdingCostPerWeek, withCost } from '../domain/economicLot';
import { eoqForRecord } from '../domain/lotComparison';
import { describeLotPolicy, isEconomicKind, lotSizingRules } from '../domain/lotSizing';
import { orderSummaryByItem } from '../domain/reports';
import type { Item, ItemCosts, ItemTypeSetting, LotPolicyKind, MrpResult, Scenario } from '../domain/types';
import type { GlossaryId } from '../help/glossary';
import type { ViewId } from '../navigation';
import { nextItemCode, type ScenarioAction } from '../state/useScenario';
import { DecimalInput, IssueList, NumberInput, TYPE_LABEL, fmt, fmtDec, fmtMoney } from './common';
import { ConfirmButton } from './ConfirmButton';
import { forecastCell } from './MpsEditor';
import { PageHeader } from './shell/PageHeader';
import { ItemCode, StatusChip, TypeChip } from './ui/Chips';
import { ItemList } from './ui/ItemList';
import { Panel } from './ui/Panel';
import { SegmentedControl } from './ui/SegmentedControl';
import { Term } from './ui/Term';
import { WeekGrid } from './ui/WeekGrid';

function Field({
  label,
  term,
  help,
  htmlFor,
  children,
}: {
  label: string;
  term?: GlossaryId;
  help?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {term && (
          <>
            {' '}
            <Term id={term} />
          </>
        )}
      </label>
      {children}
      {help && <p className="field-help">{help}</p>}
    </div>
  );
}

function WithUnit({ unit, children }: { unit: string; children: ReactNode }) {
  return (
    <span className="input-unit">
      {children}
      <span className="unit">{unit}</span>
    </span>
  );
}

function CodeField({ code, taken, onRename }: { code: string; taken: (c: string) => boolean; onRename: (c: string) => void }) {
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
    <>
      <input
        id="item-code"
        className={`text-input code-input ${invalid ? 'invalid' : ''}`}
        value={draft}
        aria-invalid={invalid}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      {invalid && <p className="field-error">El código no puede quedar vacío ni repetirse.</p>}
    </>
  );
}

function ItemSheet({
  item,
  scenario,
  forecast,
  result,
  dispatch,
  onSelect,
  onNavigate,
}: {
  item: Item;
  scenario: Scenario;
  forecast: ForecastPlan | null;
  result: MrpResult;
  dispatch: Dispatch<ScenarioAction>;
  onSelect: (code: string) => void;
  onNavigate: (view: ViewId, item?: string) => void;
}) {
  const bom = usableBomLines(scenario.items, scenario.bom);
  const isFinal = endItems(scenario.items, bom).some((i) => i.code === item.code);
  const autoType = resolveItemType({ ...item, type: 'auto' }, bom);
  const type = resolveItemType(item, bom);
  const record = result.records.find((r) => r.code === item.code);
  const summary = orderSummaryByItem(result).find((s) => s.itemCode === item.code);
  const issues = result.issues.filter((i) => i.itemCode === item.code);
  const parents = parentsOf(bom, item.code);
  const children = childrenOf(bom, item.code);
  const update = (patch: Partial<Omit<Item, 'code'>>) => dispatch({ type: 'updateItem', code: item.code, patch });
  const codes = new Set(scenario.items.map((i) => i.code));
  const lot = item.lotPolicy;
  const costs = item.costs;
  const complete = costsComplete(costs);
  const eoq = lot.kind === 'EOQ' && record ? eoqForRecord(record, scenario.horizon) : null;
  const setCost = (field: keyof ItemCosts, value: number) => update({ costs: withCost(costs, field, value) });

  return (
    <div className="sheet">
      <section className="sheet-header">
        <div className="sheet-title">
          <ItemCode code={item.code} large />
          <div>
            <h2>{item.description || `Ítem ${item.code}`}</h2>
            <div className="chip-row">
              <TypeChip type={type} />
              {record && <StatusChip>Nivel {record.level}</StatusChip>}
              {isFinal && <StatusChip tone="info">Producto final</StatusChip>}
              {summary && summary.pastDueCount > 0 && <StatusChip tone="critical">Orden atrasada</StatusChip>}
            </div>
          </div>
        </div>
        {summary && (
          <dl className="stat-row">
            <div>
              <dt>Órdenes en el horizonte</dt>
              <dd>{summary.orderCount}</dd>
            </div>
            <div>
              <dt>Primera emisión</dt>
              <dd className={summary.pastDueCount ? 'text-critical' : undefined}>
                {summary.firstReleaseWeek === null ? '—' : `S${summary.firstReleaseWeek}`}
              </dd>
            </div>
            <div>
              <dt>Total a pedir</dt>
              <dd>{fmt(summary.totalQuantity)} u.</dd>
            </div>
          </dl>
        )}
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!record}
          onClick={() => onNavigate('explosion', item.code)}
        >
          Ver explosión MRP <ArrowRight size={16} aria-hidden />
        </button>
      </section>

      {issues.length > 0 && <IssueList issues={issues} />}

      <div className="sheet-grid">
        <Panel title="Identificación">
          <div className="form-grid">
            <Field label="Código" htmlFor="item-code" help="Si lo cambiás, se actualiza en la lista de materiales.">
              <CodeField
                code={item.code}
                taken={(c) => codes.has(c)}
                onRename={(to) => {
                  dispatch({ type: 'renameItem', from: item.code, to });
                  onSelect(to);
                }}
              />
            </Field>
            <Field label="Descripción" htmlFor="item-description">
              <input
                id="item-description"
                className="text-input"
                value={item.description}
                onChange={(e) => update({ description: e.currentTarget.value })}
              />
            </Field>
          </div>
        </Panel>

        <Panel title="Inventario">
          <div className="form-grid">
            <Field label="Stock inicial" htmlFor="item-stock" help="Unidades disponibles al comenzar la semana 1.">
              <WithUnit unit="u.">
                <NumberInput id="item-stock" label="Stock inicial" value={item.initialStock} onChange={(v) => update({ initialStock: v })} />
              </WithUnit>
            </Field>
            <Field
              label="Stock de seguridad"
              term="SS"
              htmlFor="item-ss"
              help="Mínimo que el plan mantiene siempre. En el ejercicio es 0."
            >
              <WithUnit unit="u.">
                <NumberInput id="item-ss" label="Stock de seguridad" value={item.safetyStock} onChange={(v) => update({ safetyStock: v })} />
              </WithUnit>
            </Field>
          </div>
        </Panel>

        <Panel title="Abastecimiento" className="span-2">
          <div className="form-grid form-grid-3">
            <Field
              label="Tipo de ítem"
              help={`Automático: ${autoType === 'fabricacion' ? 'es de fabricación porque tiene componentes' : 'es de compra porque no tiene componentes'}.`}
            >
              <SegmentedControl<ItemTypeSetting>
                label="Tipo de ítem"
                value={item.type}
                onChange={(v) => update({ type: v })}
                options={[
                  { value: 'auto', label: 'Automático' },
                  { value: 'compra', label: 'Compra' },
                  { value: 'fabricacion', label: 'Fabricación' },
                ]}
              />
            </Field>
            <Field label="Lead time" term="LT" htmlFor="item-lt" help="Semanas entre emitir la orden y recibirla.">
              <WithUnit unit="semanas">
                <NumberInput id="item-lt" label="Lead time" value={item.leadTime} onChange={(v) => update({ leadTime: Math.round(v) })} />
              </WithUnit>
            </Field>
            <Field
              label="Política de loteo"
              htmlFor="item-lot-policy"
              help={
                <>
                  {lotSizingRules[lot.kind].help}
                  {eoq && (
                    <>
                      {' '}
                      <strong>EOQ calculada: {fmt(eoq.quantity)} u.</strong>
                    </>
                  )}
                </>
              }
            >
              <div className="lot-field">
                <select
                  id="item-lot-policy"
                  value={lot.kind}
                  onChange={(e) => {
                    const kind = e.currentTarget.value as LotPolicyKind;
                    update({
                      lotPolicy:
                        kind === 'FIXED' ? { kind: 'FIXED', lotSize: lot.kind === 'FIXED' ? lot.lotSize : 50 } : { kind },
                    });
                  }}
                >
                  <optgroup label="Sin costos">
                    <option value="L4L">{lotSizingRules.L4L.label}</option>
                    <option value="FIXED">{lotSizingRules.FIXED.label}</option>
                  </optgroup>
                  <optgroup label="Por costos">
                    <option value="EOQ">{lotSizingRules.EOQ.label}</option>
                    <option value="LTC">{lotSizingRules.LTC.label}</option>
                    <option value="LUC">{lotSizingRules.LUC.label}</option>
                  </optgroup>
                </select>
                {lot.kind === 'FIXED' && (
                  <WithUnit unit="u. por lote">
                    <NumberInput
                      id="item-lot"
                      label="Tamaño de lote"
                      min={1}
                      value={lot.lotSize}
                      onChange={(v) => update({ lotPolicy: { kind: 'FIXED', lotSize: v } })}
                    />
                  </WithUnit>
                )}
              </div>
              {isEconomicKind(lot.kind) && !complete && (
                <p className="field-error">
                  Faltan costos: mientras no cargues C, S e i en el panel Costos, el MRP calcula lote por lote.
                </p>
              )}
            </Field>
          </div>
        </Panel>

        <Panel
          title="Costos"
          subtitle="Se usan en las técnicas de loteo por costos (EOQ, LTC y LUC) y para valorizar las compras."
          actions={
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('loteo', item.code)}>
              Comparar técnicas <ArrowRight size={14} aria-hidden />
            </button>
          }
          className="span-2"
        >
          <div className="form-grid form-grid-3" id="item-costs">
            <Field label="Costo unitario" term="COSTO_UNIT" htmlFor="item-cost-unit" help="Lo que cuesta una unidad.">
              <WithUnit unit="$ / u.">
                <DecimalInput id="item-cost-unit" label="Costo unitario" value={costs?.unitCost} onChange={(v) => setCost('unitCost', v)} />
              </WithUnit>
            </Field>
            <Field
              label={type === 'compra' ? 'Costo de pedido' : 'Costo de preparación'}
              term="COSTO_PEDIDO"
              htmlFor="item-cost-order"
              help={type === 'compra' ? 'Costo fijo de emitir cada orden de compra.' : 'Costo fijo de preparar cada tanda de fabricación.'}
            >
              <WithUnit unit="$ / orden">
                <DecimalInput
                  id="item-cost-order"
                  label={type === 'compra' ? 'Costo de pedido' : 'Costo de preparación'}
                  value={costs?.orderCost}
                  onChange={(v) => setCost('orderCost', v)}
                />
              </WithUnit>
            </Field>
            <Field
              label="Costo de mantener"
              term="COSTO_MANT"
              htmlFor="item-cost-holding"
              help={
                complete
                  ? `h = ${fmtMoney(holdingCostPerWeek(costs))} por u. y semana · H = ${fmtMoney(annualHoldingCost(costs))} por u. y año (${fmtDec(costs.holdingRate / 52, 3)} % semanal).`
                  : 'Porcentaje anual del costo unitario. En el ejemplo de la cátedra, 26 % (0,5 % por semana).'
              }
            >
              <WithUnit unit="% anual">
                <DecimalInput
                  id="item-cost-holding"
                  label="Costo de mantener (% anual)"
                  value={costs?.holdingRate}
                  onChange={(v) => setCost('holdingRate', v)}
                />
              </WithUnit>
            </Field>
          </div>
        </Panel>

        <Panel
          title={
            <>
              Entregas programadas <Term id="RP" />
            </>
          }
          subtitle="Órdenes ya emitidas antes del plan, con la semana en que llegan."
          className="span-2"
          flush
        >
          <WeekGrid
            caption={`Entregas programadas de ${item.code}`}
            horizon={scenario.horizon}
            rows={[
              {
                id: 'rp',
                label: 'Unidades que llegan',
                values: item.scheduledReceipts,
                onChange: (week, value) =>
                  dispatch({ type: 'setWeekValue', code: item.code, field: 'scheduledReceipts', week, value }),
              },
            ]}
          />
        </Panel>

        <Panel
          title={isFinal ? 'Demanda (plan maestro)' : 'Demanda independiente'}
          subtitle={
            isFinal
              ? 'Es un producto final: su demanda se carga en el plan maestro de producción. Las semanas con P son pronóstico.'
              : 'Unidades que se venden sueltas (repuestos). Se suman a lo que piden sus padres.'
          }
          actions={
            isFinal && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('pmp')}>
                Editar en el plan maestro
              </button>
            )
          }
          className="span-2"
          flush
        >
          <WeekGrid
            caption={`Demanda de ${item.code}`}
            horizon={scenario.horizon}
            rows={[
              {
                id: 'demand',
                label: isFinal ? 'PMP' : 'Repuestos',
                values: item.demand,
                ...(isFinal ? forecastCell(forecast, item.code) : {}),
                onChange: isFinal
                  ? undefined
                  : (week, value) => dispatch({ type: 'setWeekValue', code: item.code, field: 'demand', week, value }),
              },
            ]}
          />
        </Panel>

        <Panel
          title="Estructura"
          subtitle="Hacé clic en un ítem para abrir su ficha."
          actions={
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate('bom')}>
              Editar lista de materiales
            </button>
          }
          className="span-2"
        >
          <div className="structure-links">
            <div>
              <h3>Se usa en</h3>
              {parents.length ? (
                <div className="chip-row">
                  {parents.map((l) => (
                    <button key={l.parent} type="button" className="link-chip" onClick={() => onSelect(l.parent)}>
                      <ItemCode code={l.parent} /> × {l.quantity}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted">No es componente de ningún ítem.</p>
              )}
            </div>
            <div>
              <h3>Componentes</h3>
              {children.length ? (
                <div className="chip-row">
                  {children.map((l) => (
                    <button key={l.child} type="button" className="link-chip" onClick={() => onSelect(l.child)}>
                      <ItemCode code={l.child} /> × {l.quantity}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted">No tiene componentes.</p>
              )}
            </div>
          </div>
        </Panel>
      </div>

      <div className="sheet-danger">
        <ConfirmButton
          className="btn btn-danger-ghost"
          label={
            <>
              <Trash2 size={16} aria-hidden /> Eliminar ítem
            </>
          }
          question={`¿Eliminar ${item.code} y sus relaciones en la lista de materiales?`}
          confirmLabel="Eliminar"
          onConfirm={() => {
            const rest = scenario.items.filter((i) => i.code !== item.code);
            dispatch({ type: 'removeItem', code: item.code });
            onSelect(rest[0]?.code ?? '');
          }}
        />
      </div>
    </div>
  );
}

export function ItemMaster({
  scenario,
  forecast,
  result,
  dispatch,
  selected,
  onSelect,
  onNavigate,
}: {
  scenario: Scenario;
  forecast: ForecastPlan | null;
  result: MrpResult;
  dispatch: Dispatch<ScenarioAction>;
  selected: string | null;
  onSelect: (code: string) => void;
  onNavigate: (view: ViewId, item?: string) => void;
}) {
  const bom = usableBomLines(scenario.items, scenario.bom);
  const current = scenario.items.find((i) => i.code === selected) ?? scenario.items[0];
  const late = new Set(result.orders.filter((o) => o.pastDue).map((o) => o.itemCode));
  const withIssues = new Set(result.issues.map((i) => i.itemCode));

  return (
    <>
      <PageHeader view="items" />
      <div className="master-detail">
        <ItemList
          label="Ítems"
          searchable
          selected={current?.code ?? null}
          onSelect={onSelect}
          entries={scenario.items.map((i) => ({
            code: i.code,
            title: i.description || `Ítem ${i.code}`,
            meta: `${TYPE_LABEL[resolveItemType(i, bom)]} · LT ${i.leadTime} · ${describeLotPolicy(i.lotPolicy)}`,
            alert: late.has(i.code) || withIssues.has(i.code),
          }))}
          footer={
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => {
                const code = nextItemCode(scenario.items);
                dispatch({ type: 'addItem' });
                onSelect(code);
              }}
            >
              <Plus size={16} aria-hidden /> Nuevo ítem
            </button>
          }
        />
        {current ? (
          <ItemSheet
            item={current}
            scenario={scenario}
            forecast={forecast}
            result={result}
            dispatch={dispatch}
            onSelect={onSelect}
            onNavigate={onNavigate}
          />
        ) : (
          <Panel title="Sin ítems">
            <p className="muted">Agregá un ítem para empezar.</p>
          </Panel>
        )}
      </div>
    </>
  );
}
