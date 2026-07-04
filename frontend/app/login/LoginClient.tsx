"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { KeyRound, Mail, ShieldEllipsis } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { AuthShell } from "@/components/auth/AuthShell";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { PasswordField } from "@/components/auth/PasswordField";
import { isAbsoluteRedirectTarget, resolveSafeAuthRedirectTarget } from "@/lib/auth-redirect";
import { CLIENT_INNOVA_API_BASE, DEV_AUTO_LOGIN_ENABLED, SITE_BASE_URL } from "@/lib/env";

type Step = "credentials" | "verify";

type LoginClientProps = {
  defaultRedirect?: string;
  requestedRedirect?: string;
  heading?: string;
  subtitle?: string;
  helperTitle?: string;
  helperBody?: string;
  helperPoints?: string[];
  formEyebrow?: string;
  formTitle?: string;
  credentialsDescription?: string;
  verifyDescription?: string;
  googleLabel?: string;
  supportHref?: string | null;
  supportLabel?: string;
  signupHref?: string;
  signupLabel?: string;
  initialError?: string | null;
};

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `Erreur ${response.status}`;
  const text = await response.text().catch(() => "");
  if (!text) return fallback;

  try {
    const data = JSON.parse(text);
    if (typeof data?.detail === "string") return data.detail;
    if (typeof data?.detail?.detail === "string") return data.detail.detail;
  } catch {
    // Keep readable fallback below.
  }

  const compact = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return compact ? `${fallback}: ${compact.slice(0, 180)}` : fallback;
}

