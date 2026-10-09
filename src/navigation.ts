import {
  Calculator,
  CalendarRange,
  ChartGantt,
  FileText,
  GitFork,
  LayoutDashboard,
  Network,
  Package,
  ShoppingCart,
  Table2,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

export type ViewId =
  | 'inicio'
  | 'pmp'
  | 'items'
  | 'bom'
  | 'estructura'
  | 'explosion'
  | 'loteo'
  | 'ordenes'
  | 'compras'
  | 'analisis'
  | 'informe';

export interface ViewDef {
  id: ViewId;
  title: string;
  icon: LucideIcon;
  /** Qué hace el usuario en esta pantalla, en una frase. */
  summary: string;
  /** La vista muestra resultados del cálculo (no se puede ver si hay errores de datos). */
  needsResult: boolean;
}

export interface NavGroup {
  id: string;
  /** Paso del proceso MRP (1 a 4); null para Inicio. */
  step: number | null;
  title: string;
  views: ViewId[];
}

export const VIEWS: Record<ViewId, ViewDef> = {
  inicio: {
    id: 'inicio',
    title: 'Panel de planificación',
    icon: LayoutDashboard,
    summary: 'Resumen del plan: indicadores, flujo del MRP, órdenes para emitir ahora y alertas.',
    needsResult: false,
  },
  pmp: {
    id: 'pmp',
    title: 'Plan maestro de producción',
    icon: CalendarRange,
    summary: 'Cargá cuántas unidades de cada producto final se necesitan en cada semana.',
    needsResult: false,
  },
  items: {
    id: 'items',
    title: 'Ítems e inventario',
    icon: Package,
    summary: 'Elegí un ítem para ver y editar su stock, lead time, política de loteo y entregas programadas.',
    needsResult: false,
  },
  bom: {
    id: 'bom',
    title: 'Lista de materiales',
    icon: Network,
    summary: 'Definí qué componentes lleva cada producto o subconjunto y en qué cantidad.',
    needsResult: false,
  },
  estructura: {
    id: 'estructura',
    title: 'Estructura de producto',
    icon: GitFork,
    summary: 'Árbol de cada producto final con sus niveles y coeficientes de uso.',
    needsResult: true,
  },
  explosion: {
    id: 'explosion',
    title: 'Explosión MRP',
    icon: Table2,
    summary: 'Registro MRP semana a semana de cada ítem: necesidades, inventario y órdenes.',
    needsResult: true,
  },
  loteo: {
    id: 'loteo',
    title: 'Cantidad económica de pedido',
    icon: Calculator,
    summary: 'Costos de cada ítem y comparación de técnicas de loteo: EOQ, costo total mínimo y costo unitario mínimo.',
    needsResult: true,
  },
  ordenes: {
    id: 'ordenes',
    title: 'Plan de órdenes',
    icon: ChartGantt,
    summary: 'Qué órdenes emitir, de qué ítem, por cuántas unidades y en qué semana.',
    needsResult: true,
  },
  compras: {
    id: 'compras',
    title: 'Compras sugeridas',
    icon: ShoppingCart,
    summary: 'Solicitudes de compra que hay que emitir a proveedores, semana por semana.',
    needsResult: true,
  },
  analisis: {
    id: 'analisis',
    title: 'Análisis y alertas',
    icon: TriangleAlert,
    summary: 'Factibilidad del plan: primeras órdenes, lead times acumulados y órdenes atrasadas.',
    needsResult: true,
  },
  informe: {
    id: 'informe',
    title: 'Informe',
    icon: FileText,
    summary: 'Todo el plan en un documento para revisar o guardar en PDF.',
    needsResult: true,
  },
};

export const NAV_GROUPS: NavGroup[] = [
  { id: 'inicio', step: null, title: 'Inicio', views: ['inicio'] },
  { id: 'datos', step: 1, title: 'Datos maestros', views: ['pmp', 'items', 'bom'] },
  { id: 'planificacion', step: 2, title: 'Planificación', views: ['estructura', 'explosion', 'loteo'] },
  { id: 'ordenes', step: 3, title: 'Órdenes', views: ['ordenes', 'compras'] },
  { id: 'control', step: 4, title: 'Control', views: ['analisis', 'informe'] },
];

export function groupOf(view: ViewId): NavGroup {
  return NAV_GROUPS.find((g) => g.views.includes(view)) ?? NAV_GROUPS[0];
}

export function isViewId(value: string): value is ViewId {
  return value in VIEWS;
}
