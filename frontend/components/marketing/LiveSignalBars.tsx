"use client";

import { useEffect, useState } from "react";

const SERIES_LABELS = ["Cadrage", "Audit", "Build", "Tests", "Delivery"] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function LiveSignalBars() {
  const [values, setValues] = useState<number[]>([62, 54, 71, 66, 58]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setValues((current) =>
        current.map((item) => {
          const drift = (Math.random() - 0.5) * 20;
          return clamp(Math.round(item + drift), 28, 94);
        }),
      );
    }, 1800);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="grid h-64 grid-cols-5 items-end gap-3 sm:gap-4">
      {values.map((value, index) => (
        <div key={SERIES_LABELS[index]} className="flex h-full flex-col items-center justify-end gap-3">
          <div className="text-xs font-semibold text-slate-500">{value}%</div>
          <div className="relative flex h-48 w-full items-end overflow-hidden rounded-2xl border border-sky-100 bg-slate-100 px-2 py-2">
            <div
              className="w-full rounded-xl bg-[linear-gradient(180deg,#38bdf8_0%,#0284c7_58%,#0f172a_100%)] shadow-[0_8px_18px_rgba(2,132,199,0.24)] transition-all duration-700"
              style={{ height: `${value}%` }}
            />
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{SERIES_LABELS[index]}</div>
        </div>
      ))}
    </div>
  );
}

