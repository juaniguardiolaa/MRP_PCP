import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { GLOSSARY_LIST } from '../../help/glossary';

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export function GlossaryDrawer({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    search.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const q = normalize(query.trim());
  const entries = GLOSSARY_LIST.filter(
    (e) => !q || normalize(`${e.abbr} ${e.name} ${e.definition}`).includes(q),
  );

  return (
    <div className="drawer-layer no-print">
      <button type="button" className="drawer-backdrop" aria-label="Cerrar glosario" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="glossary-title">
        <header className="drawer-header">
          <div>
            <h2 id="glossary-title">Ayuda y glosario</h2>
            <p>Términos del MRP explicados con ejemplos del ejercicio.</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Cerrar" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <label className="search-field">
          <Search size={16} aria-hidden />
          <input
            id="glossary-search"
            ref={search}
            type="search"
            placeholder="Buscar un término (p. ej. NN, lead time)"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
        </label>
        <dl className="glossary-list">
          {entries.map((e) => (
            <div key={e.id} className="glossary-entry">
              <dt>
                <span className="glossary-abbr">{e.abbr}</span>
                {e.abbr !== e.name && <span className="glossary-name">{e.name}</span>}
              </dt>
              <dd>
                <p>{e.definition}</p>
                {e.formula && <code className="formula">{e.formula}</code>}
                {e.example && <p className="glossary-example">Ejemplo: {e.example}</p>}
              </dd>
            </div>
          ))}
          {entries.length === 0 && <p className="muted">No hay términos que coincidan con “{query}”.</p>}
        </dl>
      </aside>
    </div>
  );
}
