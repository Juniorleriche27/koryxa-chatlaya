import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://koryxa.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { url: "/", priority: 1.0, changeFrequency: "weekly" as const },
    { url: "/trajectoire", priority: 0.9, changeFrequency: "monthly" as const },
    { url: "/entreprise", priority: 0.9, changeFrequency: "monthly" as const },
    { url: "/services-ia", priority: 0.9, changeFrequency: "monthly" as const },
    { url: "/chatlaya", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/about", priority: 0.7, changeFrequency: "monthly" as const },
    { url: "/opportunites", priority: 0.7, changeFrequency: "weekly" as const },
  ];
  return routes.map(({ url, priority, changeFrequency }) => ({
    url: `${BASE_URL}${url}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
