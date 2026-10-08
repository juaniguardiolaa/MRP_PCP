import { ChevronRight, CircleAlert, CircleCheck, CircleHelp, Download, Menu, Pencil, Printer, RotateCcw, TriangleAlert, Upload } from 'lucide-react';
import { groupOf, VIEWS, type ViewId } from '../../navigation';
import { ConfirmButton } from '../ConfirmButton';
import type { Tone } from '../ui/Chips';

export interface PlanStatus {
  tone: Tone;
  text: string;
}

const STATUS_ICON = { ok: CircleCheck, critical: TriangleAlert, warn: CircleAlert, info: CircleCheck, neutral: CircleCheck };

export function ShellBar({
  view,
  scenarioName,
  onRename,
  status,
  onStatus,
  onMenu,
  onHelp,
  onReset,
  onExport,
  onImport,
  onPrint,
  printDisabled,
  transfer,
}: {
  view: ViewId;
  scenarioName: string;
  onRename: (name: string) => void;
  status: PlanStatus;
  onStatus: () => void;
  onMenu: () => void;
  onHelp: () => void;
  onReset: () => void;
  onExport: () => void;
  onImport: () => void;
  /** Ausente cuando el entorno no permite imprimir. */
  onPrint?: () => void;
  printDisabled?: boolean;
  transfer: 'export' | 'import' | null;
}) {
  const group = groupOf(view);
  const StatusIcon = STATUS_ICON[status.tone];
  return (
    <header className="shellbar no-print">
      <button type="button" className="icon-btn shellbar-menu" aria-label="Abrir menú" onClick={onMenu}>
        <Menu size={20} />
      </button>

      <div className="shellbar-context">
        <nav className="breadcrumb" aria-label="Ubicación">
          <span>{group.step !== null ? `${group.step} · ${group.title}` : 'Inicio'}</span>
          <ChevronRight size={14} aria-hidden />
          <span aria-current="page">{VIEWS[view].title}</span>
        </nav>
        <label className="scenario-field" title="Nombre del escenario">
          <span className="sr-only">Nombre del escenario</span>
          <input id="scenario-name" value={scenarioName} onChange={(e) => onRename(e.currentTarget.value)} />
          <Pencil size={13} aria-hidden />
        </label>
      </div>

      <button type="button" className={`status-pill status-${status.tone}`} onClick={onStatus}>
        <StatusIcon size={15} aria-hidden />
        <span className="status-text">{status.text}</span>
      </button>

      <div className="shellbar-actions">
        <button
          type="button"
          className="btn btn-ghost"
          aria-pressed={transfer === 'import'}
          title="Importar escenario"
          onClick={onImport}
        >
          <Upload size={16} aria-hidden />
          <span className="btn-label">Importar</span>
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          aria-pressed={transfer === 'export'}
          title="Exportar escenario"
          onClick={onExport}
        >
          <Download size={16} aria-hidden />
          <span className="btn-label">Exportar</span>
        </button>
        <ConfirmButton
          className="btn btn-ghost"
          title="Restaurar los datos del ejercicio"
          label={
            <>
              <RotateCcw size={16} aria-hidden />
              <span className="btn-label">Restaurar</span>
            </>
          }
          question="¿Volver a los datos de la consigna?"
          confirmLabel="Restaurar"
          onConfirm={onReset}
        />
        {onPrint && (
          <button type="button" className="btn btn-primary" disabled={printDisabled} title="Imprimir o guardar en PDF" onClick={onPrint}>
            <Printer size={16} aria-hidden />
            <span className="btn-label">Imprimir / PDF</span>
          </button>
        )}
        <button type="button" className="icon-btn" aria-label="Ayuda y glosario" title="Ayuda y glosario" onClick={onHelp}>
          <CircleHelp size={20} />
        </button>
      </div>
    </header>
  );
}
