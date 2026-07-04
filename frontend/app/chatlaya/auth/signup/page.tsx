import SignupClient from "@/app/signup/SignupClient";
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

export default async function ChatlayaSignupPage({ searchParams }: { searchParams?: SearchParamsInput }) {
  const params = await resolveSearchParams(searchParams);
  const requestedRedirect = one(params?.redirect);
  const authError = one(params?.auth_error);
  const redirect = resolveSafeAuthRedirectTarget(requestedRedirect, CHATLAYA_HOME);
  const loginHref = `/chatlaya/auth/login?redirect=${encodeURIComponent(redirect)}`;
  const initialError =
    authError === "google_access_refuse"
      ? "La connexion Google a ete annulee."
      : authError === "google_profil_invalide"
        ? "Le profil Google recu est incomplet ou non verifie."
        : authError
          ? "La creation du compte a echoue. Reessayez."
          : null;

  return (
    <SignupClient
      successRedirect={redirect}
      heading="Creer votre compte ChatLAYA Founder"
      subtitle="Ouvrez un compte pour cadrer votre projet, conserver l'historique et exporter votre dossier Founder."
      helperTitle="Un compte pour construire votre dossier"
      helperBody="L'identite est geree de facon securisee en arriere-plan, mais l'experience reste centree sur le produit autonome."
      helperPoints={[
        "Creation du compte puis validation OTP.",
        "Retour automatique vers ChatLAYA Founder apres inscription.",
        "Historique, cadrage et exports rattaches a votre espace.",
      ]}
      formEyebrow="ChatLAYA Founder"
      formTitle="Creer un acces Founder"
      formDescription="Renseignez vos informations, choisissez un mot de passe, puis confirmez avec le code OTP."
      verifyDescription="Le code OTP valide votre email et ouvre votre espace Founder."
      googleLabel="S'inscrire avec Google pour ChatLAYA"
      loginHref={loginHref}
      loginLabel="Se connecter a Founder"
      initialError={initialError}
    />
  );
}
