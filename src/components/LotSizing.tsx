import { CircleCheck, Info, TriangleAlert, Undo2 } from 'lucide-react';
import { useMemo, useState, type CSSProperties, type Dispatch } from 'react';
import { COSTOS_CATEDRA } from '../data/costosCatedra';
import { costsComplete, holdingCostPerWeek, withCost } from '../domain/economicLot';
import {
  compareInPlan,
  lotDecisions,
  recommendLotPolicies,
  type LotComparison,
  type LotOption,
  type PolicyEvaluation,
} from '../domain/lotComparison';
import { describeLotPolicy, lotPolicyShort } from '../domain/lotSizing';
import type { ItemCosts, LotPolicy, LotPolicyKind, MrpRecord, MrpResult, Scenario } from '../domain/types';
import type { ViewId } from '../navigation';
import type { ScenarioAction } from '../state/useScenario';
import { DecimalInput, fmt, fmtDec, fmtMoney, weekNumbers } from './common';
import { ConfirmButton } from './ConfirmButton';
import { PageHeader } from './shell/PageHeader';
import { ItemCode, StatusChip, TypeChip } from './ui/Chips';
import { Panel } from './ui/Panel';
import { SegmentedControl } from './ui/SegmentedControl';
import { Term } from './ui/Term';

const TOLERANCE = 1e-6;
const TECHNIQUE_COLUMNS: LotPolicyKind[] = ['L4L', 'FIXED', 'EOQ', 'LTC', 'LUC'];
const COLUMN_LABEL: Record<LotPolicyKind, string> = {
  L4L: 'L4L',
  FIXED: 'Lote fijo',
  EOQ: 'EOQ',
  LTC: 'LTC',
  LUC: 'LUC',
};

/** Importe sin el signo, con dos decimales, para tablas con muchas columnas. */
const money = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Costo unitario con cuatro decimales, como en la tabla de la cátedra. */
const unit = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const range = (first: number, last: number) => (last > first ? `S${first}–S${last}` : `S${first}`);

const hasAnyCost = (c?: ItemCosts) => !!c && (c.unitCost > 0 || c.orderCost > 0 || c.holdingRate > 0);

/** Comparación de técnicas de cada ítem con costos completos, dentro del plan actual. */
export function useLotComparisons(scenario: Scenario, result: MrpResult) {
  return useMemo(() => compareInPlan(scenario, result), [scenario, result]);
}

const isRecommended = (cmp: LotComparison, o: LotOption) =>
  o.extraPastDue <= TOLERANCE && o.evaluation.totalCost <= cmp.best.evaluation.totalCost + TOLERANCE;

const pastDueText = (units: number) =>
  `Suma ${fmt(units)} u. a las órdenes atrasadas del plan (en este ítem o en sus componentes): no se recomienda.`;

function CostStatus({ costs }: { costs?: ItemCosts }) {
  if (costsComplete(costs)) return <StatusChip tone="ok">Completo</StatusChip>;
  if (hasAnyCost(costs)) return <StatusChip tone="warn">Incompleto</StatusChip>;
  return <StatusChip>Sin costos</StatusChip>;
}

