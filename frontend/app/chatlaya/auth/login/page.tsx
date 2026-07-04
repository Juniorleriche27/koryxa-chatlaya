import LoginClient from "@/app/login/LoginClient";
import { resolveSafeAuthRedirectTarget } from "@/lib/auth-redirect";

const CHATLAYA_HOME = "https://chatlaya.innovaplus.africa/";

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

export default async function ChatlayaLoginPage({ searchParams }: { searchParams?: SearchParamsInput }) {
  const params = await resolveSearchParams(searchParams);
  const requestedRedirect = one(params?.redirect);
  const authError = one(params?.auth_error);
  const redirect = resolveSafeAuthRedirectTarget(requestedRedirect, CHATLAYA_HOME);
  const signupHref = `/chatlaya/auth/signup?redirect=${encodeURIComponent(redirect)}`;
  const initialError =
    authError === "google_access_refuse"
      ? "La connexion Google a ete annulee."
      : authError === "google_profil_invalide"
        ? "Le profil Google recu est incomplet ou non verifie."
        : authError
          ? "La connexion a echoue. Reessayez."
          : null;

  return (
    <LoginClient
      defaultRedirect={CHATLAYA_HOME}
      requestedRedirect={redirect}
      heading="Connexion ChatLAYA Founder"
      subtitle="Connectez-vous pour retrouver vos cadrages, vos historiques et vos dossiers projet sur ChatLAYA Founder."
      helperTitle="Votre espace Founder reste separe"
      helperBody="L'identite est securisee en arriere-plan, mais votre parcours revient directement dans ChatLAYA Founder apres validation."
      helperPoints={[
        "Vous arrivez depuis ChatLAYA et vous repartez vers ChatLAYA.",
        "Vos conversations Founder restent rattachees a votre compte.",
        "Le code OTP protege l'acces sans exposer votre espace.",
      ]}
      formEyebrow="ChatLAYA Founder"
      formTitle="Connexion Founder"
      credentialsDescription="Entrez vos identifiants, puis confirmez avec le code OTP envoye par email."
      verifyDescription="Le code OTP ouvre votre espace ChatLAYA Founder."
      googleLabel="Continuer avec Google pour ChatLAYA"
      supportHref={null}
      supportLabel="Mot de passe oublie"
      signupHref={signupHref}
      signupLabel="Creer un compte Founder"
      initialError={initialError}
    />
  );
}
