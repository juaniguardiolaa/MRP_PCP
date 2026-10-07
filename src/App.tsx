import { useEffect, useMemo, useState } from 'react';
import { Analysis } from './components/Analysis';
import { BomEditor } from './components/BomEditor';
import { IssueList } from './components/common';
import { ConfirmButton } from './components/ConfirmButton';
import { ItemsEditor } from './components/ItemsEditor';
import { MpsEditor } from './components/MpsEditor';
import { MrpTables } from './components/MrpTables';
import { OrderPlan } from './components/OrderPlan';
import { ProductStructure } from './components/ProductStructure';
import { Purchases } from './components/Purchases';
import { Report } from './components/Report';
import { ScenarioTransfer, type TransferMode } from './components/ScenarioTransfer';
import { runMrp } from './domain/mrpEngine';
import { IS_ARTIFACT } from './env';
import { useScenario } from './state/useScenario';

const TABS = [
  { id: 'pmp', label: 'Plan maestro', group: 'Entradas' },
  { id: 'items', label: 'Inventario e ítems', group: 'Entradas' },
  { id: 'bom', label: 'Lista de materiales', group: 'Entradas' },
  { id: 'estructura', label: 'Estructura', group: 'Resultados' },
  { id: 'tablas', label: 'Tablas MRP', group: 'Resultados' },
  { id: 'plan', label: 'Diagrama de pedidos', group: 'Resultados' },
  { id: 'compras', label: 'Compras', group: 'Resultados' },
  { id: 'analisis', label: 'Análisis', group: 'Resultados' },
  { id: 'informe', label: 'Informe', group: 'Resultados' },
] as const;

type TabId = (typeof TABS)[number]['id'];
const INPUT_TABS: TabId[] = ['pmp', 'items', 'bom'];
const TAB_KEY = 'mrp-pcp:tab';

function initialTab(): TabId {
  try {
    const saved = localStorage.getItem(TAB_KEY);
    if (TABS.some((t) => t.id === saved)) return saved as TabId;
  } catch {
    // sin almacenamiento
  }
  return 'pmp';
}

export default function App() {
  const [scenario, dispatch] = useScenario();
  const result = useMemo(() => runMrp(scenario), [scenario]);
  const [tab, setTab] = useState<TabId>(initialTab);
  const [printPending, setPrintPending] = useState(false);
  const [transfer, setTransfer] = useState<TransferMode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, tab);
    } catch {
      // sin almacenamiento
    }
  }, [tab]);

  useEffect(() => {
    if (!printPending || tab !== 'informe') return;
    const id = window.setTimeout(() => {
      window.print();
      setPrintPending(false);
    }, 100);
    return () => window.clearTimeout(id);
  }, [printPending, tab]);

  const blocked = result.issues.some((i) => i.severity === 'error');
  const lateCount = result.alerts.filter((a) => a.severity === 'error').length;

  const renderTab = () => {
    if (tab === 'pmp') return <MpsEditor scenario={scenario} dispatch={dispatch} />;
    if (tab === 'items') return <ItemsEditor scenario={scenario} dispatch={dispatch} />;
    if (tab === 'bom') return <BomEditor scenario={scenario} dispatch={dispatch} />;
    if (blocked) {
      return (
        <div className="card blocked">
          <h2>No se puede calcular el MRP</h2>
          <p>Corregí los errores de los datos de entrada para ver los resultados.</p>
          <IssueList issues={result.issues.filter((i) => i.severity === 'error')} />
        </div>
      );
    }
    switch (tab) {
      case 'estructura':
        return <ProductStructure scenario={scenario} result={result} />;
      case 'tablas':
        return <MrpTables result={result} />;
      case 'plan':
        return <OrderPlan result={result} />;
      case 'compras':
        return <Purchases result={result} />;
      case 'analisis':
        return <Analysis scenario={scenario} result={result} />;
      case 'informe':
        return <Report scenario={scenario} result={result} />;
    }
  };

  return (
    <div className="app">
      <header className="app-header no-print">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            MRP
          </span>
          <div>
            <h1>Sistema MRP I</h1>
            <p>Planificación y Control de la Producción · Ingeniería Industrial · UTN FRH</p>
          </div>
        </div>
        <div className="header-actions">
          <label className="scenario-name">
            <span>Escenario</span>
            <input
              className="text-input"
              value={scenario.name}
              onChange={(e) => dispatch({ type: 'setName', name: e.currentTarget.value })}
            />
          </label>
          <ConfirmButton
            className="btn btn-ghost"
            label="Restaurar ejercicio"
            question="¿Volver a los datos de la consigna? Se pierden los cambios no exportados."
            confirmLabel="Restaurar"
            onConfirm={() => {
              dispatch({ type: 'reset' });
              setNotice('Se restauraron los datos del ejercicio.');
            }}
          />
          <button
            type="button"
            className="btn btn-ghost"
            aria-pressed={transfer === 'export'}
            onClick={() => setTransfer(transfer === 'export' ? null : 'export')}
          >
            Exportar
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            aria-pressed={transfer === 'import'}
            onClick={() => setTransfer(transfer === 'import' ? null : 'import')}
          >
            Importar
          </button>
          {!IS_ARTIFACT && (
            <button
              type="button"
              className="btn"
              disabled={blocked}
              onClick={() => {
                setTab('informe');
                setPrintPending(true);
              }}
            >
              Imprimir / PDF
            </button>
          )}
        </div>
      </header>

      <nav className="tabs no-print" aria-label="Secciones">
        {(['Entradas', 'Resultados'] as const).map((group) => (
          <div key={group} className="tab-group">
            <span className="tab-group-label">{group}</span>
            {TABS.filter((t) => t.group === group).map((t) => (
              <button
                key={t.id}
                type="button"
                className={`tab ${tab === t.id ? 'tab-active' : ''}`}
                aria-current={tab === t.id ? 'page' : undefined}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {t.id === 'analisis' && lateCount > 0 && <span className="tab-badge">{lateCount}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <main className="content">
        {notice && (
          <p className="notice no-print" role="status">
            {notice}
            <button type="button" className="link-btn" onClick={() => setNotice(null)}>
              Cerrar
            </button>
          </p>
        )}
        {transfer && (
          <ScenarioTransfer
            key={transfer}
            mode={transfer}
            scenario={scenario}
            onClose={() => setTransfer(null)}
            onImport={(s) => {
              dispatch({ type: 'load', scenario: s });
              setTransfer(null);
              setNotice(`Se importó el escenario "${s.name}".`);
            }}
          />
        )}
        {INPUT_TABS.includes(tab) && result.issues.length > 0 && (
          <div className="no-print">
            <IssueList issues={result.issues} />
          </div>
        )}
        {renderTab()}
      </main>

      <footer className="app-footer no-print">
        Los datos se guardan automáticamente en este navegador. Usá “Exportar” para guardar el escenario en un archivo.
      </footer>
    </div>
  );
}
