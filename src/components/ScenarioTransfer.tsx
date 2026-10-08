import { X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Scenario } from '../domain/types';
import { IS_ARTIFACT } from '../env';
import { downloadScenario, parseScenario } from '../state/scenarioIO';
import { Panel } from './ui/Panel';

export type TransferMode = 'export' | 'import';

/** Panel para exportar el escenario (copiar o descargar) o importarlo (archivo o texto pegado). */
export function ScenarioTransfer({
  mode,
  scenario,
  onImport,
  onClose,
}: {
  mode: TransferMode;
  scenario: Scenario;
  onImport: (s: Scenario) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const exportArea = useRef<HTMLTextAreaElement>(null);
  const json = JSON.stringify(scenario, null, 2);

  const load = (raw: string) => {
    try {
      onImport(parseScenario(JSON.parse(raw)));
    } catch (e) {
      setError(
        e instanceof SyntaxError
          ? 'El texto no es un JSON válido. Revisá que esté completo.'
          : e instanceof Error
            ? e.message
            : String(e),
      );
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
    } catch {
      // Sin acceso al portapapeles: se selecciona el texto para copiarlo a mano.
      exportArea.current?.select();
    }
  };

  return (
    <Panel
      className="transfer no-print"
      title={mode === 'export' ? 'Exportar escenario' : 'Importar escenario'}
      subtitle={
        mode === 'export'
          ? 'Guardá este texto en un archivo .json para recuperar el escenario más adelante o compartirlo con el grupo.'
          : 'Elegí un archivo .json exportado desde esta app o pegá su contenido. Reemplaza los datos actuales.'
      }
      actions={
        <button type="button" className="icon-btn" aria-label="Cerrar" title="Cerrar" onClick={onClose}>
          <X size={18} />
        </button>
      }
    >
      {mode === 'export' ? (
        <div className="transfer-body">
          <textarea id="export-json" ref={exportArea} className="json-area" readOnly value={json} rows={8} />
          <div className="transfer-actions">
            <button type="button" className="btn btn-primary" onClick={copy}>
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            {!IS_ARTIFACT && (
              <button type="button" className="btn btn-secondary" onClick={() => downloadScenario(scenario)}>
                Descargar .json
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="transfer-body">
          <label className="field-label" htmlFor="import-file">
            Archivo
            <input
              id="import-file"
              type="file"
              accept="application/json,.json"
              onChange={async (e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = '';
                if (file) load(await file.text());
              }}
            />
          </label>
          <textarea
            id="import-json"
            className="json-area"
            rows={8}
            placeholder="…o pegá acá el contenido del archivo .json"
            value={text}
            onChange={(e) => {
              setText(e.currentTarget.value);
              setError(null);
            }}
          />
          {error && <p className="issue issue-error">No se pudo importar: {error}</p>}
          <div className="transfer-actions">
            <button type="button" className="btn btn-primary" disabled={!text.trim()} onClick={() => load(text)}>
              Cargar escenario
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}
