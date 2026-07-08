export type RadarAxis = {
  id: number | string;
  short: string;
  score: number;
  max: number;
};

/**
 * N-axis radar with per-axis maxima (values normalized to each axis's max).
 * When every axis shares the same max, the grid rings carry numeric labels
 * (1..max in five steps — identical to the original 12x5 Test 1 chart).
 */
export function RadarChart({ axes }: { axes: RadarAxis[] }) {
  const width = 520;
  const height = 460;
  const cx = 260;
  const cy = 225;
  const radius = 130;
  const labelRadius = 178;
  const levels = [1, 2, 3, 4, 5];
  const count = axes.length;
  const uniformMax = axes.every((axis) => axis.max === axes[0]?.max) ? axes[0]?.max : null;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / count;
  const point = (i: number, fraction: number) => {
    const a = angle(i);
    const r = fraction * radius;
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
  const fractionFor = (axis: RadarAxis) => (axis.max > 0 ? Math.min(1, axis.score / axis.max) : 0);
  const gridPoly = (level: number) =>
    Array.from({ length: count }, (_, i) => point(i, level / 5).join(',')).join(' ');
  const dataPoly = axes.map((axis, i) => point(i, fractionFor(axis)).join(',')).join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      preserveAspectRatio="xMidYMid meet"
      className="mx-auto block h-auto w-full max-w-full select-none overflow-visible"
    >
      {levels.map((level) => (
        <polygon
          key={level}
          points={gridPoly(level)}
          fill="none"
          stroke={level === 5 ? '#cbd5e1' : '#e2e8f0'}
          strokeWidth={level === 5 ? 1.5 : 1}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = point(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" strokeWidth="1" />;
      })}
      <polygon points={dataPoly} fill="rgba(14,165,233,0.18)" stroke="#0ea5e9" strokeWidth="2" />
      {axes.map((axis, i) => {
        const [x, y] = point(i, fractionFor(axis));
        return <circle key={axis.id} cx={x} cy={y} r="4.5" fill="#0ea5e9" />;
      })}
      {uniformMax != null
        ? levels.map((level) => {
            const [x, y] = point(0, level / 5);
            const value = (uniformMax * level) / 5;
            return (
              <text key={level} x={x - 4} y={y + 3} fontSize="8" fill="#94a3b8" textAnchor="end">
                {Number.isInteger(value) ? value : value.toFixed(1)}
              </text>
            );
          })
        : null}
      {axes.map((axis, i) => {
        const [x, y] = labelPoint(i);
        return (
          <text
            key={axis.id}
            x={x}
            y={y}
            textAnchor={anchor(i)}
            fontSize="9.5"
            fill="#475569"
            dominantBaseline="middle"
          >
            {axis.short}
          </text>
        );
      })}
    </svg>
  );
}
