type PlanCardProps = {
  name: string;
  price: string;
  features: string[];
  cta: string;
  featured?: boolean;
  onClick?: () => void;
};

export function PlanCard({ name, price, features, cta, featured = false, onClick }: PlanCardProps) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.();
        }
      }}
      className={`group flex cursor-pointer flex-col rounded-2xl border bg-[rgba(27,45,42,0.75)] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-edt-neon ${
        featured ? 'border-edt-neon shadow-[0_0_24px_rgba(206,255,26,0.12)]' : 'border-[rgba(170,169,90,0.25)]'
      }`}
    >
      {featured ? (
        <span className="mb-4 inline-flex w-fit rounded-full border border-edt-neon px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-edt-neon">
          Popular
        </span>
      ) : null}
      <h3 className="font-display text-xl font-bold text-edt-soft">{name}</h3>
      <p className="mt-3 font-display text-3xl font-bold text-edt-gold">{price}</p>
      <ul className="mt-6 flex-1 space-y-3 text-sm leading-relaxed text-edt-soft/80">
        {features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <span className="text-edt-neon" aria-hidden="true">
              •
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <span className="mt-8 flex w-full items-center justify-center rounded-xl bg-edt-forest py-3.5 text-base font-bold uppercase tracking-[0.1em] text-edt-neon transition-colors group-hover:bg-[#243b37]">
        {cta}
      </span>
    </article>
  );
}
