import { findCycle } from './bom';
import type { Issue, Scenario } from './types';

export const MAX_HORIZON = 52;

const isNonNegInt = (n: number) => Number.isInteger(n) && n >= 0;

/** Revisa los datos de entrada. Los errores bloquean el cálculo; las advertencias no. */
export function validateScenario(s: Scenario): Issue[] {
  const issues: Issue[] = [];
  const err = (message: string, itemCode?: string) =>
    issues.push({ severity: 'error', message, itemCode });
  const warn = (message: string, itemCode?: string) =>
    issues.push({ severity: 'warning', message, itemCode });

  if (!Number.isInteger(s.horizon) || s.horizon < 1 || s.horizon > MAX_HORIZON) {
    err(`El horizonte debe ser un entero entre 1 y ${MAX_HORIZON} semanas.`);
  }

  const seen = new Set<string>();
  for (const item of s.items) {
    const c = item.code;
    if (!c.trim()) err('Hay un ítem sin código.');
    else if (seen.has(c)) err(`El código "${c}" está repetido.`, c);
    seen.add(c);

    if (!isNonNegInt(item.leadTime)) err(`${c}: el lead time debe ser un entero ≥ 0.`, c);
    if (item.initialStock < 0) err(`${c}: el stock inicial no puede ser negativo.`, c);
    if (item.safetyStock < 0) err(`${c}: el stock de seguridad no puede ser negativo.`, c);
    if (item.lotPolicy.kind === 'FIXED' && !(item.lotPolicy.lotSize > 0)) {
      err(`${c}: el tamaño del lote fijo debe ser mayor que 0.`, c);
    }
    if (item.scheduledReceipts.some((v) => v < 0) || item.demand.some((v) => v < 0)) {
      err(`${c}: hay cantidades semanales negativas.`, c);
    }
    if (item.leadTime >= s.horizon) {
      warn(`${c}: el lead time (${item.leadTime}) es igual o mayor que el horizonte.`, c);
    }
  }

  const pairs = new Set<string>();
  for (const line of s.bom) {
    const label = `${line.parent} → ${line.child}`;
    if (!seen.has(line.parent)) err(`BOM ${label}: el padre "${line.parent}" no existe.`);
    if (!seen.has(line.child)) err(`BOM ${label}: el componente "${line.child}" no existe.`);
    if (line.parent === line.child) err(`BOM ${label}: un ítem no puede ser componente de sí mismo.`);
    if (!(line.quantity > 0)) err(`BOM ${label}: el coeficiente de uso debe ser mayor que 0.`);
    const key = `${line.parent}|${line.child}`;
    if (pairs.has(key)) warn(`BOM ${label}: la relación está cargada dos veces (se suman).`);
    pairs.add(key);
  }

  const cycle = findCycle(s.items, s.bom.filter((l) => l.parent !== l.child));
  if (cycle) err(`La BOM tiene un ciclo: ${cycle.join(' → ')}.`);

  return issues;
}
