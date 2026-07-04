# KORYXA Frontend Redesign — Design Spec
**Date:** 2026-04-24

## Objectif
Refonte complète du frontend KORYXA : design ultra-pro, animations spectaculaires, SEO B2B + B2C.

## Direction visuelle
- **Style :** Dark premium (A) — vibe Stripe / Linear / Vercel
- **Palette :** Background #020617, texte #e2e8f0, accent cyan #38bdf8, accent indigo #6366f1
- **Typographie :** Inter/Segoe UI, poids 900 pour les titres, tracking serré
- **Effets :** Beam de lumière, grille de fond, radial gradients, glassmorphism panels

## Animations
- **Niveau :** Spectaculaire (C) — WebGL/Canvas, parallax profond, reveal cinématique
- **Stack :** Framer Motion (scroll-driven, stagger, variants) + Canvas pour particules/beam
- **Patterns :**
  - Hero : beam animé, particules flottantes, compteurs animés au scroll
  - Scroll : fade-in stagger sur les cards et sections
  - Hover : glow border, scale subtil, background shimmer
  - Page transition : fade/slide avec Framer Motion AnimatePresence
  - Typewriter : texte animé sur le hero (déjà existant via LoopTypewriter)

## SEO — B2B + B2C
- **Cibles :** Entreprises africaines (IA, automation) + Talents tech en Afrique
- **Mots-clés principaux :** "plateforme IA Afrique", "orchestration IA", "services IA entreprise", "automatisation Afrique", "ChatLAYA", "Blueprint IA"
- **Techniques :**
  - Metadata Next.js (title, description, openGraph, twitter) sur chaque page
  - JSON-LD (Organization, WebSite, Service, FAQPage) sur homepage et pages services
  - Sitemap.xml dynamique (next-sitemap ou app/sitemap.ts)
  - robots.txt optimisé
  - Semantic HTML : h1 unique par page, hiérarchie h2/h3, aria-labels
  - Core Web Vitals : images optimisées (next/image), lazy loading, fonts preload
  - Canonical URLs sur toutes les pages

## Pages à refaire (toutes)
1. **Homepage** (page.tsx) — priorité 1
2. **About** — priorité 2
3. **Services IA** (page + slug + decouvrir) — priorité 3
4. **Entreprise** (page + demarrer + resultat + cockpit) — priorité 4
5. **ChatLAYA** — priorité 5
6. **Trajectoire** — priorité 6
7. **Login / Signup / Recover** — priorité 7
8. **Onboarding / Account** — priorité 8
9. **Opportunities** — priorité 9
10. **Pages légales** (mentions, confidentialité, terms, privacy) — priorité 10

## Structure de composants partagés (à créer)
- components/ui/AnimatedBeam.tsx — beam lumineux canvas
- components/ui/ParticleField.tsx — particules WebGL légères
- components/ui/ScrollReveal.tsx — wrapper Framer Motion scroll-driven
- components/ui/GlowCard.tsx — card avec border glow au hover
- components/ui/CountUp.tsx — compteur animé
- components/layout/NavBar.tsx — nav sticky glassmorphism (refacto)
- components/layout/Footer.tsx — footer dark unifié (refacto)
- components/seo/JsonLd.tsx — injection JSON-LD générique

## Design tokens (globals.css)
- Ajouter variables CSS : --kx-cyan, --kx-indigo, --kx-beam-color, --kx-glow
- Dark mode par défaut, light mode optionnel

## Contraintes techniques
- Next.js App Router (existant)
- Tailwind CSS (existant)
- Framer Motion (à installer si absent)
- Pas de Three.js lourd — canvas natif pour particules légères
- Performance : LCP < 2.5s, CLS < 0.1