/** Costos de todos los ítems; editable si recibe `onChange`. */
export function CostsTable({
  records,
  onChange,
}: {
  records: MrpRecord[];
  onChange?: (code: string, costs: ItemCosts) => void;
}) {
  return (
    <div className="table-scroll">
      <table className="data-table costs-table">
        <thead>
          <tr>
            <th scope="col">Ítem</th>
            <th scope="col" className="num">
              Costo unitario <Term id="COSTO_UNIT" /> ($/u.)
            </th>
            <th scope="col" className="num">
              Pedido o preparación <Term id="COSTO_PEDIDO" /> ($/orden)
            </th>
            <th scope="col" className="num">
              Mantener <Term id="COSTO_MANT" /> (% anual)
            </th>
            <th scope="col" className="num">
              h ($/u. y semana)
            </th>
            <th scope="col">Estado</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const c = r.costs;
            const cell = (field: keyof ItemCosts, label: string) =>
              onChange ? (
                <DecimalInput
                  className="cost-input"
                  label={`${label} de ${r.code}`}
                  value={c?.[field]}
                  onChange={(v) => onChange(r.code, withCost(c, field, v))}
                />
              ) : c?.[field] ? (
                fmtDec(c[field], 2)
              ) : (
                '—'
              );
            return (
              <tr key={r.code}>
                <th scope="row">
                  <ItemCode code={r.code} /> <span className="muted">{r.description}</span>{' '}
                  <TypeChip type={r.type} />
                </th>
                <td className="num">{cell('unitCost', 'Costo unitario')}</td>
                <td className="num">{cell('orderCost', r.type === 'compra' ? 'Costo de pedido' : 'Costo de preparación')}</td>
                <td className="num">{cell('holdingRate', 'Costo de mantener (% anual)')}</td>
                <td className="num">{costsComplete(c) ? fmtDec(holdingCostPerWeek(c), 4) : '—'}</td>
                <td>
                  <CostStatus costs={c} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const optionFor = (cmp: LotComparison, kind: LotPolicyKind) => cmp.options.find((o) => o.policy.kind === kind);

/** Costo del horizonte de cada técnica por ítem, con la recomendada resaltada. */
export function ComparisonTable({
  records,
  comparisons,
  onApply,
  onSelect,
  selected,
}: {
  records: MrpRecord[];
  comparisons: Map<string, LotComparison | null>;
  onApply?: (code: string, policy: LotPolicy) => void;
  onSelect?: (code: string) => void;
  selected?: string | null;
}) {
  const rows = records.filter((r) => comparisons.get(r.code));
  if (!rows.length) {
    return <p className="muted panel-pad">Ningún ítem tiene los tres costos cargados todavía.</p>;
  }
  return (
    <div className="table-scroll">
      <table className="data-table comparison-table">
        <thead>
          <tr>
            <th scope="col">Ítem</th>
            {TECHNIQUE_COLUMNS.map((k) => (
              <th key={k} scope="col" className="num">
                {k === 'FIXED' ? 'Lote fijo' : <Term id={k} />}
              </th>
            ))}
            <th scope="col">Recomendada</th>
            <th scope="col" className="num">
              Frente a la actual
            </th>
            {onApply && (
              <th scope="col">
                <span className="sr-only">Acciones</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const cmp = comparisons.get(r.code)!;
            const saving = cmp.current.evaluation.totalCost - cmp.best.evaluation.totalCost;
            const isCurrentBest = cmp.best === cmp.current;
            return (
              <tr key={r.code} className={selected === r.code ? 'row-selected' : undefined}>
                <th scope="row">
                  {onSelect ? (
                    <button
                      type="button"
                      className="link-chip"
                      onClick={() => onSelect(r.code)}
                      aria-pressed={selected === r.code}
                      title="Ver el detalle del cálculo"
                    >
                      <ItemCode code={r.code} /> {r.description}
                    </button>
                  ) : (
                    <>
                      <ItemCode code={r.code} /> <span className="muted">{r.description}</span>
                    </>
                  )}
                </th>
                {TECHNIQUE_COLUMNS.map((k) => {
                  const o = optionFor(cmp, k);
                  if (!o) {
                    return (
                      <td key={k} className="num muted">
                        —
                      </td>
                    );
                  }
                  const best = isRecommended(cmp, o);
                  const current = o === cmp.current;
                  return (
                    <td key={k} className={`num ${best ? 'cell-best' : ''}`}>
                      <span className="cost-cell">
                        {o.extraPastDue > 0 && (
                          <span className="cost-flag" title={pastDueText(o.extraPastDue)}>
                            <TriangleAlert size={13} aria-hidden />
                            <span className="sr-only">{pastDueText(o.extraPastDue)}</span>
                          </span>
                        )}
                        {fmtMoney(o.evaluation.totalCost)}
                      </span>
                      {current && <span className="cost-tag">Actual</span>}
                      {best && <span className="sr-only"> (recomendada)</span>}
                    </td>
                  );
                })}
                <td>
                  <strong>{lotPolicyShort(cmp.best.policy)}</strong>
                </td>
                <td className="num">
                  {isCurrentBest ? (
                    <span className="text-ok">
                      <CircleCheck size={14} aria-hidden /> Es la actual
                    </span>
                  ) : saving >= 0 ? (
                    <>
                      Ahorra <strong>{fmtMoney(saving)}</strong>
                    </>
                  ) : (
                    <span title={`La actual suma ${fmt(cmp.current.extraPastDue)} u. a las órdenes atrasadas del plan.`}>
                      Cuesta {fmtMoney(-saving)} más
                      <br />
                      <span className="muted">y evita {fmt(cmp.current.extraPastDue)} u. atrasadas</span>
                    </span>
                  )}
                </td>
                {onApply && (
                  <td className="cell-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={isCurrentBest}
                      onClick={() => onApply(r.code, cmp.best.policy)}
                      title={isCurrentBest ? 'Ya usa la técnica recomendada' : `Usar ${lotPolicyShort(cmp.best.policy)} en ${r.code}`}
                    >
                      Aplicar
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Barras apiladas de costo de mantener y de pedir por técnica. */
function CostBars({ cmp }: { cmp: LotComparison }) {
  const max = Math.max(...cmp.options.map((o) => o.evaluation.totalCost), 1);
  return (
    <figure className="cost-bars">
      <figcaption className="legend">
        <span className="legend-swatch swatch-holding" /> Costo de mantener
        <span className="legend-swatch swatch-ordering" /> Costo de pedir
      </figcaption>
      <ul>
        {cmp.options.map((o) => {
          const e = o.evaluation;
          const best = isRecommended(cmp, o);
          return (
            <li key={o.policy.kind} className="cost-bar-row">
              <span className="cost-bar-label">{lotPolicyShort(o.policy)}</span>
              <span className="cost-bar-track">
                <span className="cost-bar" style={{ '--ratio': e.totalCost / max } as CSSProperties}>
                  {e.holdingCost > 0 && (
                    <span
                      className="cost-seg seg-holding"
                      style={{ flexGrow: e.holdingCost }}
                      title={`${lotPolicyShort(o.policy)} · mantener: ${fmtMoney(e.holdingCost)}`}
                    />
                  )}
                  <span
                    className="cost-seg seg-ordering"
                    style={{ flexGrow: e.orderingCost }}
                    title={`${lotPolicyShort(o.policy)} · pedir: ${e.orders} × ${fmtMoney(cmp.costs.orderCost)} = ${fmtMoney(e.orderingCost)}`}
                  />
                </span>
                <span className="cost-bar-value">
                  {fmtMoney(e.totalCost)}
                  {best && <span className="cost-bar-note">recomendada</span>}
                  {o.extraPastDue > 0 && <span className="cost-bar-note">suma atrasos</span>}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

function EoqFormula({ cmp }: { cmp: LotComparison }) {
  const e = cmp.eoq;
  return (
    <>
      <dl className="fact-row">
        <div className="fact">
          <dt>Necesidad neta del horizonte</dt>
          <dd>
            {fmt(e.totalNet)} u. en {e.weeks} sem.
          </dd>
        </div>
        <div className="fact">
          <dt>Demanda anual D</dt>
          <dd>{fmtDec(e.annualDemand, 1)} u.</dd>
        </div>
        <div className="fact">
          <dt>
            Costo de pedido <Term id="COSTO_PEDIDO" />
          </dt>
          <dd>{fmtMoney(e.orderCost)}</dd>
        </div>
        <div className="fact">
          <dt>
            Mantener H <Term id="COSTO_MANT" />
          </dt>
          <dd>{fmtMoney(e.annualHolding)} por u. y año</dd>
        </div>
        <div className="fact">
          <dt>Mantener h</dt>
          <dd>{fmtMoney(cmp.h)} por u. y semana</dd>
        </div>
        <div className="fact">
          <dt>
            <Term id="EOQ" />
          </dt>
          <dd>{fmt(e.quantity)} u.</dd>
        </div>
      </dl>
      <p className="formula">
        D = {fmt(e.totalNet)} ÷ {e.weeks} × 52 = {fmtDec(e.annualDemand, 1)} u. por año
        <br />
        EOQ = √(2 · D · S ÷ H) = √(2 × {fmtDec(e.annualDemand, 1)} × {money(e.orderCost)} ÷ {money(e.annualHolding)}) ={' '}
        {fmtDec(e.exact, 2)} ≈ <strong>{fmt(e.quantity)} u.</strong>
      </p>
    </>
  );
}

function DecisionTables({ record, kind, horizon }: { record: MrpRecord; kind: 'LTC' | 'LUC'; horizon: number }) {
  const decisions = lotDecisions(record, kind, horizon);
  if (!decisions.length) return <p className="muted">No hay pedidos en el horizonte.</p>;
  return (
    <div className="decision-grid">
      {decisions.map(({ week, choice }) => {
        const chosen = choice.rows[choice.chosen];
        const last = choice.rows[choice.rows.length - 1];
        const previous = choice.rows[choice.rows.length - 2];
        const stopped =
          last !== chosen &&
          (kind === 'LTC' ? last.holdingCost >= last.orderCost : !!previous && last.unitCost > previous.unitCost + 1e-9);
        const why =
          kind === 'LTC'
            ? `Mantener (${fmtMoney(chosen.holdingCost)}) es lo más parecido al costo de pedir (${fmtMoney(chosen.orderCost)}).`
            : `Es el menor costo por unidad (${unit(chosen.unitCost)} $/u.).`;
        const next = stopped
          ? kind === 'LTC'
            ? ` Con ${range(last.firstWeek, last.lastWeek)}, mantener (${fmtMoney(last.holdingCost)}) ya supera al costo de pedir.`
            : ` Con ${range(last.firstWeek, last.lastWeek)}, el costo unitario sube a ${unit(last.unitCost)} $/u.`
          : last !== chosen
            ? ' Las filas siguientes cuestan lo mismo (semanas sin necesidad): en un empate se elige el lote más chico.'
            : '';
        return (
          <div key={week} className="decision">
            <h4>
              Pedido para S{week}: {fmt(chosen.quantity)} u.
              {chosen.lastWeek > chosen.firstWeek ? ` (cubre ${range(chosen.firstWeek, chosen.lastWeek)})` : ''}
            </h4>
            <div className="table-scroll">
              <table className="data-table decision-table">
                <thead>
                  <tr>
                    <th scope="col">Semanas</th>
                    <th scope="col" className="num">
                      Cantidad
                    </th>
                    <th scope="col" className="num">
                      Mantener ($)
                    </th>
                    <th scope="col" className="num">
                      Pedir ($)
                    </th>
                    <th scope="col" className="num">
                      Total ($)
                    </th>
                    {kind === 'LUC' && (
                      <th scope="col" className="num">
                        Unitario ($/u.)
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {choice.rows.map((row, i) => (
                    <tr key={row.lastWeek} className={i === choice.chosen ? 'row-chosen' : undefined}>
                      <td>
                        {range(row.firstWeek, row.lastWeek)}
                        {i === choice.chosen && <span className="cost-tag">Elegido</span>}
                      </td>
                      <td className="num">{fmt(row.quantity)}</td>
                      <td className="num">{money(row.holdingCost)}</td>
                      <td className="num">{money(row.orderCost)}</td>
                      <td className="num">{money(row.totalCost)}</td>
                      {kind === 'LUC' && <td className="num">{unit(row.unitCost)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="decision-note">
              {why}
              {next}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** Costo semana a semana de una técnica, con el formato de las tablas de la cátedra. */
export function WeeklyCostTable({ evaluation, horizon }: { evaluation: PolicyEvaluation; horizon: number }) {
  const weeks = weekNumbers(horizon);
  const w = evaluation.weeks;
  const rows: { label: string; values: (string | number)[]; total: string; className?: string }[] = [
    { label: 'Necesidades brutas (NB)', values: w.map((x) => (x.nb ? fmt(x.nb) : '')), total: fmt(w.reduce((a, x) => a + x.nb, 0)) },
    { label: 'Necesidades netas (NN)', values: w.map((x) => (x.nn ? fmt(x.nn) : '')), total: fmt(w.reduce((a, x) => a + x.nn, 0)) },
    {
      label: 'Cantidad pedida (ROP)',
      values: w.map((x) => (x.quantity ? fmt(x.quantity) : '')),
      total: fmt(w.reduce((a, x) => a + x.quantity, 0)),
      className: 'row-rop',
    },
    { label: 'Inventario final (D)', values: w.map((x) => fmt(x.ending)), total: '' },
    { label: 'Costo de mantener ($)', values: w.map((x) => (x.holding ? money(x.holding) : '')), total: money(evaluation.holdingCost) },
    { label: 'Costo de pedir ($)', values: w.map((x) => (x.ordering ? money(x.ordering) : '')), total: money(evaluation.orderingCost) },
    { label: 'Costo acumulado ($)', values: w.map((x) => money(x.cumulative)), total: money(evaluation.totalCost), className: 'row-total' },
  ];
  return (
    <div className="table-scroll">
      <table className="data-table mrp-table weekly-cost-table">
        <thead>
          <tr>
            <th scope="col" className="sticky-col">
              Concepto
            </th>
            {weeks.map((wk) => (
              <th key={wk} scope="col" className="num">
                S{wk}
              </th>
            ))}
            <th scope="col" className="num">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className={row.className}>
              <th scope="row" className="sticky-col row-head">
                {row.label}
              </th>
              {row.values.map((v, i) => (
                <td key={i} className={`num ${row.className === 'row-rop' && v ? 'hl-rop' : ''}`}>
                  {v}
                </td>
              ))}
              <td className="num total">{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LotDetail({ record, cmp, horizon }: { record: MrpRecord; cmp: LotComparison; horizon: number }) {
  const [pick, setPick] = useState<{ code: string; kind: LotPolicyKind } | null>(null);
  const kind = pick?.code === record.code ? pick.kind : cmp.best.policy.kind;
  const option: LotOption = optionFor(cmp, kind) ?? cmp.best;
  const e = option.evaluation;
  return (
    <>
      <EoqFormula cmp={cmp} />
      {cmp.baseHolding > 0 && (
        <p className="callout">
          <Info size={16} aria-hidden />
          <span>
            {fmtMoney(cmp.baseHolding)} del costo de mantener corresponden al stock que ya existe (stock inicial, entregas
            programadas o stock de seguridad) y son iguales en todas las técnicas.
          </span>
        </p>
      )}
      <div className="lot-detail-grid">
        <Panel
          title="Costo del horizonte por técnica"
          subtitle="Mantener + pedir. Se recomienda la más económica que no suma órdenes atrasadas."
          keepTogether
        >
          <CostBars cmp={cmp} />
        </Panel>
        <Panel
          title={`Técnica: ${describeLotPolicy(option.policy)}`}
          subtitle={
            <>
              {e.orders} {e.orders === 1 ? 'pedido' : 'pedidos'} · mantener {fmtMoney(e.holdingCost)} · pedir {fmtMoney(e.orderingCost)} ·{' '}
              <strong>total {fmtMoney(e.totalCost)}</strong>
            </>
          }
          actions={
            <SegmentedControl<LotPolicyKind>
              label="Técnica a detallar"
              value={option.policy.kind}
              onChange={(k) => setPick({ code: record.code, kind: k })}
              options={cmp.options.map((o) => ({ value: o.policy.kind, label: COLUMN_LABEL[o.policy.kind] }))}
            />
          }
        >
          {option.extraPastDue > 0 && (
            <p className="callout callout-warn">
              <TriangleAlert size={16} aria-hidden />
              <span>
                Con esta técnica el plan suma {fmt(option.extraPastDue)} u. en órdenes atrasadas, en este ítem o en sus
                componentes: el lote es más grande de lo que se puede abastecer a tiempo. Por eso no se recomienda.
              </span>
            </p>
          )}
          {option.policy.kind === 'LTC' || option.policy.kind === 'LUC' ? (
            <DecisionTables record={e.record} kind={option.policy.kind} horizon={horizon} />
          ) : option.policy.kind === 'EOQ' ? (
            <p className="muted">
              Cada vez que hay necesidad neta se piden {fmt(cmp.eoq.quantity)} u. (o la necesidad neta, si es mayor). El lote
              sobrante queda en inventario y paga costo de mantener.
            </p>
          ) : option.policy.kind === 'FIXED' ? (
            <p className="muted">Se piden múltiplos de {fmt(option.policy.lotSize)} u., como fija la consigna.</p>
          ) : (
            <p className="muted">Una orden por cada semana con necesidad neta: no queda inventario, pero se paga S en cada pedido.</p>
          )}
        </Panel>
      </div>
      <Panel title="Costo semana a semana" subtitle={`${describeLotPolicy(option.policy)} · ${record.code}`} flush>
        <WeeklyCostTable evaluation={e} horizon={horizon} />
      </Panel>
    </>
  );
}

export function LotSizing({
  scenario,
  result,
  dispatch,
  selected,
  onSelect,
}: {
  scenario: Scenario;
  result: MrpResult;
  dispatch: Dispatch<ScenarioAction>;
  selected: string | null;
  onSelect: (code: string) => void;
  onNavigate: (view: ViewId, item?: string) => void;
}) {
  const comparisons = useLotComparisons(scenario, result);
  const recommended = useMemo(() => recommendLotPolicies(scenario), [scenario]);
  const [undo, setUndo] = useState<Record<string, LotPolicy> | null>(null);
  const policyOf = (code: string) => scenario.items.find((i) => i.code === code)?.lotPolicy;
  const withCosts = result.records.filter((r) => comparisons.get(r.code));
  const detailRecord = withCosts.find((r) => r.code === selected) ?? withCosts[0];
  const detail = detailRecord && comparisons.get(detailRecord.code);
  const changeCount = Object.keys(recommended).length;
  const anyCosts = scenario.items.some((i) => hasAnyCost(i.costs));

  const remember = (codes: string[]) => {
    const previous: Record<string, LotPolicy> = {};
    for (const code of codes) {
      const p = policyOf(code);
      if (p) previous[code] = p;
    }
    setUndo(previous);
  };

  const loadCatedra = () => dispatch({ type: 'setAllCosts', costs: COSTOS_CATEDRA });
  const catedraLabel = 'Cargar costos de la cátedra';

  return (
    <>
      <PageHeader
        view="loteo"
        actions={
          anyCosts ? (
            <ConfirmButton
              className="btn btn-secondary"
              label={catedraLabel}
              question="¿Reemplazar los costos de todos los ítems por $10, $47 y 26 % anual?"
              confirmLabel="Reemplazar"
              onConfirm={loadCatedra}
            />
          ) : (
            <button type="button" className="btn btn-primary" onClick={loadCatedra}>
              {catedraLabel}
            </button>
          )
        }
      />

      <Panel
        title="Costos por ítem"
        subtitle="Costo unitario, costo de pedido (compras) o de preparación (fabricación) y costo de mantener como % anual del costo unitario. El ejercicio no trae costos."
        flush
      >
        <CostsTable
          records={result.records}
          onChange={(code, costs) => dispatch({ type: 'updateItem', code, patch: { costs } })}
        />
      </Panel>

      <Panel
        title="Comparación de técnicas"
        subtitle="Costo del horizonte (mantener + pedir) con las necesidades brutas actuales de cada ítem. La política de un padre cambia las necesidades de sus componentes: por eso conviene aplicar de arriba hacia abajo."
        actions={
          <>
            {undo && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  dispatch({ type: 'setLotPolicies', policies: undo });
                  setUndo(null);
                }}
              >
                <Undo2 size={14} aria-hidden /> Deshacer
              </button>
            )}
            {withCosts.length > 0 &&
              (changeCount > 0 ? (
                <ConfirmButton
                  className="btn btn-primary btn-sm"
                  label={`Aplicar la recomendada a todos (${changeCount})`}
                  question={`¿Cambiar la política de loteo de ${changeCount} ítem${changeCount > 1 ? 's' : ''}? Reemplaza las políticas actuales, como los lotes fijos de la consigna.`}
                  confirmLabel="Aplicar"
                  onConfirm={() => {
                    remember(Object.keys(recommended));
                    dispatch({ type: 'setLotPolicies', policies: recommended });
                  }}
                />
              ) : (
                <StatusChip tone="ok">Todos los ítems usan la técnica recomendada</StatusChip>
              ))}
          </>
        }
        flush
      >
        {withCosts.length ? (
          <ComparisonTable
            records={result.records}
            comparisons={comparisons}
            selected={detailRecord?.code}
            onSelect={onSelect}
            onApply={(code, policy) => {
              remember([code]);
              dispatch({ type: 'setLotPolicies', policies: { [code]: policy } });
            }}
          />
        ) : (
          <div className="panel-pad empty-costs">
            <p className="muted">
              Cargá el costo unitario, el costo de pedido y el % de mantener de al menos un ítem para comparar las técnicas.
            </p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={loadCatedra}>
              {catedraLabel}
            </button>
          </div>
        )}
        {withCosts.length > 0 && (
          <p className="legend panel-pad-x">
            <span className="legend-swatch swatch-best" /> Recomendada: la más económica que no suma atrasos
            <span className="legend-note">
              <TriangleAlert size={12} aria-hidden /> suma órdenes atrasadas al plan, en el ítem o en sus componentes.
            </span>
          </p>
        )}
      </Panel>

      {detailRecord && detail && (
        <section className="lot-detail" aria-label={`Detalle de ${detailRecord.code}`}>
          <header className="lot-detail-head">
            <h2>
              Detalle del cálculo: <ItemCode code={detailRecord.code} /> {detailRecord.description}
            </h2>
            <select aria-label="Ítem a detallar" value={detailRecord.code} onChange={(e) => onSelect(e.currentTarget.value)}>
              {withCosts.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code} · {r.description}
                </option>
              ))}
            </select>
          </header>
          <LotDetail record={detailRecord} cmp={detail} horizon={result.horizon} />
        </section>
      )}
    </>
  );
}
