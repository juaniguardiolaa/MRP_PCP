import type { ReactNode } from 'react';
import { buildProductTree, endItems, parentsOf, resolveItemType, treeDepth, usableBomLines, type TreeNode } from '../domain/bom';
import type { ItemType, MrpResult, Scenario } from '../domain/types';
import { Section, TypeBadge } from './common';

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

function TreeSvg({ root, typeOf }: { root: TreeNode; typeOf: (code: string) => ItemType }) {
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
    elements.push(
      <g key={key} className={`tree-node tree-${typeOf(p.node.code)}`}>
        <rect x={p.x - NODE_W / 2} y={p.y} width={NODE_W} height={NODE_H} rx={4} />
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

export function ProductStructure({ scenario, result }: { scenario: Scenario; result: MrpResult }) {
  const bom = usableBomLines(scenario.items, scenario.bom);
  const products = endItems(scenario.items, bom);
  const typeOf = (code: string) => {
    const item = scenario.items.find((i) => i.code === code);
    return item ? resolveItemType(item, bom) : 'compra';
  };

  return (
    <Section
      title="Estructura del producto"
      subtitle="Árbol de cada producto final con sus niveles jerárquicos y coeficientes de uso entre partes, entre paréntesis."
    >
      <div className="legend">
        <span className="legend-swatch tree-fabricacion" /> Fabricación
        <span className="legend-swatch tree-compra" /> Compra
      </div>
      <div className="tree-grid">
        {products.map((p) => (
          <figure key={p.code} className="card tree-card">
            <figcaption>
              Producto {p.code} <span className="muted">– {p.description}</span>
            </figcaption>
            <div className="table-scroll">
              <TreeSvg root={buildProductTree(p.code, bom)} typeOf={typeOf} />
            </div>
          </figure>
        ))}
      </div>

      <h3>Códigos de nivel inferior</h3>
      <p className="muted small">
        El MRP procesa cada ítem en el nivel más bajo en que aparece, para sumar primero las necesidades de todos sus
        padres (p. ej. D y E, que se usan en A y en B).
      </p>
      <div className="table-scroll">
        <table className="grid-table">
          <thead>
            <tr>
              <th>Ítem</th>
              <th>Descripción</th>
              <th>Nivel (código inferior)</th>
              <th>Tipo</th>
              <th>Se usa en (coeficiente)</th>
              <th>Lead time</th>
            </tr>
          </thead>
          <tbody>
            {result.records.map((r) => (
              <tr key={r.code}>
                <th className="row-head">{r.code}</th>
                <td>{r.description}</td>
                <td className="num">{r.level}</td>
                <td>
                  <TypeBadge type={r.type} />
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
    </Section>
  );
}
