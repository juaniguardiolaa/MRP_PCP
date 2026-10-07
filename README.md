# Sistema MRP I – PCP (UTN FRH)

Aplicación web para la actividad **"Ejercicio MRP oct. 26"** de Planificación y Control de la Producción
(Ingeniería Industrial). A partir del Plan Maestro de Producción, la lista de materiales (BOM) y el estado
del inventario, hace la explosión de necesidades y entrega:

- la **tabla MRP de cada ítem** con la notación de la cátedra (NB, RP, D, NN, ROP, EOP);
- un **diagrama de pedidos** que indica qué pedir, cuánto y en qué semana emitir y recibir cada orden;
- una **sugerencia de compras** por semana para los ítems de abastecimiento externo;
- el **análisis de factibilidad**: primeras órdenes de materias primas, lead times acumulados y órdenes atrasadas;
- un **informe imprimible** (A4 apaisado) que se puede guardar como PDF.

Todos los datos se pueden editar y los resultados se recalculan al instante: stock inicial, entregas
programadas, lead time, política de loteo, stock de seguridad, plan maestro, horizonte y la propia BOM.

## Uso

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev        # abre la app en http://localhost:5173
npm test           # tests del motor MRP
npm run build      # genera la versión estática en dist/
npm run build:artifact  # genera dist-artifact/sistema-mrp.html, un único archivo para publicar en claude.ai
```

La app arranca con los datos del ejercicio. Los cambios se guardan automáticamente en el navegador.
Desde la barra superior se puede:

- **Restaurar ejercicio:** vuelve a los datos de la consigna, previa confirmación.
- **Exportar:** muestra el escenario en formato JSON para copiarlo o descargarlo como `.json`.
- **Importar:** carga un escenario desde un archivo `.json` o desde el texto pegado.
- **Imprimir / PDF:** abre el informe completo y el diálogo de impresión. Para obtener el PDF, elegí
  "Guardar como PDF".

La versión publicada en claude.ai no tiene "Imprimir / PDF" ni "Descargar .json", porque ese visor no
permite imprimir ni descargar archivos. Para el PDF hay que usar la app local o la de GitHub Pages.

### Pantallas

Siguen el esquema "Estructura del Sistema de MRP" de la teoría.

| Entradas | Resultados (entregables del MRP) |
| --- | --- |
| **Plan maestro:** necesidades brutas de los productos finales por semana (pedidos de clientes + pronóstico). | **Estructura:** árbol de cada producto con niveles y coeficientes de uso, y los códigos de nivel inferior. |
| **Inventario e ítems:** stock inicial, entregas programadas por semana, lead time, stock de seguridad, política de loteo y tipo (compra/fabricación). | **Tablas MRP:** registro de cada ítem y reporte de requerimientos brutos y netos. |
| **Lista de materiales:** relaciones padre → componente con su coeficiente (cambios de ingeniería). | **Diagrama de pedidos:** Gantt de órdenes y calendario de emisiones (también funciona como planificación del inicio de producción). |
| **Demanda independiente de componentes:** "partes fuera del programa" (repuestos), dentro del detalle de cada ítem. | **Compras:** sugerencia de compras por semana y totales por ítem. |
| | **Análisis:** respuestas al punto 3 de la consigna y alertas. |
| | **Informe:** todo lo anterior en formato imprimible. |

## Lógica de cálculo

El motor está en [`src/domain/mrpEngine.ts`](src/domain/mrpEngine.ts).

1. **Códigos de nivel inferior:** se calcula el nivel más bajo en que aparece cada ítem y los ítems se
   procesan en ese orden. Así un componente común (D, E, F) se calcula una sola vez, con las necesidades de
   todos sus padres ya sumadas.
2. Para cada semana *t*, con D₀ = stock inicial:

   | Variable | Fórmula |
   | --- | --- |
   | NB<sub>t</sub> | demanda independiente<sub>t</sub> + Σ EOP<sub>t</sub> del padre × coeficiente de uso |
   | NN<sub>t</sub> | max(0, NB<sub>t</sub> + SS − D<sub>t−1</sub> − RP<sub>t</sub>) |
   | ROP<sub>t</sub> | cantidad según la política de loteo, si NN<sub>t</sub> > 0 |
   | D<sub>t</sub> | D<sub>t−1</sub> + RP<sub>t</sub> + ROP<sub>t</sub> − NB<sub>t</sub> (inventario proyectado al cierre) |
   | EOP<sub>t−LT</sub> | ROP<sub>t</sub> |

3. **Políticas de loteo** ([`src/domain/lotSizing.ts`](src/domain/lotSizing.ts)):
   - **L4L (lote por lote):** se pide exactamente la necesidad neta.
   - **Lote fijo Q:** se pide ⌈NN/Q⌉ × Q. Si la necesidad supera el lote, se piden varios lotes; por
     ejemplo, D necesita 310 en S6 y se piden 4 × 100.

### Supuestos

- **Inventario proyectado (D):** es el disponible al **cierre** de la semana. En la columna S0 de las tablas
  se muestra el stock inicial.
- **Orden atrasada:** cuando la fecha de emisión (*t − LT*) cae antes de la semana 1. Se informa como riesgo
  y se muestra en rojo en la columna S0 de la fila EOP y en el diagrama. Las necesidades de componentes de esa
  orden se cargan en la semana 1, porque se supone que la orden se libera de inmediato.
- **Stock de seguridad (SS):** es opcional y vale 0 en el ejercicio. Se incluye porque la cátedra lo usa en su
  ejemplo de la tijera, y los tests verifican que el motor reproduce ese ejemplo.
- **Tipo de ítem:** por defecto se deduce de la BOM. Un ítem sin componentes es de **compra**; uno con
  componentes es de **fabricación**. Se puede cambiar a mano en la pantalla de ítems.

## Resultados del ejercicio

Con los datos de la consigna:

**Niveles (códigos de nivel inferior):**
- A, B = 0
- C, F, G = 1
- D, H = 2
- E, I = 3

**Primeras órdenes de compra:**
- D: S1, 100 u.
- E: S1, 50 u.
- F: S2, 100 u.
- I: **S0, atrasada**, 10 u. La primera orden de I que se puede emitir a tiempo es en S3.
- H no es de compra según la BOM, pero su primera orden de fabricación es en S1 (50 u.).

**Lead times acumulados:**
- A: 4 semanas (A → C → D).
- B: 7 semanas (B → G → H → E).

**Riesgo:** I necesita 50 u. en S1 para la orden de H. Con 10 u. en stock y 30 u. programadas faltan 10 u. y,
con un lead time de 1 semana, esa orden debió emitirse en S0. Hay riesgo de no cumplir la demanda en la
primera semana si no se acelera la entrega.

### Observaciones sobre la consigna

- **Nivel 3:** la estructura de B tiene un nivel 3 (B → G → H → I, E), aunque la consigna habla de los
  niveles 0 a 2.
- **Ítem H:** el punto 3.1 nombra a H como materia prima, pero en la BOM H tiene componentes (I y E). En
  cambio D, que no tiene componentes, no figura en esa lista. La app muestra la primera orden de **todos** los
  ítems, así que la pregunta se responde con cualquiera de los dos criterios.

## Estructura del código

```
src/
  domain/      lógica pura sin React: tipos, BOM, loteo, validación, motor MRP y reportes
  data/        datos del ejercicio
  state/       estado del escenario (autoguardado, importar/exportar)
  components/  pantallas de la app
  styles/      estilos de pantalla e impresión
```

## Publicación en GitHub Pages

El workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) corre lint, tests y build en
cada push y pull request. En la rama `main` además publica la app. Para activarlo:

1. Ir a **Settings → Pages** del repositorio.
2. Elegir **Source: GitHub Actions**.

## Próximas etapas

- **Cantidad económica de pedido:** EOQ, costo total mínimo (LTC) y costo unitario mínimo (LUC). Requiere
  cargar el costo unitario, el costo de pedido y el costo de mantenimiento. El motor ya recibe la política de
  loteo como estrategia, así que alcanza con agregar las nuevas reglas en `lotSizing.ts`.
- **Capacidad necesaria vs. capacidad instalada (CRP).**
