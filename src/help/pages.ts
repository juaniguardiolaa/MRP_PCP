import { IS_ARTIFACT } from '../env';
import type { ViewId } from '../navigation';
import type { GlossaryId } from './glossary';

export interface PageHelp {
  /** Pasos para usar la pantalla, en orden. */
  steps: string[];
  /** Conceptos que conviene conocer para leerla. */
  terms: GlossaryId[];
}

export const PAGE_HELP: Record<ViewId, PageHelp> = {
  inicio: {
    steps: [
      'Los indicadores de arriba resumen el plan. Hacé clic en cualquiera para ir al detalle.',
      'El flujo del MRP muestra el recorrido de los datos: las entradas alimentan el cálculo y el cálculo produce los entregables. Cada caja abre su pantalla.',
      '"Para emitir en la semana 1" lista lo que hay que hacer ya. Las órdenes en rojo están atrasadas.',
      'Si cambiás un dato en cualquier pantalla, todo se recalcula al instante.',
    ],
    terms: ['PMP', 'BOM', 'EOP', 'ATRASO', 'LT_ACUM'],
  },
  pmp: {
    steps: [
      'Cada fila es un producto final (un ítem que no es componente de otro).',
      'Escribí en cada semana cuántas unidades se necesitan entregar. Las celdas vacías valen 0.',
      'El horizonte define cuántas semanas abarca el plan. Si lo ampliás, las semanas nuevas se completan con un pronóstico por regresión lineal (marcadas con P).',
      'Si escribís un valor en una semana pronosticada, ese valor reemplaza al pronóstico. El interruptor "Pronóstico automático" lo apaga.',
    ],
    terms: ['PMP', 'NB', 'DEM_IND', 'PRONOSTICO', 'R2'],
  },
  items: {
    steps: [
      'Elegí un ítem de la lista. A la derecha aparece su ficha.',
      'Cargá el stock inicial, el lead time y la política de loteo. Las entregas programadas se cargan semana a semana.',
      'La sección Estructura muestra en qué productos se usa el ítem y qué componentes lleva. Hacé clic en uno para abrir su ficha.',
      'Con "Ver explosión MRP" vas directo a la tabla de cálculo del ítem.',
    ],
    terms: ['LT', 'SS', 'RP', 'L4L', 'LOTE_FIJO', 'COMPRA', 'FABRICACION'],
  },
  bom: {
    steps: [
      'A la izquierda están los productos y subconjuntos que tienen componentes. Elegí uno.',
      'A la derecha editá sus componentes y el coeficiente de uso de cada uno, o agregá componentes nuevos.',
      'Para dar componentes a un ítem que todavía no tiene, elegilo en "Agregar componentes a…".',
      'El árbol de abajo se actualiza al instante y resalta el ítem elegido.',
    ],
    terms: ['BOM', 'COEF', 'LLC'],
  },
  estructura: {
    steps: [
      'Cada árbol arranca en un producto final (nivel 0) y baja hasta las materias primas.',
      'El número entre paréntesis es el coeficiente de uso respecto del padre.',
      'La tabla de abajo indica el nivel más bajo de cada ítem: es el orden en que el MRP los calcula.',
    ],
    terms: ['BOM', 'COEF', 'LLC', 'COMPRA', 'FABRICACION'],
  },
  explosion: {
    steps: [
      'Elegí un ítem de la lista; están agrupados por nivel, en el orden en que se calculan.',
      'Leé la tabla de arriba hacia abajo: lo que se necesita (NB), lo que llega (RP), lo que queda (D), lo que falta (NN), cuánto pedir (ROP) y cuándo emitir la orden (EOP).',
      'La NB de un componente sale de las EOP de sus padres multiplicadas por el coeficiente de uso.',
      'Una cifra roja en la columna S0 de la fila EOP es una orden atrasada.',
    ],
    terms: ['NB', 'RP', 'D', 'NN', 'ROP', 'EOP', 'LT'],
  },
  ordenes: {
    steps: [
      'Cada barra del diagrama es una orden: empieza en la semana de emisión y termina cuando llega.',
      'Usá los filtros para ver solo compras, solo fabricación o un ítem.',
      'La tabla numera las órdenes (OF = fabricación, OC = compra) y las agrupa por semana de emisión.',
    ],
    terms: ['EOP', 'ROP', 'LT', 'ATRASO'],
  },
  compras: {
    steps: [
      'Cada fila es una solicitud de compra a emitir a un proveedor.',
      '"Emitir en" es la semana en que hay que hacer el pedido; "Necesaria en" es cuando tiene que llegar.',
      'La cantidad respeta la política de loteo del ítem. La cantidad económica de pedido llega en la próxima etapa.',
    ],
    terms: ['COMPRA', 'EOP', 'LOTE_FIJO', 'L4L'],
  },
  analisis: {
    steps: [
      'Las conclusiones responden el punto 3 de la consigna con los datos actuales.',
      'La tabla de primeras órdenes indica cuándo arranca cada ítem; las filas de compra son las materias primas.',
      'El lead time acumulado muestra qué parte de la demanda depende solo del stock existente.',
    ],
    terms: ['ATRASO', 'LT_ACUM', 'LT'],
  },
  informe: {
    steps: [
      'El informe reúne los datos de entrada, la estructura, las tablas MRP, las órdenes, las compras y el análisis.',
      IS_ARTIFACT
        ? 'Esta versión no permite imprimir. Para el PDF, abrí la app local o la de GitHub Pages y usá "Imprimir / PDF".'
        : 'Para guardarlo en PDF usá "Imprimir / PDF" en la barra superior y elegí "Guardar como PDF".',
    ],
    terms: [],
  },
};
