"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";

export default function SignalementButton() {
  const pathname = usePathname();

  if (pathname.startsWith("/chatlaya")) return null;

  return (
    <div className="fixed left-4 top-20 z-40 sm:left-6 sm:top-32">
      {/* Ring ping autour du bouton */}
      <span className="absolute inset-0 animate-ping rounded-full bg-orange-400/40" />
      <Link
        href="/chatlaya?intent=problem_collector"
        aria-label="Partager un problème autour de vous"
        className="relative flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#ea580c_0%,#f97316_60%,#fb923c_100%)] px-4 py-2.5 text-xs font-bold text-white shadow-[0_0_18px_rgba(249,115,22,0.50)] transition-all duration-200 hover:scale-105 hover:shadow-[0_0_28px_rgba(249,115,22,0.65)]"
      >
        <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse" />
        <span className="hidden sm:inline">Vous observez un problème ?</span>
        <span className="sm:hidden">Un problème ?</span>
      </Link>
    </div>
  );
}
