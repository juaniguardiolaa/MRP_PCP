import { Search, TriangleAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ItemCode } from './Chips';

export interface ListEntry {
  code: string;
  title: string;
  meta?: ReactNode;
  trailing?: ReactNode;
  /** Muestra el ícono de alerta (errores u órdenes atrasadas). */
  alert?: boolean;
  /** Encabezado de grupo (p. ej. "Nivel 1"); las entradas deben venir ordenadas por grupo. */
  group?: string;
}

/** Lista maestra de un patrón maestro-detalle (ítems, conjuntos de la BOM, etc.). */
export function ItemList({
  entries,
  selected,
  onSelect,
  label,
  searchable,
  footer,
}: {
  entries: ListEntry[];
  selected: string | null;
  onSelect: (code: string) => void;
  label: string;
  searchable?: boolean;
  footer?: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = entries.filter((e) => !q || `${e.code} ${e.title}`.toLowerCase().includes(q));

  return (
    <nav className="master-list" aria-label={label}>
      {searchable && (
        <label className="search-field search-field-compact">
          <Search size={15} aria-hidden />
          <input
            type="search"
            placeholder="Buscar"
            aria-label={`Buscar en ${label.toLowerCase()}`}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
        </label>
      )}
      <ul>
        {shown.map((e, i) => (
          <li key={e.code}>
            {e.group && e.group !== shown[i - 1]?.group && <p className="master-group">{e.group}</p>}
            <button
              type="button"
              className={e.code === selected ? 'master-item master-item-on' : 'master-item'}
              aria-current={e.code === selected ? 'true' : undefined}
              onClick={() => onSelect(e.code)}
            >
              <ItemCode code={e.code} />
              <span className="master-text">
                <span className="master-title">{e.title}</span>
                {e.meta && <span className="master-meta">{e.meta}</span>}
              </span>
              {e.alert && <TriangleAlert size={16} className="master-alert" aria-label="Requiere atención" />}
              {e.trailing}
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="master-empty">Sin resultados.</li>}
      </ul>
      {footer && <div className="master-footer">{footer}</div>}
    </nav>
  );
}
