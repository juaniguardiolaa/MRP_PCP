import { CircleHelp, X } from 'lucide-react';
import { NAV_GROUPS, VIEWS, type ViewId } from '../../navigation';

export function Sidebar({
  view,
  onNavigate,
  onHelp,
  onClose,
  badges,
}: {
  view: ViewId;
  onNavigate: (view: ViewId) => void;
  onHelp: () => void;
  onClose: () => void;
  /** Contadores por vista (p. ej. órdenes atrasadas en Análisis). */
  badges: Partial<Record<ViewId, number>>;
}) {
  return (
    <aside className="sidebar no-print" aria-label="Menú principal">
      <div className="brand">
        <span className="brand-mark" aria-hidden>
          MRP
        </span>
        <span className="brand-text">
          <span className="brand-name">MRP · PCP</span>
          <span className="brand-sub">Planificación de materiales</span>
        </span>
        <button type="button" className="sidebar-close" aria-label="Cerrar menú" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <nav className="nav">
        {NAV_GROUPS.map((g) => (
          <div key={g.id} className="nav-group">
            {g.step !== null && (
              <p className="nav-group-title">
                <span className="nav-step">{g.step}</span>
                <span className="nav-group-label">{g.title}</span>
              </p>
            )}
            <ul>
              {g.views.map((id) => {
                const v = VIEWS[id];
                const Icon = v.icon;
                const badge = badges[id];
                const label = id === 'inicio' ? 'Inicio' : v.title;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className={id === view ? 'nav-item nav-item-on' : 'nav-item'}
                      aria-current={id === view ? 'page' : undefined}
                      title={label}
                      onClick={() => onNavigate(id)}
                    >
                      <Icon size={18} aria-hidden className="nav-icon" />
                      <span className="nav-label">{label}</span>
                      {badge ? (
                        <span className="nav-badge" aria-label={`${badge} pendientes`}>
                          {badge}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="nav-item" title="Ayuda y glosario" onClick={onHelp}>
          <CircleHelp size={18} aria-hidden className="nav-icon" />
          <span className="nav-label">Ayuda y glosario</span>
        </button>
        <p className="sidebar-note">PCP · Ingeniería Industrial · UTN FRH</p>
      </div>
    </aside>
  );
}
