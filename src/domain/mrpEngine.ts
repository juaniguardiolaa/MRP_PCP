import { childrenOf, lowLevelCodes, resolveItemType, usableBomLines } from './bom';
import { applyLotPolicy } from './lotSizing';
import type { Issue, MrpRecord, MrpResult, PlannedOrder, Scenario } from './types';
import { validateScenario } from './validation';

/** Serie semanal de largo `horizon` (completa con ceros o descarta lo que sobra). */
export function toSeries(values: readonly number[], horizon: number): number[] {
  return Array.from({ length: horizon }, (_, t) => values[t] ?? 0);
}

const byLevelThenCode = (la: number, lb: number, a: string, b: string) =>
  la - lb || a.localeCompare(b);

/**
 * Explosión de necesidades MRP I.
 *
 * Para cada ítem, en orden de código de nivel inferior, y para cada semana t:
 *   NB_t  = demanda independiente_t + Σ (EOP_t del padre × coeficiente de uso)
 *   NN_t  = max(0, NB_t + SS − (D_{t−1} + RP_t))            con D_0 = stock inicial
 *   ROP_t = cantidad según la política de loteo (si NN_t > 0)
 *   D_t   = D_{t−1} + RP_t + ROP_t − NB_t
 *   EOP_{t−LT} = ROP_t
 *
 * Si t − LT cae antes de la semana 1, la orden queda atrasada: se informa como alerta y
 * sus necesidades de componentes se cargan en la semana 1 (se supone que se libera ya).
 */
export function runMrp(scenario: Scenario): MrpResult {
  const horizon = scenario.horizon;
  const issues = validateScenario(scenario);
  if (issues.some((i) => i.severity === 'error')) {
    return { horizon, records: [], orders: [], alerts: [], issues };
  }

  const bom = usableBomLines(scenario.items, scenario.bom);
  const levels = lowLevelCodes(scenario.items, bom);
  const items = [...scenario.items].sort((a, b) =>
    byLevelThenCode(levels[a.code], levels[b.code], a.code, b.code),
  );

  const gross = new Map(items.map((i) => [i.code, toSeries(i.demand, horizon)]));
  const records: MrpRecord[] = [];
  const orders: PlannedOrder[] = [];
  const alerts: Issue[] = [];

  for (const item of items) {
    const level = levels[item.code];
    const type = resolveItemType(item, bom);
    const nb = gross.get(item.code)!;
    const rp = toSeries(item.scheduledReceipts, horizon);
    const d = new Array<number>(horizon).fill(0);
    const nn = new Array<number>(horizon).fill(0);
    const rop = new Array<number>(horizon).fill(0);
    const eop = new Array<number>(horizon).fill(0);
    let pastDueRelease = 0;

    let onHand = item.initialStock;
    for (let t = 0; t < horizon; t++) {
      const available = onHand + rp[t];
      const net = Math.max(0, nb[t] + item.safetyStock - available);
      const qty =
        net > 0
          ? applyLotPolicy(item.lotPolicy, {
              period: t,
              netRequirement: net,
              grossRequirements: nb,
              scheduledReceipts: rp,
              projectedOnHand: onHand,
              safetyStock: item.safetyStock,
              horizon,
            })
          : 0;
      nn[t] = net;
      rop[t] = qty;
      onHand = available + qty - nb[t];
      d[t] = onHand;

      if (qty > 0) {
        const receiptWeek = t + 1;
        const releaseWeek = receiptWeek - item.leadTime;
        const pastDue = releaseWeek < 1;
        if (pastDue) pastDueRelease += qty;
        else eop[releaseWeek - 1] += qty;
        orders.push({
          itemCode: item.code,
          type,
          level,
          quantity: qty,
          releaseWeek,
          receiptWeek,
          pastDue,
          lotPolicy: item.lotPolicy,
        });
        if (pastDue) {
          alerts.push({
            severity: 'error',
            itemCode: item.code,
            week: receiptWeek,
            message:
              `${item.code}: se necesitan ${net} u. netas en S${receiptWeek} y, con un lead time de ` +
              `${item.leadTime} sem., la orden de ${qty} u. debió emitirse en S${releaseWeek} ` +
              `(${1 - releaseWeek} sem. de atraso). Hay riesgo de faltante si no se acelera la entrega.`,
          });
        }
      }
    }

    for (const line of childrenOf(bom, item.code)) {
      const childGross = gross.get(line.child)!;
      for (let t = 0; t < horizon; t++) childGross[t] += eop[t] * line.quantity;
      if (pastDueRelease > 0) {
        childGross[0] += pastDueRelease * line.quantity;
        alerts.push({
          severity: 'warning',
          itemCode: line.child,
          week: 1,
          message:
            `${line.child}: las ${pastDueRelease * line.quantity} u. que requiere la orden atrasada ` +
            `de ${item.code} se cargaron como necesidad bruta en S1.`,
        });
      }
    }

    if (item.initialStock < item.safetyStock) {
      alerts.push({
        severity: 'info',
        itemCode: item.code,
        message: `${item.code}: el stock inicial (${item.initialStock}) está por debajo del stock de seguridad (${item.safetyStock}).`,
      });
    }

    records.push({
      code: item.code,
      description: item.description,
      level,
      type,
      leadTime: item.leadTime,
      safetyStock: item.safetyStock,
      lotPolicy: item.lotPolicy,
      initialStock: item.initialStock,
      nb,
      rp,
      d,
      nn,
      rop,
      eop,
      pastDueRelease,
    });
  }

  orders.sort(
    (a, b) =>
      a.releaseWeek - b.releaseWeek || byLevelThenCode(a.level, b.level, a.itemCode, b.itemCode),
  );

  return { horizon, records, orders, alerts, issues };
}
