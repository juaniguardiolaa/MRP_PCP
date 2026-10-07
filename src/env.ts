/**
 * true cuando la app se compila para publicarse como página de claude.ai
 * (`npm run build:artifact`). Ese visor no permite imprimir ni descargar archivos,
 * así que esas opciones se ocultan.
 */
export const IS_ARTIFACT = import.meta.env.VITE_TARGET === 'artifact';
