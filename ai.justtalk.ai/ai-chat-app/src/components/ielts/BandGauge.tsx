/**
 * IELTS band gauge — top half-circle SVG with the band number in the center.
 * Stroke color uses the app's `--primary` (brand blue).
 */

interface BandGaugeProps {
  value: number;
  label: string;
  size?: number;
  cefr?: string | null;
}

const BAND_MAX = 9;

export function BandGauge({ value, label, size = 160, cefr }: BandGaugeProps) {
  const clamped = Math.max(0, Math.min(BAND_MAX, value));
  const pct = clamped / BAND_MAX;
  const stroke = 12;
  const pad = stroke; // ensure the stroke isn't clipped at the edges
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2; // arc baseline (the diameter)
  const halfCirc = Math.PI * r;
  const dash = pct * halfCirc;
  const gap = halfCirc - dash;

  // Top-half semicircle path: left edge → right edge, sweeping clockwise through the top.
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  // SVG height needs to cover from y=cy-r-stroke/2 down to cy+stroke/2 (a sliver below baseline for the linecap).
  const svgWidth = size + pad;
  const svgHeight = size / 2 + stroke;
  // viewBox shifted so the gauge sits centred and isn't clipped on the sides.
  const viewBox = `${-pad / 2} ${-stroke / 2} ${svgWidth} ${svgHeight}`;

  return (
    <div className="flex flex-col items-center gap-1.5 text-primary">
      <div className="relative" style={{ width: size, height: svgHeight }}>
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={viewBox}
          className="overflow-visible block"
        >
          {/* Track (faint) */}
          <path
            d={arcPath}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.12}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          {/* Value arc */}
          {dash > 0 && (
            <path
              d={arcPath}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${gap}`}
            />
          )}
        </svg>
        {/* Centered numeric — sits inside the half-circle */}
        <div
          className="absolute inset-x-0 flex items-baseline justify-center gap-0.5 text-foreground"
          style={{ top: size / 2 - 28 }}
        >
          <span className="text-3xl font-bold tabular-nums leading-none">
            {clamped.toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground leading-none">
            /{BAND_MAX.toFixed(1)}
          </span>
        </div>
      </div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
      {cefr && <CefrChip level={cefr} />}
    </div>
  );
}

export function CefrChip({ level, size = 'sm' }: { level: string; size?: 'sm' | 'md' }) {
  const cls = cefrClasses(level);
  const dims =
    size === 'md'
      ? 'text-xs px-2.5 py-0.5 h-6'
      : 'text-[10px] px-2 py-0 h-5';
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold ${dims} ${cls}`}
    >
      {level}
    </span>
  );
}

function cefrClasses(level: string): string {
  switch (level.toUpperCase()) {
    case 'A1':
      return 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300';
    case 'A2':
      return 'bg-sky-200 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200';
    case 'B1':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
    case 'B2':
      return 'bg-emerald-200 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200';
    case 'C1':
      return 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300';
    case 'C2':
      return 'bg-violet-200 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200';
    default:
      return 'bg-muted text-muted-foreground';
  }
}
