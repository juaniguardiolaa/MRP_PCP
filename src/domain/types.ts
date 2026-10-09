/**
 * Modelo de datos del sistema MRP I.
 *
 * Notación de la cátedra (por período t):
 *   NB  – Necesidades Brutas
 *   RP  – Recepciones Programadas
 *   D   – Inventario Proyectado (disponible al cierre del período)
 *   NN  – Necesidades Netas
 *   ROP – Recepción de Órdenes Planificadas
 *   EOP – Emisión (liberación) de Órdenes Planificadas
 *
 * Las series semanales se guardan como arreglos donde el índice 0 es la semana 1.
 */

/** Tipo de abastecimiento resuelto de un ítem. */
export type ItemType = 'compra' | 'fabricacion';

/** 'auto' deduce el tipo desde la BOM: sin componentes = compra, con componentes = fabricación. */
export type ItemTypeSetting = ItemType | 'auto';

export type LotPolicy =
  | { kind: 'L4L' }
  | { kind: 'FIXED'; lotSize: number }
  /** Cantidad económica de pedido (Economic Order Quantity). */
  | { kind: 'EOQ' }
  /** Costo total mínimo (Least Total Cost). */
  | { kind: 'LTC' }
  /** Costo unitario mínimo (Least Unit Cost). */
  | { kind: 'LUC' };

export type LotPolicyKind = LotPolicy['kind'];

/** Costos de un ítem para las técnicas de loteo por costos (EOQ, LTC, LUC). */
export interface ItemCosts {
  /** Costo unitario C ($ por unidad). */
  unitCost: number;
  /** Costo de pedido o de preparación S ($ por orden). */
  orderCost: number;
  /** Costo de mantener i, en % anual del costo unitario (26 = 26 %). */
  holdingRate: number;
}

export interface Item {
  code: string;
  description: string;
  initialStock: number;
  leadTime: number;
  safetyStock: number;
  lotPolicy: LotPolicy;
  type: ItemTypeSetting;
  /** Recepciones programadas (órdenes ya emitidas) por semana. */
  scheduledReceipts: number[];
  /**
   * Demanda independiente por semana. Para los productos finales es el Plan Maestro
   * de Producción; para los componentes son las "partes fuera del programa" (repuestos).
   */
  demand: number[];
  /**
   * Valores escritos a mano sobre semanas pronosticadas (índice 0 = semana 1). Reemplazan
   * al pronóstico pero no cambian la serie con la que se calcula la regresión.
   */
  forecastOverrides?: Record<number, number>;
  /** Costos para las técnicas de loteo por costos. El ejercicio no los trae. */
  costs?: ItemCosts;
}

export interface BomLine {
  parent: string;
  child: string;
  /** Coeficiente de uso: unidades de hijo por unidad de padre. */
  quantity: number;
}

export interface Scenario {
  name: string;
  horizon: number;
  /** Completar con regresión lineal las semanas del horizonte posteriores a la demanda cargada. */
  forecastEnabled: boolean;
  items: Item[];
  bom: BomLine[];
}

export interface MrpRecord {
  code: string;
  description: string;
  /** Código de nivel inferior (low-level code). */
  level: number;
  type: ItemType;
  leadTime: number;
  safetyStock: number;
  lotPolicy: LotPolicy;
  initialStock: number;
  nb: number[];
  rp: number[];
  d: number[];
  nn: number[];
  rop: number[];
  eop: number[];
  /** Cantidad que debió emitirse en la semana 0 o antes (orden atrasada). */
  pastDueRelease: number;
  costs?: ItemCosts;
}

export interface PlannedOrder {
  itemCode: string;
  type: ItemType;
  level: number;
  quantity: number;
  /** Semana de emisión (puede ser ≤ 0 si la orden está atrasada). */
  releaseWeek: number;
  /** Semana en que la orden debe estar recibida. */
  receiptWeek: number;
  pastDue: boolean;
  lotPolicy: LotPolicy;
  /** Última semana cuyas necesidades cubre el lote (la anterior a la próxima recepción planificada). */
  coversThrough: number;
}

export type Severity = 'error' | 'warning' | 'info';

export interface Issue {
  severity: Severity;
  message: string;
  itemCode?: string;
  week?: number;
}

export interface MrpResult {
  horizon: number;
  /** Registros ordenados por nivel y luego por código. */
  records: MrpRecord[];
  orders: PlannedOrder[];
  /** Alertas del cálculo (órdenes atrasadas, etc.). */
  alerts: Issue[];
  /** Problemas de datos detectados por la validación. */
  issues: Issue[];
}
