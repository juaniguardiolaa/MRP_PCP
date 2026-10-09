export type GlossaryId =
  | 'PMP'
  | 'BOM'
  | 'NB'
  | 'RP'
  | 'D'
  | 'NN'
  | 'ROP'
  | 'EOP'
  | 'LT'
  | 'SS'
  | 'L4L'
  | 'LOTE_FIJO'
  | 'LLC'
  | 'COEF'
  | 'ATRASO'
  | 'LT_ACUM'
  | 'DEM_IND'
  | 'DEM_DEP'
  | 'COMPRA'
  | 'FABRICACION'
  | 'PRONOSTICO'
  | 'R2'
  | 'COSTO_UNIT'
  | 'COSTO_PEDIDO'
  | 'COSTO_MANT'
  | 'EOQ'
  | 'LTC'
  | 'LUC';

export interface GlossaryEntry {
  id: GlossaryId;
  /** Sigla o nombre corto que aparece en pantalla. */
  abbr: string;
  name: string;
  definition: string;
  formula?: string;
  /** Ejemplo con los datos del Ejercicio MRP oct. 26. */
  example?: string;
}

const entries: GlossaryEntry[] = [
  {
    id: 'PMP',
    abbr: 'PMP',
    name: 'Plan Maestro de Producción',
    definition:
      'Cuántas unidades de cada producto final hay que tener listas en cada semana. Surge de los pedidos de clientes y del pronóstico. Es la demanda independiente del sistema.',
    example: 'El producto A necesita 30 unidades en la semana 2.',
  },
  {
    id: 'BOM',
    abbr: 'BOM',
    name: 'Lista de materiales',
    definition:
      'Qué componentes lleva cada producto o subconjunto y cuántas unidades de cada uno. Con ella el MRP pasa de la demanda de productos finales a la de sus partes.',
    example: 'A lleva 1 F, 2 C y 1 D. C, a su vez, lleva 2 D y 3 E.',
  },
  {
    id: 'NB',
    abbr: 'NB',
    name: 'Necesidades brutas',
    definition:
      'Unidades que se consumen del ítem en la semana, sin descontar lo que ya hay. Para un producto final es su PMP; para un componente, lo que piden las órdenes de sus padres.',
    formula: 'NB = demanda independiente + Σ (EOP del padre × coeficiente de uso)',
    example: 'NB de E en S1 = 50 (orden de H) + 20 (orden de G) = 70.',
  },
  {
    id: 'RP',
    abbr: 'RP',
    name: 'Recepciones programadas',
    definition:
      'Órdenes que ya se emitieron antes de empezar el plan y llegan en una semana conocida. Suman al disponible.',
    example: 'C recibe 50 unidades en la semana 1.',
  },
  {
    id: 'D',
    abbr: 'D',
    name: 'Inventario proyectado (disponible)',
    definition:
      'Unidades que quedan en stock al cerrar la semana, después de recibir y consumir. La columna S0 muestra el stock inicial.',
    formula: 'D = D anterior + RP + ROP − NB',
    example: 'B empieza con 40 y consume 10 por semana: queda 30, 20, 10, 0.',
  },
  {
    id: 'NN',
    abbr: 'NN',
    name: 'Necesidades netas',
    definition:
      'Lo que falta después de usar el stock y las recepciones programadas. Si es mayor que cero, hace falta una orden.',
    formula: 'NN = máx(0, NB + SS − D anterior − RP)',
    example: 'C en S5: necesita 60 y tiene 20, así que NN = 40.',
  },
  {
    id: 'ROP',
    abbr: 'ROP',
    name: 'Recepción de órdenes planificadas',
    definition:
      'Cantidad que debe llegar en la semana para cubrir la necesidad neta. Sale de aplicar la política de loteo a la NN.',
    example: 'C necesita 40 netas y su lote fijo es 50: se reciben 50.',
  },
  {
    id: 'EOP',
    abbr: 'EOP',
    name: 'Emisión de órdenes planificadas',
    definition:
      'Semana en que hay que emitir la orden (de compra o de fabricación) para que llegue a tiempo: la recepción corrida hacia atrás tantas semanas como el lead time.',
    formula: 'EOP en la semana t − LT = ROP de la semana t',
    example: 'C recibe 50 en S5 y su LT es 1: la orden se emite en S4.',
  },
  {
    id: 'LT',
    abbr: 'LT',
    name: 'Lead time (tiempo de espera)',
    definition:
      'Semanas que pasan desde que se emite una orden hasta que se recibe. Para compras es el tiempo del proveedor; para fabricación, el de producción.',
    example: 'D tiene un lead time de 2 semanas.',
  },
  {
    id: 'SS',
    abbr: 'SS',
    name: 'Stock de seguridad',
    definition:
      'Cantidad mínima que el plan intenta mantener siempre en stock para absorber imprevistos. En el ejercicio vale 0 para todos los ítems.',
  },
  {
    id: 'L4L',
    abbr: 'L4L',
    name: 'Lote por lote',
    definition:
      'Política de loteo que pide exactamente la necesidad neta de cada semana. No deja sobrantes, pero genera más órdenes.',
    example: 'A necesita 30 netas en S6: se piden 30.',
  },
  {
    id: 'LOTE_FIJO',
    abbr: 'Lote fijo',
    name: 'Lote fijo',
    definition:
      'Política que siempre pide múltiplos de un tamaño de lote. Si la necesidad neta supera el lote, se piden varios lotes.',
    formula: 'cantidad = ⌈NN ÷ lote⌉ × lote',
    example: 'D necesita 310 en S6 con lote de 100: se piden 4 × 100 = 400.',
  },
  {
    id: 'LLC',
    abbr: 'Nivel',
    name: 'Código de nivel inferior',
    definition:
      'El nivel más bajo en que aparece un ítem en cualquier estructura. El MRP calcula los ítems en ese orden para sumar primero lo que piden todos sus padres.',
    example: 'E aparece en los niveles 2 y 3, así que su código es 3.',
  },
  {
    id: 'COEF',
    abbr: 'Coef.',
    name: 'Coeficiente de uso',
    definition: 'Unidades del componente que lleva una unidad del padre.',
    example: 'B lleva 3 unidades de D: coeficiente 3.',
  },
  {
    id: 'ATRASO',
    abbr: 'Atrasada',
    name: 'Orden atrasada',
    definition:
      'Orden que, por su lead time, debería haberse emitido antes de la semana 1. Si no se acelera, hay riesgo de no cumplir la demanda.',
    example: 'I necesita 10 netas en S1 con LT de 1 semana: debió emitirse en S0.',
  },
  {
    id: 'LT_ACUM',
    abbr: 'LT acumulado',
    name: 'Lead time acumulado',
    definition:
      'Suma de lead times del camino más largo de la estructura. Es el tiempo mínimo para obtener el producto partiendo de cero.',
    example: 'B: 2 (B) + 2 (G) + 1 (H) + 2 (E) = 7 semanas.',
  },
  {
    id: 'DEM_IND',
    abbr: 'Demanda independiente',
    name: 'Demanda independiente',
    definition:
      'Demanda que no depende de otros ítems: la de los productos finales (PMP) o la de repuestos que se venden sueltos.',
  },
  {
    id: 'DEM_DEP',
    abbr: 'Demanda dependiente',
    name: 'Demanda dependiente',
    definition: 'Demanda de un componente que se calcula a partir de las órdenes de los productos que lo usan.',
  },
  {
    id: 'COMPRA',
    abbr: 'Compra',
    name: 'Ítem de compra',
    definition:
      'Ítem que se compra a un proveedor. Sus órdenes son solicitudes de compra. Por defecto, todo ítem sin componentes en la BOM.',
  },
  {
    id: 'PRONOSTICO',
    abbr: 'Pronóstico',
    name: 'Pronóstico por regresión lineal',
    definition:
      'Estimación de la demanda de las semanas sin datos, prolongando la tendencia de la serie cargada. Se ajusta la recta que minimiza la suma de los errores al cuadrado (mínimos cuadrados) y se redondea a unidades enteras.',
    formula: 'y = a + b·t   b = Σ(t − t̄)(y − ȳ) / Σ(t − t̄)²   a = ȳ − b·t̄',
    example: 'A, con la demanda de S1 a S12: y = 11,52 + 1,43·t, así que S13 ≈ 30 u.',
  },
  {
    id: 'R2',
    abbr: 'R²',
    name: 'Coeficiente de determinación',
    definition:
      'Qué parte de la variación de la demanda explica la recta, de 0 a 1. Cerca de 1 la tendencia es clara; cerca de 0 la demanda varía mucho alrededor de la recta y el pronóstico es menos confiable.',
    example: 'A tiene R² = 0,14 (tendencia débil) y B, 0,29.',
  },
  {
    id: 'FABRICACION',
    abbr: 'Fabricación',
    name: 'Ítem de fabricación',
    definition:
      'Ítem que se produce en planta a partir de sus componentes. Sus órdenes son órdenes de fabricación.',
  },
  {
    id: 'COSTO_UNIT',
    abbr: 'C',
    name: 'Costo unitario',
    definition:
      'Lo que cuesta comprar o fabricar una unidad del ítem. Se usa para calcular el costo de mantener y el importe de las compras.',
    example: 'En el ejemplo de la cátedra, $10 por unidad.',
  },
  {
    id: 'COSTO_PEDIDO',
    abbr: 'S',
    name: 'Costo de pedido o de preparación',
    definition:
      'Costo fijo de cada orden, sin importar la cantidad: emitir y recibir una compra, o preparar la máquina para una tanda de fabricación. Cuantas menos órdenes, menos se gasta en este concepto.',
    example: 'En el ejemplo de la cátedra, $47 por orden.',
  },
  {
    id: 'COSTO_MANT',
    abbr: 'i',
    name: 'Costo de mantener el inventario',
    definition:
      'Lo que cuesta tener stock guardado (capital inmovilizado, depósito, seguros, obsolescencia), como % anual del costo unitario. Cuanto más grande el lote, más inventario queda y más se paga en este concepto. Se cobra sobre el inventario al cierre de cada semana (D).',
    formula: 'H = C × i / 100 (por unidad y año)   h = H / 52 (por unidad y semana)',
    example: 'Con C = $10 e i = 26 % anual: H = $2,60 y h = $0,05 (el 0,5 % semanal de la cátedra).',
  },
  {
    id: 'EOQ',
    abbr: 'EOQ',
    name: 'Cantidad económica de pedido',
    definition:
      'Tamaño de lote fijo que equilibra el costo de pedir con el de mantener, si la demanda fuera pareja. La demanda anual se estima con el promedio semanal de las necesidades netas del horizonte. Como en MRP la demanda varía semana a semana, no siempre es la técnica más barata.',
    formula: 'EOQ = √(2 · D · S / H)   con D = demanda anual',
    example: 'Cátedra: D = 525 u. en 8 semanas × 52 = 3.412,5 u./año; EOQ = √(2 × 3.412,5 × 47 / 2,60) ≈ 351 u.',
  },
  {
    id: 'LTC',
    abbr: 'LTC',
    name: 'Costo total mínimo',
    definition:
      'Prueba lotes que cubren 1, 2, 3… semanas y elige aquel en que el costo de mantener se parece más al costo de pedir. Las unidades de la semana j se mantienen (j − semana del pedido) semanas.',
    formula: 'Se elige el lote con la menor diferencia |costo de mantener − S|',
    example: 'Cátedra: pedir en S1 para S1–S5 (335 u.) cuesta $38 de mantener contra $47 de pedir: se elige ese lote.',
  },
  {
    id: 'LUC',
    abbr: 'LUC',
    name: 'Costo unitario mínimo',
    definition:
      'Prueba lotes que cubren 1, 2, 3… semanas y elige el que tiene el menor costo por unidad: costo de mantener más costo de pedir, dividido la cantidad del lote.',
    formula: 'Costo unitario = (costo de mantener + S) / cantidad',
    example: 'Cátedra: S1–S6 (410 u.) cuesta $0,2530 por unidad, el mínimo; S1–S7 ya sube a $0,2590.',
  },
];

export const GLOSSARY: Record<GlossaryId, GlossaryEntry> = Object.fromEntries(
  entries.map((e) => [e.id, e]),
) as Record<GlossaryId, GlossaryEntry>;

export const GLOSSARY_LIST: GlossaryEntry[] = entries;
