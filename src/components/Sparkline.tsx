interface SparklineProps {
  data: number[];
  min?: number;
  max?: number;
  color?: string;
  height?: number;
}

/** Minimal inline SVG sparkline — no chart library needed. */
export default function Sparkline({
  data,
  min = 0,
  max = 1,
  color = 'var(--accent)',
  height = 48,
}: SparklineProps) {
  const width = 240;
  if (data.length < 2) {
    return (
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="var(--bg-tertiary)" strokeWidth="1" />
      </svg>
    );
  }

  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * step;
      const y = height - ((Math.max(min, Math.min(max, v)) - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
