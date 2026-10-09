import type { ItemCosts } from '../domain/types';

/**
 * Datos del ejemplo de tamaño de lote de la cátedra ("Presentación MRP"): costo por producto
 * $10, costo de pedido o preparación $47 y mantenimiento del 0,5 % semanal (26 % anual).
 */
export const COSTOS_CATEDRA: ItemCosts = { unitCost: 10, orderCost: 47, holdingRate: 26 };

/** Requerimientos netos semanales del mismo ejemplo (semanas 1 a 8). */
export const NN_EJEMPLO_CATEDRA = [50, 60, 70, 60, 95, 75, 60, 55];
