"use client";

import { DIRECT_INNOVA_API_BASE } from "@/lib/env";

type GoogleAuthButtonProps = {
  redirectTo: string;
  label: string;
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.8 0 3 .8 3.7 1.5l2.5-2.4C16.6 3.5 14.5 2.6 12 2.6 6.9 2.6 2.8 6.8 2.8 12s4.1 9.4 9.2 9.4c5.3 0 8.9-3.7 8.9-9 0-.6-.1-1.1-.2-1.6H12Z" />
      <path fill="#34A853" d="M2.8 12c0 5.2 4.1 9.4 9.2 9.4 5.3 0 8.9-3.7 8.9-9 0-.6-.1-1.1-.2-1.6H12v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.2 0-5.9-2.7-5.9-6Z" opacity=".001" />
      <path fill="#FBBC05" d="M4.9 7.5 8.1 9.8C8.9 8 10.3 6.9 12 6.9c1.8 0 3 .8 3.7 1.5l2.5-2.4C16.6 3.5 14.5 2.6 12 2.6c-3.5 0-6.6 2-8.1 4.9Z" />
      <path fill="#4285F4" d="M12 21.4c2.4 0 4.5-.8 6.1-2.3l-2.8-2.3c-.8.6-1.8 1-3.3 1-2.5 0-4.6-1.7-5.3-4l-3.3 2.5c1.5 3 4.6 5.1 8.6 5.1Z" />
      <path fill="#34A853" d="M6.7 13.8c-.2-.5-.3-1.2-.3-1.8s.1-1.2.3-1.8L3.4 7.7C2.9 8.9 2.6 10.4 2.6 12s.3 3.1.8 4.3l3.3-2.5Z" />
    </svg>
  );
}

export function GoogleAuthButton({ redirectTo, label }: GoogleAuthButtonProps) {
  const target = `${DIRECT_INNOVA_API_BASE}/auth/google/start?redirect=${encodeURIComponent(redirectTo)}`;
  return (
    <a
      href={target}
      className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
    >
      <GoogleIcon />
      <span>{label}</span>
    </a>
  );
}
