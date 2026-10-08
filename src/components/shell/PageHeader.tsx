import type { ReactNode } from 'react';
import { groupOf, VIEWS, type ViewId } from '../../navigation';
import { HelpPanel } from '../ui/HelpPanel';

export function PageHeader({
  view,
  eyebrow,
  actions,
  help = true,
}: {
  view: ViewId;
  /** Reemplaza el rótulo "Paso N · Grupo". */
  eyebrow?: string;
  actions?: ReactNode;
  help?: boolean;
}) {
  const def = VIEWS[view];
  const group = groupOf(view);
  const kicker = eyebrow ?? (group.step !== null ? `Paso ${group.step} · ${group.title}` : null);
  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          {kicker && <p className="eyebrow">{kicker}</p>}
          <h1>{def.title}</h1>
          <p className="page-summary">{def.summary}</p>
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </header>
      {help && <HelpPanel view={view} />}
    </>
  );
}
