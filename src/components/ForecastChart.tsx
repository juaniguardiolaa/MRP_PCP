import { fitAt, type ProductForecast } from '../domain/forecast';
import { fmt } from './common';

const W = 520;
const H = 200;
const PAD = { top: 14, right: 12, bottom: 26, left: 34 };

function niceStep(max: number) {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  return [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? pow * 10;
}

/** Serie cargada (gris), recta de regresión (azul punteada) y semanas pronosticadas (azul). */
export function ForecastChart({ product, history, base }: { product: ProductForecast; history: number[]; base: number }) {
  const to = product.cells.at(-1)?.week ?? base;
  const values = [...history, ...product.cells.map((c) => c.value), fitAt(product.fit, to), fitAt(product.fit, 1)];
  const step = niceStep(Math.max(1, ...values));
  const top = Math.ceil(Math.max(1, ...values) / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const x = (t: number) => PAD.left + ((t - 0.5) / to) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - Math.max(0, v) / top) * (H - PAD.top - PAD.bottom);
  const divider = x(base + 0.5);
  const labelEvery = to > 16 ? 4 : 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart forecast-chart" role="img" aria-label={`Demanda y pronóstico de ${product.code}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line className="chart-grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
          <text className="chart-axis" x={PAD.left - 6} y={y(t)} textAnchor="end" dominantBaseline="central">
            {fmt(t)}
          </text>
        </g>
      ))}
      <rect className="forecast-zone" x={divider} y={PAD.top} width={W - PAD.right - divider} height={H - PAD.top - PAD.bottom} />
      <text className="chart-axis forecast-zone-label" x={divider + 6} y={PAD.top + 10}>
        Pronóstico
      </text>
      {Array.from({ length: to }, (_, i) => i + 1)
        .filter((t) => t === 1 || t % labelEvery === 0)
        .map((t) => (
          <text key={t} className="chart-axis" x={x(t)} y={H - 8} textAnchor="middle">
            S{t}
          </text>
        ))}
      <line className="fit-line" x1={x(1)} y1={y(fitAt(product.fit, 1))} x2={x(to)} y2={y(fitAt(product.fit, to))} />
      <polyline className="history-line" points={history.map((v, i) => `${x(i + 1)},${y(v)}`).join(' ')} />
      {history.map((v, i) => (
        <circle key={`h${i}`} className="history-dot" cx={x(i + 1)} cy={y(v)} r={4}>
          <title>{`S${i + 1}: ${fmt(v)} u. (cargada)`}</title>
        </circle>
      ))}
      {product.cells.map((c) => (
        <circle
          key={`f${c.week}`}
          className={c.source === 'override' ? 'forecast-dot forecast-dot-override' : 'forecast-dot'}
          cx={x(c.week)}
          cy={y(c.value)}
          r={4.5}
        >
          <title>{`S${c.week}: ${fmt(c.value)} u. (${c.source === 'override' ? 'escrita a mano' : 'pronóstico'})`}</title>
        </circle>
      ))}
    </svg>
  );
}
