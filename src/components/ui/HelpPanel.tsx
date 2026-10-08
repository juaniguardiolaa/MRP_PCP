import { BookOpen, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { PAGE_HELP } from '../../help/pages';
import type { ViewId } from '../../navigation';
import { Term } from './Term';

const key = (view: ViewId) => `mrp-pcp:help:${view}`;

function initialOpen(view: ViewId): boolean {
  try {
    return localStorage.getItem(key(view)) !== 'closed';
  } catch {
    return true;
  }
}

/** Panel plegable "Cómo leer esta pantalla". Recuerda si el usuario lo cerró. */
export function HelpPanel({ view }: { view: ViewId }) {
  const help = PAGE_HELP[view];
  const [open, setOpen] = useState(() => initialOpen(view));
  const [prevView, setPrevView] = useState(view);
  if (view !== prevView) {
    setPrevView(view);
    setOpen(initialOpen(view));
  }

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(key(view), next ? 'open' : 'closed');
    } catch {
      // sin almacenamiento
    }
  };

  return (
    <div className={open ? 'help-panel help-open no-print' : 'help-panel no-print'}>
      <button type="button" className="help-toggle" aria-expanded={open} onClick={toggle}>
        <BookOpen size={16} aria-hidden />
        <span>Cómo leer esta pantalla</span>
        <ChevronDown size={16} className="help-chevron" aria-hidden />
      </button>
      {open && (
        <div className="help-body">
          <ol className="help-steps">
            {help.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          {help.terms.length > 0 && (
            <p className="help-terms">
              <span>Conceptos:</span>
              {help.terms.map((t) => (
                <Term key={t} id={t} />
              ))}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
