/** Neon blocks on a muted track: `segments` blocks span 0–100%. The value is also in `label` for screen readers. */
export function MasteryBar({
  percent,
  segments = 10,
  label,
}: {
  percent: number;
  segments?: number;
  label: string;
}) {
  const filled = (Math.max(0, Math.min(100, percent)) / 100) * segments;

  return (
    <div className="flex h-3 min-w-0 flex-1 gap-0.5" role="img" aria-label={label}>
      {Array.from({ length: segments }, (_, index) => {
        const fill = Math.max(0, Math.min(1, filled - index));
        return (
          <div key={index} className="h-full min-w-0 flex-1 overflow-hidden bg-edt-olive/30">
            {fill > 0 ? <div className="h-full bg-edt-neon" style={{ width: `${fill * 100}%` }} /> : null}
          </div>
        );
      })}
    </div>
  );
}
