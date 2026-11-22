import { shortDate } from "../logic/clock";
import type { ProgressMetric, ProgressPoint } from "../logic/progress";

export const CHART_TITLES: Record<ProgressMetric, string> = {
  weight: "Heaviest set per session",
  reps: "Best reps per session",
  seconds: "Longest hold per session",
};

// Drawn in viewBox units; the notice is about 330px wide on a phone, so units ≈ px.
const W = 320;
const H = 180;
const PAD = { left: 36, right: 14, top: 22, bottom: 26 };

/** A round step (1, 2, 2.5 or 5 × 10ⁿ) near the given size. */
function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10) * power;
}

/** Gridline values covering every point, two or three steps apart. */
function ticks(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = niceStep(Math.max(max - min, max * 0.1, 1) / 2);
  const lo = Math.max(0, Math.floor(min / step) * step);
  let hi = Math.ceil(max / step) * step;
  if (hi === lo) hi = lo + step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 1000; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

type Props = { metric: ProgressMetric; points: ProgressPoint[] };

/** Straight segments between sessions, red dots, gold record dots. Hand-drawn SVG. */
export function ProgressChart({ metric, points }: Props) {
  const title = CHART_TITLES[metric];
  if (points.length === 0) return null;

  const grid = ticks(points.map((p) => p.value));
  const lo = grid[0];
  const hi = grid[grid.length - 1];
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => (points.length === 1 ? PAD.left + plotW / 2 : PAD.left + (i / (points.length - 1)) * plotW);
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH;
  const lastRecord = points.map((p) => p.isRecord).lastIndexOf(true);
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
      {grid.map((v) => (
        <g key={v}>
          <line className="chart__grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
          <text className="chart__label" x={PAD.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle">
            {v}
          </text>
        </g>
      ))}
      {points.length > 1 && <polyline className="chart__line" points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")} />}
      {points.map((p, i) => (
        <circle
          key={p.sessionId}
          className={p.isRecord ? "chart__point chart__point--record" : "chart__point"}
          cx={x(i)}
          cy={y(p.value)}
          r={p.isRecord ? 5 : 4}
        />
      ))}
      {lastRecord !== -1 && (
        <text
          className="chart__record"
          x={x(lastRecord) + (lastRecord === points.length - 1 ? 6 : 0)}
          y={y(points[lastRecord].value) - 10}
          // At the right edge, end the label at the point so it stays inside the notice.
          textAnchor={lastRecord === points.length - 1 ? "end" : "middle"}
        >
          Record
        </text>
      )}
      <text className="chart__label" x={x(0)} y={H - 6} textAnchor={points.length === 1 ? "middle" : "start"}>
        {shortDate(first.date)}
      </text>
      {points.length > 1 && (
        <text className="chart__label" x={x(points.length - 1)} y={H - 6} textAnchor="end">
          {shortDate(last.date)}
        </text>
      )}
    </svg>
  );
}
