import type { DimensionScore } from '../types';

export function RadarChart({ dimensions }: { dimensions: DimensionScore[] }) {
  const width = 520;
  const height = 460;
  const cx = 260;
  const cy = 225;
  const radius = 130;
  const labelRadius = 178;
  const max = 5;
  const count = dimensions.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / count;
  const point = (i: number, value: number) => {
    const a = angle(i);
    const r = (value / max) * radius;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const labelPoint = (i: number) => {
    const a = angle(i);
    return [cx + labelRadius * Math.cos(a), cy + labelRadius * Math.sin(a)];
  };
  const anchor = (i: number) => {
    const cosine = Math.cos(angle(i));
    if (cosine > 0.2) return 'start';
    if (cosine < -0.2) return 'end';
    return 'middle';
  };
  const gridPoly = (level: number) => Array.from({ length: count }, (_, i) => point(i, level).join(',')).join(' ');
  const dataPoly = dimensions.map((dimension, i) => point(i, dimension.score).join(',')).join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      preserveAspectRatio="xMidYMid meet"
      className="mx-auto block h-auto w-full max-w-full select-none overflow-visible"
    >
      {[1, 2, 3, 4, 5].map((level) => (
        <polygon
          key={level}
          points={gridPoly(level)}
          fill="none"
          stroke={level === max ? '#cbd5e1' : '#e2e8f0'}
          strokeWidth={level === max ? 1.5 : 1}
        />
      ))}
      {dimensions.map((_, i) => {
        const [x, y] = point(i, max);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" strokeWidth="1" />;
      })}
      <polygon points={dataPoly} fill="rgba(14,165,233,0.18)" stroke="#0ea5e9" strokeWidth="2" />
      {dimensions.map((dimension, i) => {
        const [x, y] = point(i, dimension.score);
        return <circle key={dimension.id} cx={x} cy={y} r="4.5" fill="#0ea5e9" />;
      })}
      {[1, 2, 3, 4, 5].map((level) => {
        const [x, y] = point(0, level);
        return (
          <text key={level} x={x - 4} y={y + 3} fontSize="8" fill="#94a3b8" textAnchor="end">
            {level}
          </text>
        );
      })}
      {dimensions.map((dimension, i) => {
        const [x, y] = labelPoint(i);
        return (
          <text
            key={dimension.id}
            x={x}
            y={y}
            textAnchor={anchor(i)}
            fontSize="9.5"
            fill="#475569"
            dominantBaseline="middle"
          >
            {dimension.short}
          </text>
        );
      })}
    </svg>
  );
}
