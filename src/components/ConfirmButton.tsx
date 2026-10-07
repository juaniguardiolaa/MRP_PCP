import { useState } from 'react';

/**
 * Botón con confirmación dentro de la página (en lugar de window.confirm, que no
 * funciona en todos los entornos donde se publica la app).
 */
export function ConfirmButton({
  label,
  question,
  confirmLabel,
  onConfirm,
  className,
  ariaLabel,
  title,
}: {
  label: string;
  question: string;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
  ariaLabel?: string;
  title?: string;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className={className} aria-label={ariaLabel} title={title} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <span className="confirm-inline" role="group" aria-label={question}>
      <span className="confirm-question">{question}</span>
      <button
        type="button"
        className="btn btn-danger btn-sm"
        autoFocus
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className="btn btn-plain btn-sm" onClick={() => setAsking(false)}>
        Cancelar
      </button>
    </span>
  );
}
