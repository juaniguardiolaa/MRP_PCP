import { CircleCheck, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Analysis } from './components/Analysis';
import { BomEditor } from './components/BomEditor';
import { IssueList } from './components/common';
import { Dashboard } from './components/Dashboard';
import { ItemMaster } from './components/ItemMaster';
import { LotSizing } from './components/LotSizing';
import { MpsEditor } from './components/MpsEditor';
import { MrpTables } from './components/MrpTables';
import { OrderPlan } from './components/OrderPlan';
import { ProductStructure } from './components/ProductStructure';
import { Purchases } from './components/Purchases';
import { Report } from './components/Report';
import { ScenarioTransfer, type TransferMode } from './components/ScenarioTransfer';
import { PageHeader } from './components/shell/PageHeader';
import { ShellBar, type PlanStatus } from './components/shell/ShellBar';
import { Sidebar } from './components/shell/Sidebar';
import { GlossaryDrawer } from './components/ui/GlossaryDrawer';
import { Panel } from './components/ui/Panel';
import { applyForecast, planForecast } from './domain/forecast';
import { runMrp } from './domain/mrpEngine';
import { trailingEmptyDemand } from './domain/reports';
import { IS_ARTIFACT } from './env';
import { isViewId, VIEWS, type ViewId } from './navigation';
import { useScenario } from './state/useScenario';

const VIEW_KEY = 'mrp-pcp:view';

function initialView(): ViewId {
  const hash = window.location.hash.slice(1);
  if (isViewId(hash)) return hash;
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved && isViewId(saved)) return saved;
  } catch {
    // sin almacenamiento
  }
  return 'inicio';
}

export default function App() {
  const [scenario, dispatch] = useScenario();
  // El MRP se calcula sobre la demanda extendida con el pronóstico.
  const forecast = useMemo(() => planForecast(scenario), [scenario]);
  const effective = useMemo(() => applyForecast(scenario, forecast), [scenario, forecast]);
  const result = useMemo(() => runMrp(effective), [effective]);
  const emptyWeeks = useMemo(() => trailingEmptyDemand(effective), [effective]);
  const [view, setView] = useState<ViewId>(initialView);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [printPending, setPrintPending] = useState(false);
  const [transfer, setTransfer] = useState<TransferMode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // La vista vive en el #hash: el botón "atrás" funciona y se puede enlazar a una pantalla.
  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.slice(1);
      if (isViewId(hash)) setView(hash);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (window.location.hash.slice(1) !== view) window.location.hash = view;
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // sin almacenamiento
    }
  }, [view]);

  useEffect(() => {
    if (!printPending || view !== 'informe') return;
    const id = window.setTimeout(() => {
      window.print();
      setPrintPending(false);
    }, 150);
    return () => window.clearTimeout(id);
  }, [printPending, view]);

  const navigate = useCallback((next: ViewId, item?: string) => {
    if (item) setSelectedItem(item);
    setView(next);
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  }, []);

  const closeGlossary = useCallback(() => setGlossaryOpen(false), []);

  const errors = result.issues.filter((i) => i.severity === 'error');
  const blocked = errors.length > 0;
  const pastDue = result.orders.filter((o) => o.pastDue).length;

  const status: PlanStatus = blocked
    ? { tone: 'critical', text: `Datos con errores (${errors.length})` }
    : pastDue
      ? { tone: 'critical', text: `${result.orders.length} órdenes · ${pastDue} atrasada${pastDue > 1 ? 's' : ''}` }
      : { tone: 'ok', text: `Plan calculado · ${result.orders.length} órdenes` };

  const renderView = () => {
    if (view === 'inicio')
      return <Dashboard scenario={effective} result={result} forecast={forecast} emptyWeeks={emptyWeeks} onNavigate={navigate} />;
    if (view === 'pmp') return <MpsEditor scenario={scenario} plan={forecast} emptyWeeks={emptyWeeks} dispatch={dispatch} />;
    if (view === 'items')
      return (
        <ItemMaster
          scenario={effective}
          forecast={forecast}
          result={result}
          dispatch={dispatch}
          selected={selectedItem}
          onSelect={setSelectedItem}
          onNavigate={navigate}
        />
      );
    if (view === 'bom')
      return <BomEditor scenario={scenario} dispatch={dispatch} issues={result.issues.filter((i) => !i.itemCode)} />;
    if (blocked && VIEWS[view].needsResult) {
      return (
        <>
          <PageHeader view={view} help={false} />
          <Panel title="No se puede calcular el MRP" subtitle="Corregí estos datos de entrada para ver los resultados." className="panel-critical">
            <IssueList issues={errors} />
          </Panel>
        </>
      );
    }
    switch (view) {
      case 'estructura':
        return <ProductStructure scenario={scenario} result={result} />;
      case 'explosion':
        return (
          <MrpTables
            result={result}
            emptyWeeks={emptyWeeks}
            selected={selectedItem}
            onSelect={setSelectedItem}
            onNavigate={navigate}
          />
        );
      case 'loteo':
        return (
          <LotSizing
            scenario={effective}
            result={result}
            dispatch={dispatch}
            selected={selectedItem}
            onSelect={setSelectedItem}
            onNavigate={navigate}
          />
        );
      case 'ordenes':
        return <OrderPlan result={result} onNavigate={navigate} />;
      case 'compras':
        return <Purchases result={result} onNavigate={navigate} />;
      case 'analisis':
        return <Analysis scenario={effective} result={result} />;
      case 'informe':
        return <Report scenario={effective} result={result} forecast={forecast} />;
    }
  };

  return (
    <div className={menuOpen ? 'app-shell menu-open' : 'app-shell'}>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <Sidebar
        view={view}
        onNavigate={navigate}
        onHelp={() => {
          setGlossaryOpen(true);
          setMenuOpen(false);
        }}
        onClose={() => setMenuOpen(false)}
        badges={{
          analisis: pastDue,
          items: result.issues.filter((i) => i.severity === 'error' && i.itemCode).length,
          bom: result.issues.filter((i) => i.severity === 'error' && !i.itemCode).length,
        }}
      />
      {menuOpen && (
        <button type="button" className="sidebar-backdrop no-print" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} />
      )}

      <div className="main">
        <ShellBar
          view={view}
          scenarioName={scenario.name}
          onRename={(name) => dispatch({ type: 'setName', name })}
          status={status}
          onStatus={() => navigate(blocked ? 'items' : 'analisis')}
          onMenu={() => setMenuOpen(true)}
          onHelp={() => setGlossaryOpen(true)}
          onReset={() => {
            dispatch({ type: 'reset' });
            setSelectedItem(null);
            setNotice('Se restauraron los datos del ejercicio.');
          }}
          onExport={() => setTransfer(transfer === 'export' ? null : 'export')}
          onImport={() => setTransfer(transfer === 'import' ? null : 'import')}
          onPrint={
            IS_ARTIFACT
              ? undefined
              : () => {
                  navigate('informe');
                  setPrintPending(true);
                }
          }
          printDisabled={blocked}
          transfer={transfer}
        />

        <main className="page" id="contenido" tabIndex={-1}>
          {notice && (
            <p className="toast no-print" role="status">
              <CircleCheck size={16} aria-hidden />
              <span>{notice}</span>
              <button type="button" className="icon-btn" aria-label="Cerrar aviso" onClick={() => setNotice(null)}>
                <X size={16} />
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
                setSelectedItem(null);
                setNotice(`Se importó el escenario "${s.name}".`);
              }}
            />
          )}
          {renderView()}
        </main>
      </div>

      {glossaryOpen && <GlossaryDrawer onClose={closeGlossary} />}
    </div>
  );
}
