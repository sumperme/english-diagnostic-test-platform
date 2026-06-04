type PrimaryCTAProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'outline' | 'filled';
};

export function PrimaryCTA({ tone = 'outline', className = '', ...props }: PrimaryCTAProps) {
  const base =
    'inline-flex items-center justify-center px-10 py-4 text-sm font-semibold uppercase tracking-[0.14em] transition-all disabled:cursor-not-allowed disabled:opacity-50';
  const styles =
    tone === 'filled'
      ? 'bg-edt-gold text-edt-forest hover:-translate-y-0.5 hover:bg-edt-neon hover:shadow-neon'
      : 'border border-edt-neon text-edt-neon hover:bg-edt-neon hover:text-edt-forest hover:shadow-neon';

  return <button {...props} className={`${base} ${styles} ${className}`} />;
}
