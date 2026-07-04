import clsx from "clsx";

type BrandLogoProps = {
  className?: string;
};

export default function BrandLogo({ className }: BrandLogoProps) {
  return (
    <span
      className={clsx(
        "relative inline-flex overflow-hidden rounded-[1.1rem] border border-slate-200/80 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.12)]",
        className,
      )}
    >
      <img
        src="/brand/koryxa-logo.png"
        alt="Logo KORYXA"
        className="h-full w-full object-cover"
      />
    </span>
  );
}
