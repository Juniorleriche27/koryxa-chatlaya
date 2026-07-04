export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

import LoginClient from "./LoginClient";
import { resolveSafeAuthRedirectTarget } from "@/lib/auth-redirect";

const KORYXA_PUBLIC_HOME = "/";

type SearchParams = Record<string, string | string[] | undefined>;
type SearchParamsInput = SearchParams | Promise<SearchParams>;

function one(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function resolveSearchParams(input?: SearchParamsInput): Promise<SearchParams | undefined> {
  if (!input) return undefined;
  if (typeof (input as Promise<SearchParams>).then === "function") {
    return await (input as Promise<SearchParams>);
  }
  return input as SearchParams;
}

export default async function LoginPage({ searchParams }: { searchParams?: SearchParamsInput }) {
  const params = await resolveSearchParams(searchParams);
  const requestedRedirect = one(params?.redirect);
  const authError = one(params?.auth_error);
  const successRedirect = resolveSafeAuthRedirectTarget(requestedRedirect, KORYXA_PUBLIC_HOME);
  const signupHref = `/signup?redirect=${encodeURIComponent(successRedirect)}`;
  const initialError =
    authError === "google_access_refuse"
      ? "La connexion Google a ete annulee."
      : authError === "google_profil_invalide"
        ? "Le profil Google recu est incomplet ou non verifie."
        : authError
          ? "La connexion Google a echoue. Reessayez."
          : null;
  return (
    <LoginClient
      defaultRedirect={KORYXA_PUBLIC_HOME}
      requestedRedirect={requestedRedirect}
      signupHref={signupHref}
      initialError={initialError}
    />
  );
}
