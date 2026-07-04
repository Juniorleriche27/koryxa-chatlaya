export type EnterpriseServiceCta = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
};

export type EnterpriseServiceIcon = "cadrage" | "setup" | "cockpit" | "sales";

export type EnterpriseServiceTone = "default" | "accent";

export type EnterpriseService = {
  key: string;
  name: string;
  summary: string;
  detail: string;
  icon: EnterpriseServiceIcon;
  tone?: EnterpriseServiceTone;
  ctas: EnterpriseServiceCta[];
};

export const enterpriseServices: EnterpriseService[] = [
  {
    key: "need-cadrage",
    name: "Cadrage du besoin",
    summary: "Clarifier un besoin entreprise, qualifier la demande et orienter vers la bonne suite d'execution.",
    detail: "",
    icon: "cadrage",
    ctas: [
      { href: "/entreprise/cadrage", label: "Cadrer un besoin", variant: "primary" },
      { href: "/entreprise/cadrage", label: "Voir le service", variant: "secondary" },
    ],
  },
  {
    key: "setup-enterprise",
    name: "Setup Entreprise",
    summary: "Activer l'organisation, preparer les workspaces, structurer les equipes, les acces et la configuration initiale.",
    detail: "",
    icon: "setup",
    tone: "accent",
    ctas: [
      { href: "/entreprise/setup", label: "Ouvrir le setup", variant: "primary" },
      { href: "/entreprise/setup", label: "Configurer l'organisation", variant: "secondary" },
    ],
  },
  {
    key: "cockpit-enterprise",
    name: "Cockpit Entreprise",
    summary: "Piloter l'activite, suivre les espaces, l'execution et les operations quotidiennes depuis un poste de controle central.",
    detail: "",
    icon: "cockpit",
    ctas: [
      { href: "/entreprise/cockpit", label: "Ouvrir le cockpit", variant: "primary" },
    ],
  },
  {
    key: "sales",
    name: "Ventes",
    summary: "Piloter le pipeline commercial, les deals et les indicateurs de performance lies au revenu.",
    detail: "",
    icon: "sales",
    ctas: [
      { href: "/entreprise/ventes", label: "Ouvrir les ventes", variant: "primary" },
    ],
  },
];

export function getEnterpriseService(key: string) {
  return enterpriseServices.find((service) => service.key === key);
}
