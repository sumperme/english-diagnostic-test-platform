export function VisualCard({
  image,
  step,
  title,
  children,
}: {
  image: string;
  step: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article
      className="group relative min-h-80 overflow-hidden border border-[rgba(170,169,90,0.2)] bg-cover bg-center px-9 pb-10 pt-14 transition-all duration-300 hover:-translate-y-2.5 hover:border-edt-neon"
      style={{ backgroundImage: `url(${image})` }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[rgba(27,45,42,0.85)] to-[rgba(27,45,42,0.95)]" />
      <span className="relative z-10 float-right font-display text-6xl text-[rgba(206,255,26,0.15)]">
        {step}
      </span>
      <h3 className="relative z-10 mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-edt-neon">
        {title}
      </h3>
      <div className="relative z-10 mt-5 text-sm leading-7 text-edt-soft/85">{children}</div>
    </article>
  );
}
