import type { BomLine, Item, ItemType } from './types';

export interface TreeNode {
  code: string;
  /** Coeficiente de uso respecto del padre inmediato (1 para la raíz). */
  quantity: number;
  /** Nivel jerárquico dentro de este árbol (0 = producto final). */
  depth: number;
  children: TreeNode[];
}

/** Líneas de la BOM que referencian ítems existentes y tienen coeficiente positivo. */
export function usableBomLines(items: Item[], bom: BomLine[]): BomLine[] {
  const codes = new Set(items.map((i) => i.code));
  return bom.filter(
    (l) => codes.has(l.parent) && codes.has(l.child) && l.parent !== l.child && l.quantity > 0,
  );
}

export function childrenOf(bom: BomLine[], code: string): BomLine[] {
  return bom.filter((l) => l.parent === code);
}

export function parentsOf(bom: BomLine[], code: string): BomLine[] {
  return bom.filter((l) => l.child === code);
}

/** Productos finales: ítems que no son componente de ningún otro (nivel 0). */
export function endItems(items: Item[], bom: BomLine[]): Item[] {
  const children = new Set(bom.map((l) => l.child));
  return items.filter((i) => !children.has(i.code));
}

export function resolveItemType(item: Item, bom: BomLine[]): ItemType {
  if (item.type !== 'auto') return item.type;
  return bom.some((l) => l.parent === item.code) ? 'fabricacion' : 'compra';
}

/** Devuelve un ciclo de la BOM (p. ej. ['A', 'C', 'A']) o null si no hay. */
export function findCycle(items: Item[], bom: BomLine[]): string[] | null {
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];

  const visit = (code: string): string[] | null => {
    state.set(code, 'visiting');
    stack.push(code);
    for (const line of childrenOf(bom, code)) {
      const s = state.get(line.child);
      if (s === 'visiting') {
        return [...stack.slice(stack.indexOf(line.child)), line.child];
      }
      if (s === undefined) {
        const cycle = visit(line.child);
        if (cycle) return cycle;
      }
    }
    stack.pop();
    state.set(code, 'done');
    return null;
  };

  for (const item of items) {
    if (!state.has(item.code)) {
      const cycle = visit(item.code);
      if (cycle) return cycle;
    }
  }
  return null;
}

/**
 * Código de nivel inferior (low-level code): el nivel más bajo en que aparece cada ítem
 * en cualquier estructura. Procesar el MRP en este orden garantiza que un componente
 * común (p. ej. D o E) se calcule una sola vez, con las necesidades de todos sus padres.
 * Supone una BOM sin ciclos.
 */
export function lowLevelCodes(items: Item[], bom: BomLine[]): Record<string, number> {
  const levels: Record<string, number> = {};
  const assign = (code: string, level: number) => {
    if ((levels[code] ?? -1) >= level) return;
    levels[code] = level;
    for (const line of childrenOf(bom, code)) assign(line.child, level + 1);
  };
  for (const item of endItems(items, bom)) assign(item.code, 0);
  // Ítems que quedaron sin nivel (solo posible con ciclos) se ubican en 0.
  for (const item of items) levels[item.code] ??= 0;
  return levels;
}

export function buildProductTree(root: string, bom: BomLine[]): TreeNode {
  const build = (code: string, quantity: number, depth: number): TreeNode => ({
    code,
    quantity,
    depth,
    children: childrenOf(bom, code).map((l) => build(l.child, l.quantity, depth + 1)),
  });
  return build(root, 1, 0);
}

export function treeDepth(node: TreeNode): number {
  return node.children.reduce((max, c) => Math.max(max, treeDepth(c)), node.depth);
}

/**
 * Lead time acumulado (ruta crítica) de un producto: el camino de la estructura cuya suma
 * de lead times es máxima. Es el tiempo mínimo para fabricar el producto partiendo de cero.
 */
export function cumulativeLeadTime(
  root: string,
  items: Item[],
  bom: BomLine[],
): { weeks: number; path: string[] } {
  const leadTime = new Map(items.map((i) => [i.code, i.leadTime]));
  const walk = (code: string): { weeks: number; path: string[] } => {
    let best = { weeks: 0, path: [] as string[] };
    for (const line of childrenOf(bom, code)) {
      const sub = walk(line.child);
      if (sub.weeks > best.weeks) best = sub;
    }
    return { weeks: (leadTime.get(code) ?? 0) + best.weeks, path: [code, ...best.path] };
  };
  return walk(root);
}
