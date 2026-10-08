import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { GLOSSARY, type GlossaryId } from '../../help/glossary';

const TIP_WIDTH = 300;

/**
 * Sigla o término con su definición en un tooltip (al pasar el mouse o con el teclado).
 * El tooltip se dibuja fuera de la tabla para que no lo recorte el desplazamiento horizontal.
 */
export function Term({ id, children }: { id: GlossaryId; children?: ReactNode }) {
  const entry = GLOSSARY[id];
  const tipId = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null);

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - TIP_WIDTH - 8);
    const above = r.bottom + 160 > window.innerHeight;
    setPos({ left, top: above ? r.top - 6 : r.bottom + 6, above });
  };
  const hide = () => setPos(null);

  // El tooltip tiene posición fija: se oculta si la página se desplaza.
  useEffect(() => {
    if (!pos) return;
    const onScroll = () => setPos(null);
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [pos]);

  return (
    <>
      <span
        ref={ref}
        className="term"
        tabIndex={0}
        aria-describedby={pos ? tipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onKeyDown={(e) => e.key === 'Escape' && hide()}
      >
        {children ?? entry.abbr}
      </span>
      {pos &&
        createPortal(
          <span
            role="tooltip"
            id={tipId}
            className={pos.above ? 'term-tip term-tip-above' : 'term-tip'}
            style={{ left: pos.left, top: pos.top, width: TIP_WIDTH }}
          >
            <strong>
              {entry.abbr !== entry.name ? `${entry.abbr} · ${entry.name}` : entry.name}
            </strong>
            <span>{entry.definition}</span>
            {entry.formula && <code>{entry.formula}</code>}
          </span>,
          document.body,
        )}
    </>
  );
}
