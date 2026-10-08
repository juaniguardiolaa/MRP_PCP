import type { ReactNode } from 'react';

/** Contenedor con título, como los paneles de un ERP. */
export function Panel({
  title,
  subtitle,
  actions,
  keepTogether,
  flush,
  className,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Al imprimir, evita partir el panel entre dos páginas (para paneles cortos). */
  keepTogether?: boolean;
  /** Sin relleno interno, para tablas que ocupan todo el ancho del panel. */
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const classes = ['panel', keepTogether && 'panel-keep', className].filter(Boolean).join(' ');
  return (
    <section className={classes}>
      {(title || actions) && (
        <header className="panel-header">
          <div className="panel-heading">
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      <div className={flush ? 'panel-body panel-body-flush' : 'panel-body'}>{children}</div>
    </section>
  );
}
