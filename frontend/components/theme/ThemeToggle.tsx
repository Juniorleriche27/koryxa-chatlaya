"use client";

import clsx from "clsx";
import { useTheme } from "@/components/theme/ThemeProvider";

type ThemeToggleProps = {
  variant?: "light" | "dark";
  showLabel?: boolean;
  className?: string;
};

function IconSun(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="4.5" />
      <path
        strokeLinecap="round"
        d="M12 2.75v2.5M12 18.75v2.5M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2.75 12h2.5M18.75 12h2.5M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77"
      />
    </svg>
  );
}

function IconMoon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.25 14.25A8.25 8.25 0 0 1 9.75 3.75 8.25 8.25 0 1 0 20.25 14.25Z"
      />
    </svg>
  );
}

export default function ThemeToggle({
  variant = "light",
  showLabel = true,
  className,
}: ThemeToggleProps) {
  const { theme, mounted, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = mounted ? (isDark ? "Mode clair" : "Mode sombre") : "Thème";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={clsx(
        "inline-flex items-center justify-center gap-1 rounded-full border px-2 py-2 text-sm font-semibold transition",
        variant === "dark"
          ? "border-slate-700 bg-slate-900 text-slate-100 hover:border-sky-400/60 hover:text-sky-100"
          : "border-slate-200 bg-white/92 text-slate-700 shadow-sm shadow-slate-900/5 hover:border-sky-200 hover:bg-sky-50/80 hover:text-sky-700",
        className,
      )}
    >
      <span
        className={clsx(
          "inline-flex h-8 w-8 items-center justify-center rounded-full transition",
          !isDark
            ? variant === "dark"
              ? "bg-slate-800 text-amber-200"
              : "bg-amber-100 text-amber-600"
            : "text-slate-400",
        )}
      >
        <IconSun className="h-4 w-4" />
      </span>
      <span
        className={clsx(
          "inline-flex h-8 w-8 items-center justify-center rounded-full transition",
          isDark
            ? variant === "dark"
              ? "bg-slate-800 text-sky-200"
              : "bg-sky-100 text-sky-700"
            : "text-slate-400",
        )}
      >
        <IconMoon className="h-4 w-4" />
      </span>
      {showLabel ? <span className="hidden whitespace-nowrap sm:inline">{label}</span> : null}
    </button>
  );
}
