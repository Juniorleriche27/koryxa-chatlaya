"use client";

type Props = {
  items: readonly string[];
  className?: string;
};

export default function AnimatedTicker({ items, className }: Props) {
  const doubled = [...items, ...items];
  return (
    <div className={`overflow-hidden rounded-full border border-white/10 bg-white/6 px-2 py-2 ${className ?? ""}`}>
      <div className="kx-ticker-track whitespace-nowrap text-xs font-semibold uppercase tracking-[0.2em] text-sky-100 sm:text-sm">
        {doubled.map((item, i) => (
          <span key={`${item}-${i}`} className="mx-5 inline-flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-300" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
