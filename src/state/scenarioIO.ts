import type { BomLine, Item, ItemTypeSetting, LotPolicy, Scenario } from '../domain/types';
import { MAX_HORIZON } from '../domain/validation';

const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

const numArray = (v: unknown): number[] => (Array.isArray(v) ? v.map((x) => num(x)) : []);

const ITEM_TYPES: ItemTypeSetting[] = ['auto', 'compra', 'fabricacion'];

function parseLotPolicy(v: unknown): LotPolicy {
  const p = v as { kind?: unknown; lotSize?: unknown } | null;
  if (p?.kind === 'FIXED') return { kind: 'FIXED', lotSize: num(p.lotSize, 1) };
  return { kind: 'L4L' };
}

function parseOverrides(v: unknown): Record<number, number> | undefined {
  if (typeof v !== 'object' || v === null) return undefined;
  const entries = Object.entries(v as Record<string, unknown>)
    .map(([k, q]) => [Number(k), num(q, NaN)] as const)
    .filter(([k, q]) => Number.isInteger(k) && k >= 0 && Number.isFinite(q));
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function parseItem(v: unknown, index: number): Item {
  if (typeof v !== 'object' || v === null) throw new Error(`El ítem #${index + 1} no es válido.`);
  const o = v as Record<string, unknown>;
  if (typeof o.code !== 'string') throw new Error(`El ítem #${index + 1} no tiene código.`);
  const overrides = parseOverrides(o.forecastOverrides);
  return {
    code: o.code,
    description: typeof o.description === 'string' ? o.description : '',
    initialStock: num(o.initialStock),
    leadTime: num(o.leadTime),
    safetyStock: num(o.safetyStock),
    lotPolicy: parseLotPolicy(o.lotPolicy),
    type: ITEM_TYPES.includes(o.type as ItemTypeSetting) ? (o.type as ItemTypeSetting) : 'auto',
    scheduledReceipts: numArray(o.scheduledReceipts),
    demand: numArray(o.demand),
    ...(overrides ? { forecastOverrides: overrides } : {}),
  };
}

function parseBomLine(v: unknown, index: number): BomLine {
  const o = v as Record<string, unknown> | null;
  if (!o || typeof o.parent !== 'string' || typeof o.child !== 'string') {
    throw new Error(`La línea #${index + 1} de la BOM no es válida.`);
  }
  return { parent: o.parent, child: o.child, quantity: num(o.quantity, 1) };
}

/** Convierte un objeto JSON en un escenario, completando los campos faltantes. */
export function parseScenario(data: unknown): Scenario {
  if (typeof data !== 'object' || data === null) throw new Error('El archivo no contiene un escenario.');
  const o = data as Record<string, unknown>;
  if (!Array.isArray(o.items) || !Array.isArray(o.bom)) {
    throw new Error('El escenario debe tener las listas "items" y "bom".');
  }
  return {
    name: typeof o.name === 'string' ? o.name : 'Escenario importado',
    horizon: Math.min(MAX_HORIZON, Math.max(1, Math.round(num(o.horizon, 12)))),
    forecastEnabled: typeof o.forecastEnabled === 'boolean' ? o.forecastEnabled : true,
    items: o.items.map(parseItem),
    bom: o.bom.map(parseBomLine),
  };
}

export function downloadScenario(s: Scenario): void {
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${s.name.replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, '').trim() || 'escenario'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

const STORAGE_KEY = 'mrp-pcp:scenario:v1';

export function loadStoredScenario(): Scenario | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parseScenario(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function storeScenario(s: Scenario): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Sin almacenamiento disponible (modo privado, cuota): la app sigue funcionando.
  }
}
