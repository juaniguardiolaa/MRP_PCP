import type { ReactNode } from 'react';
import {
  buildProductTree,
  endItems,
  findCycle,
  parentsOf,
  resolveItemType,
  treeDepth,
  usableBomLines,
  type TreeNode,
} from '../domain/bom';
import type { ItemType, MrpResult, Scenario } from '../domain/types';
import { PageHeader } from './shell/PageHeader';
import { ItemCode, TypeChip } from './ui/Chips';
import { Panel } from './ui/Panel';
import { Term } from './ui/Term';

const NODE_W = 76;
const NODE_H = 30;
const SLOT_W = 92;
const LEVEL_H = 72;
const LABEL_W = 70;

interface Placed {
  node: TreeNode;
  x: number; // centro
  y: number; // borde superior
  children: Placed[];
}

/** Ubica las hojas en ranuras consecutivas y centra cada padre sobre sus hijos. */
function layout(root: TreeNode): { tree: Placed; leaves: number } {
  let slot = 0;
  const place = (node: TreeNode): Placed => {
    const children = node.children.map(place);
    const x = children.length
      ? (children[0].x + children[children.length - 1].x) / 2
      : LABEL_W + SLOT_W * (slot++ + 0.5);
    return { node, x, y: node.depth * LEVEL_H + 8, children };
  };
  const tree = place(root);
  return { tree, leaves: Math.max(slot, 1) };
}

export function TreeSvg({
  root,
  typeOf,
  highlight,
}: {
  root: TreeNode;
  typeOf: (code: string) => ItemType;
  /** Código a resaltar en el árbol (p. ej. el conjunto elegido en la BOM). */
  highlight?: string | null;
}) {
  const { tree, leaves } = layout(root);
  const depth = treeDepth(root);
  const width = LABEL_W + leaves * SLOT_W;
  const height = (depth + 1) * LEVEL_H;
  const elements: ReactNode[] = [];

  const draw = (p: Placed, key: string) => {
    if (p.children.length) {
      const midY = p.y + NODE_H + (LEVEL_H - NODE_H) / 2;
      const xs = p.children.map((c) => c.x);
      elements.push(
        <path
          key={`${key}-l`}
          className="tree-link"
          d={
            `M${p.x},${p.y + NODE_H}V${midY}M${Math.min(...xs)},${midY}H${Math.max(...xs)}` +
            xs.map((x) => `M${x},${midY}V${midY + (LEVEL_H - NODE_H) / 2}`).join('')
          }
        />,
      );
    }
    const label = p.node.depth === 0 ? p.node.code : `${p.node.code} (${p.node.quantity})`;
    const classes = ['tree-node', `tree-${typeOf(p.node.code)}`, p.node.code === highlight && 'tree-highlight']
      .filter(Boolean)
      .join(' ');
    elements.push(
      <g key={key} className={classes}>
        <rect x={p.x - NODE_W / 2} y={p.y} width={NODE_W} height={NODE_H} rx={3} />
        <text x={p.x} y={p.y + NODE_H / 2} dominantBaseline="central" textAnchor="middle">
          {label}
        </text>
      </g>,
    );
    p.children.forEach((c, i) => draw(c, `${key}.${i}`));
  };
  draw(tree, 'n');

  return (
    <svg
      className="tree-svg"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={`Estructura del producto ${root.code}`}
    >
      {Array.from({ length: depth + 1 }, (_, lvl) => (
        <g key={lvl}>
          {lvl > 0 && <line className="tree-level-line" x1={0} x2={width} y1={lvl * LEVEL_H} y2={lvl * LEVEL_H} />}
          <text className="tree-level" x={4} y={lvl * LEVEL_H + 8 + NODE_H / 2} dominantBaseline="central">
            Nivel {lvl}
          </text>
        </g>
      ))}
      {elements}
    </svg>
  );
}

export function TreeLegend() {
  return (
    <p className="legend">
      <span className="legend-swatch swatch-fabricacion" /> Fabricación
      <span className="legend-swatch swatch-compra" /> Compra
      <span className="legend-note">El número entre paréntesis es el coeficiente de uso.</span>
    </p>
  );
}

/** Un árbol por producto final. */
export function TreeGallery({ scenario, highlight }: { scenario: Scenario; highlight?: string | null }) {
  const bom = usableBomLines(scenario.items, scenario.bom);
  const cycle = findCycle(scenario.items, bom);
  if (cycle) {
    return <p className="text-critical">No se puede dibujar el árbol: la lista de materiales tiene un ciclo ({cycle.join(' → ')}).</p>;
  }
  const typeOf = (code: string) => {
    const item = scenario.items.find((i) => i.code === code);
    return item ? resolveItemType(item, bom) : 'compra';
  };
  return (
    <div className="tree-grid">
      {endItems(scenario.items, bom).map((p) => (
        <figure key={p.code} className="tree-card">
          <figcaption>
            <ItemCode code={p.code} /> {p.description}
          </figcaption>
          <div className="table-scroll">
            <TreeSvg root={buildProductTree(p.code, bom)} typeOf={typeOf} highlight={highlight} />
          </div>
        </figure>
      ))}
    </div>
  );
}

export function LevelTable({ scenario, result }: { scenario: Scenario; result: MrpResult }) {
  const bom = usableBomLines(scenario.items, scenario.bom);
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Ítem</th>
            <th scope="col">Descripción</th>
            <th scope="col" className="num">
              <Term id="LLC" />
            </th>
            <th scope="col">Tipo</th>
            <th scope="col">Se usa en (coeficiente)</th>
            <th scope="col" className="num">
              <Term id="LT" />
            </th>
          </tr>
        </thead>
        <tbody>
          {result.records.map((r) => (
            <tr key={r.code}>
              <th scope="row">
                <ItemCode code={r.code} />
              </th>
              <td>{r.description}</td>
              <td className="num">{r.level}</td>
              <td>
                <TypeChip type={r.type} />
              </td>
              <td>
                {parentsOf(bom, r.code)
                  .map((l) => `${l.parent} (${l.quantity})`)
                  .join(', ') || <span className="muted">Producto final</span>}
              </td>
              <td className="num">{r.leadTime} sem.</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProductStructure({ scenario, result }: { scenario: Scenario; result: MrpResult }) {
  return (
    <>
      <PageHeader view="estructura" />
      <Panel title="Árbol de cada producto final" actions={<TreeLegend />}>
        <TreeGallery scenario={scenario} />
      </Panel>
      <Panel
        title="Códigos de nivel inferior"
        subtitle="El MRP calcula cada ítem en el nivel más bajo en que aparece, para sumar antes lo que piden todos sus padres."
        flush
      >
        <LevelTable scenario={scenario} result={result} />
      </Panel>
    </>
  );
}
