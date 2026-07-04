"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Sparkles, UserRound } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { AuthShell } from "@/components/auth/AuthShell";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { PasswordField } from "@/components/auth/PasswordField";
import { isAbsoluteRedirectTarget, resolveSafeAuthRedirectTarget } from "@/lib/auth-redirect";
import { CLIENT_INNOVA_API_BASE } from "@/lib/env";

type SignupStep = "form" | "verify";

type SignupClientProps = {
  successRedirect?: string;
  heading?: string;
  subtitle?: string;
  helperTitle?: string;
  helperBody?: string;
  helperPoints?: string[];
  formEyebrow?: string;
  formTitle?: string;
  formDescription?: string;
  verifyDescription?: string;
  googleLabel?: string;
  loginHref?: string;
  loginLabel?: string;
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
    // fallback below
  }

  const compact = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return compact ? `${fallback}: ${compact.slice(0, 180)}` : fallback;
}

export default function SignupClient({
  successRedirect = "/onboarding",
  heading = "Inscription KORYXA",
  subtitle = "Creez votre compte, confirmez votre mot de passe, puis validez l'inscription avec un OTP envoye par KORYXA.",
  helperTitle = "Creez un acces fiable des le depart",
  helperBody = "Le compte est prepare avec votre mot de passe, puis active seulement apres validation OTP. Cela evite les inscriptions douteuses et confirme l'email utilise.",
  helperPoints = [
    "Confirmation du mot de passe avant envoi du code.",
    "Validation OTP avant creation definitive du compte.",
    "Session ouverte automatiquement apres verification.",
  ],
  formEyebrow = "Nouveau compte",
  formTitle = "Acces plateforme KORYXA",
  formDescription = "Remplissez vos informations, choisissez un mot de passe, puis confirmez l'inscription avec le code OTP.",
  verifyDescription = "Le code OTP valide l'adresse email et finalise la creation du compte.",
  googleLabel = "Continuer avec Google",
  loginHref = "/login",
  loginLabel = "Se connecter",
  initialError = null,
}: SignupClientProps = {}) {
  const { refresh, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const redirectTarget = resolveSafeAuthRedirectTarget(successRedirect, "/onboarding");

  const [step, setStep] = useState<SignupStep>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");
  const [accountType, setAccountType] = useState<"learner" | "company" | "organization">("learner");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [debugCode, setDebugCode] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      if (isAbsoluteRedirectTarget(redirectTarget)) {
        window.location.assign(redirectTarget);
        return;
      }
      router.replace(redirectTarget);
    }
  }, [authLoading, redirectTarget, router, user]);

  async function requestSignupOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    setDebugCode(null);

    if (password !== confirmPassword) {
      setError("Les deux mots de passe doivent etre identiques.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${CLIENT_INNOVA_API_BASE}/auth/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          country: country.trim(),
          account_type: accountType,
          intent: "register",
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = await response.json().catch(() => ({}));
      setStep("verify");
      setMessage("Un code OTP a ete envoye. Validez-le pour terminer l'inscription.");
      if (data?.debug_code) {
        setDebugCode(data.debug_code);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  }

  async function verifySignupOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`${CLIENT_INNOVA_API_BASE}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          code: otp,
          intent: "register",
        }),
      });

      const data = await response.json().catch(() => ({} as { detail?: unknown }));
      if (!response.ok) {
        const detail = typeof data?.detail === "string" ? data.detail : undefined;
        throw new Error(detail || "Impossible de valider l'inscription.");
      }

      setMessage("Compte cree. Bienvenue dans KORYXA.");
      await refresh();
      setTimeout(() => {
        if (isAbsoluteRedirectTarget(redirectTarget)) {
          window.location.assign(redirectTarget);
          return;
        }
        router.replace(redirectTarget);
      }, 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Inscription"
      title={heading}
      subtitle={subtitle}
      helperTitle={helperTitle}
      helperBody={helperBody}
      helperPoints={helperPoints}
      footerText="Vous avez deja un compte ?"
      footerHref={loginHref}
      footerLabel={loginLabel}
    >
      <div className="min-w-0 space-y-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">{formEyebrow}</div>
          <h2 className="mt-3 break-words text-2xl font-semibold text-slate-950 sm:text-3xl">{formTitle}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {step === "form" ? formDescription : verifyDescription}
          </p>
        </div>

        <div className="space-y-3">
          <GoogleAuthButton redirectTo={redirectTarget} label={googleLabel} />
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">ou</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
        </div>

        {step === "form" ? (
          <form onSubmit={requestSignupOtp} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="signup_first_name" className="mb-2 block text-sm font-medium text-slate-700">
                  Prenom
                </label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="signup_first_name"
                    type="text"
                    required
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    placeholder="Prenom"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="signup_last_name" className="mb-2 block text-sm font-medium text-slate-700">
                  Nom
                </label>
                <input
                  id="signup_last_name"
                  type="text"
                  required
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  placeholder="Nom"
                />
              </div>
            </div>

            <div>
              <label htmlFor="signup_email" className="mb-2 block text-sm font-medium text-slate-700">
                Adresse email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="signup_email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  placeholder="vous@entreprise.com"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="signup_country" className="mb-2 block text-sm font-medium text-slate-700">
                  Pays
                </label>
                <input
                  id="signup_country"
                  type="text"
                  required
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  placeholder="Togo"
                />
              </div>
              <div>
                <label htmlFor="signup_account_type" className="mb-2 block text-sm font-medium text-slate-700">
                  Type de compte
                </label>
                <select
                  id="signup_account_type"
                  value={accountType}
                  onChange={(event) => setAccountType(event.target.value as "learner" | "company" | "organization")}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                >
                  <option value="learner">Apprenant</option>
                  <option value="company">Entreprise</option>
                  <option value="organization">Organisation</option>
                </select>
              </div>
            </div>

            <PasswordField
              id="signup_password"
              label="Mot de passe"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              hint="8 caracteres minimum recommandes."
              placeholder="Creez un mot de passe"
            />

            <PasswordField
              id="signup_confirm_password"
              label="Confirmer le mot de passe"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Retapez le mot de passe"
            />

            {message ? (
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                {message}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{error}</div>
            ) : null}

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#0f172a_0%,#0284c7_58%,#38bdf8_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(2,132,199,0.24)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {loading ? "Preparation..." : "Envoyer le code OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifySignupOtp} className="space-y-5">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4 sm:rounded-[28px] sm:p-5">
              <div className="text-sm font-semibold text-slate-900">Validation de l'inscription</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Le compte sera active pour <span className="break-all font-medium text-slate-900">{email}</span> apres verification du code OTP.
              </p>
            </div>

            <div>
              <label htmlFor="signup_otp" className="mb-2 block text-sm font-medium text-slate-700">
                Code OTP
              </label>
              <input
                id="signup_otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={8}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center text-base font-semibold tracking-[0.18em] text-slate-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 sm:px-4 sm:text-lg sm:tracking-[0.35em]"
                placeholder="000000"
              />
              {debugCode ? <p className="mt-2 text-xs text-slate-500">Code debug : {debugCode}</p> : null}
            </div>

            {message ? (
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                {message}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{error}</div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                className="inline-flex flex-1 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0f172a_0%,#0284c7_58%,#38bdf8_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(2,132,199,0.24)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Activation..." : "Confirmer l'inscription"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("form");
                  setOtp("");
                  setDebugCode(null);
                  setMessage(null);
                  setError(null);
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