export default function LoginClient({
  defaultRedirect = "/",
  requestedRedirect,
  heading = "Connexion a double validation",
  subtitle = "Entrez votre email et votre mot de passe, puis confirmez la connexion avec le code OTP envoye par KORYXA depuis votre serveur Hetzner.",
  helperTitle = "Un acces simple, mais verrouille",
  helperBody = "Le mot de passe valide votre identite, puis l'OTP confirme que c'est bien vous. Le code part du backend KORYXA deploye sur Hetzner.",
  helperPoints = [
    "Connexion par mot de passe puis confirmation OTP.",
    "Session securisee par cookie HTTP-only cote serveur.",
    "Possibilite de tester localement sans OTP en mode developpement.",
  ],
  formEyebrow = "Espace membre",
  formTitle = "Connexion KORYXA",
  credentialsDescription = "Commencez par vos identifiants, puis confirmez avec le code OTP envoye par email.",
  verifyDescription = "Le code OTP finalise la connexion a votre espace.",
  googleLabel = "Continuer avec Google",
  supportHref = "/account/recover",
  supportLabel = "Mot de passe oublie",
  signupHref = "/signup",
  signupLabel = "Creer un compte",
  initialError = null,
}: LoginClientProps = {}) {
  const router = useRouter();
  const redirect = resolveSafeAuthRedirectTarget(requestedRedirect, defaultRedirect);
  const { refresh, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<Step>("credentials");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [info, setInfo] = useState<string | null>(null);
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [clientState, setClientState] = useState({
    ready: false,
    isPreviewDomain: false,
    isLocalHost: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hostname = window.location.hostname;
    setClientState({
      ready: true,
      isPreviewDomain: hostname.endsWith("vercel.app"),
      isLocalHost: hostname === "127.0.0.1" || hostname === "localhost",
    });
  }, []);

  const { ready, isPreviewDomain, isLocalHost } = clientState;

  useEffect(() => {
    if (!isPreviewDomain) return;
    window.location.href = `${SITE_BASE_URL}/login?redirect=${encodeURIComponent(redirect)}`;
  }, [isPreviewDomain, redirect]);

  useEffect(() => {
    if (user?.email) {
      if (isAbsoluteRedirectTarget(redirect)) {
        window.location.assign(redirect);
        return;
      }
      router.replace(redirect);
    }
  }, [redirect, router, user]);

  async function handleLocalLogin() {
    setLoading(true);
    setError(null);
    setInfo("Connexion locale en cours...");

    try {
      const response = await fetch(`${CLIENT_INNOVA_API_BASE}/auth/dev-login`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.detail === "string" ? data.detail : "Connexion locale indisponible.");
      }

      await refresh();
      if (isAbsoluteRedirectTarget(redirect)) {
        window.location.assign(redirect);
        return;
      }
      router.replace(redirect);
    } catch (err) {
      setInfo(null);
      setError(err instanceof Error ? err.message : "Connexion locale impossible.");
      setLoading(false);
    }
  }

  async function requestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    setDebugCode(null);

    try {
      const response = await fetch(`${CLIENT_INNOVA_API_BASE}/auth/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, intent: "login" }),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const data = await response.json().catch(() => ({}));
      setStep("verify");
      setInfo("Code OTP envoye. Saisissez-le pour terminer la connexion.");
      if (data?.debug_code) {
        setDebugCode(data.debug_code);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${CLIENT_INNOVA_API_BASE}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, code: otp, intent: "login" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data?.detail === "string"
            ? data.detail
            : typeof data?.detail?.detail === "string"
              ? data.detail.detail
              : "Code OTP invalide.";
        throw new Error(message);
      }

      await refresh();
      if (isAbsoluteRedirectTarget(redirect)) {
        window.location.assign(redirect);
        return;
      }
      if (isPreviewDomain) {
        window.location.href = `${SITE_BASE_URL}${redirect}`;
        return;
      }
      router.replace(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Connexion"
      title={heading}
      subtitle={subtitle}
      helperTitle={helperTitle}
      helperBody={helperBody}
      helperPoints={helperPoints}
      footerText="Pas encore de compte ?"
      footerHref={signupHref}
      footerLabel={signupLabel}
    >
      <div className="min-w-0 space-y-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">{formEyebrow}</div>
          <h2 className="mt-3 break-words text-2xl font-semibold text-slate-950 sm:text-3xl">{formTitle}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {step === "credentials" ? credentialsDescription : verifyDescription}
          </p>
        </div>

        {ready && DEV_AUTO_LOGIN_ENABLED && isLocalHost ? (
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
            Mode local actif : la connexion rapide reste disponible pour les tests hors production.
          </div>
        ) : null}

        {ready && isPreviewDomain ? (
          <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
            Domaine de previsualisation detecte. Apres connexion, vous serez renvoye vers {SITE_BASE_URL} pour garder une session valide.
          </div>
        ) : null}

        <div className="space-y-3">
          <GoogleAuthButton redirectTo={redirect} label={googleLabel} />
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">ou</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
        </div>

        {step === "credentials" ? (
          <form onSubmit={requestOtp} className="space-y-5">
            {ready && DEV_AUTO_LOGIN_ENABLED && isLocalHost ? (
              <button
                type="button"
                onClick={() => void handleLocalLogin()}
                className="w-full rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(5,150,105,0.22)] transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Connexion..." : "Connexion locale rapide"}
              </button>
            ) : null}

            <div>
              <label htmlFor="login_email" className="mb-2 block text-sm font-medium text-slate-700">
                Adresse email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="login_email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  placeholder="vous@entreprise.com"
                />
              </div>
            </div>

            <PasswordField
              id="login_password"
              label="Mot de passe"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              hint="Apres validation du mot de passe, un OTP sera envoye par email."
              placeholder="Votre mot de passe"
            />

            {error ? (
              <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{error}</div>
            ) : null}

            {info ? (
              <div className="rounded-[24px] border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-700">{info}</div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                className="inline-flex flex-1 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0f172a_0%,#0284c7_58%,#38bdf8_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(2,132,199,0.24)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                {loading ? "Verification..." : "Envoyer le code OTP"}
              </button>
              {supportHref ? (
                <Link
                  href={supportHref}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  {supportLabel}
                </Link>
              ) : null}
            </div>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-5">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4 sm:rounded-[28px] sm:p-5">
              <div className="flex items-start gap-3">
                <ShieldEllipsis className="mt-0.5 h-5 w-5 text-sky-700" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">Validation OTP</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Le code a ete envoye a <span className="break-all font-medium text-slate-900">{email}</span>.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="login_otp" className="mb-2 block text-sm font-medium text-slate-700">
                Code OTP
              </label>
              <input
                id="login_otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={8}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center text-base font-semibold tracking-[0.18em] text-slate-900 shadow-sm outline-none transition placeholder:text-slate-300 focus:border-sky-300 focus:ring-4 focus:ring-sky-100 sm:px-4 sm:text-lg sm:tracking-[0.35em]"
                placeholder="000000"
              />
              {debugCode ? <p className="mt-2 text-xs text-slate-500">Code debug : {debugCode}</p> : null}
            </div>

            {error ? (
              <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{error}</div>
            ) : null}

            {info ? (
              <div className="rounded-[24px] border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-700">{info}</div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                className="inline-flex flex-1 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0f172a_0%,#0284c7_58%,#38bdf8_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(2,132,199,0.24)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Connexion..." : "Confirmer la connexion"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("credentials");
                  setOtp("");
                  setDebugCode(null);
                  setError(null);
                  setInfo(null);
                }}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Modifier
              </button>
            </div>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
