# KORYXA Frontend Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refonte complete du frontend KORYXA — dark premium cyan/indigo, animations Framer Motion + Canvas, SEO B2B+B2C sur toutes les pages.

**Architecture:** Incrementale — fondations (tokens, composants, SEO infra) puis chaque page dans l'ordre. Chaque tache est autonome et committable.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, Framer Motion, Canvas API, Vitest

---

## File Map

**Creer:**
- `apps/koryxa/frontend/components/ui/ScrollReveal.tsx`
- `apps/koryxa/frontend/components/ui/GlowCard.tsx`
- `apps/koryxa/frontend/components/ui/CountUp.tsx`
- `apps/koryxa/frontend/components/ui/AnimatedBeam.tsx`
- `apps/koryxa/frontend/components/ui/AnimatedTicker.tsx`
- `apps/koryxa/frontend/components/seo/JsonLd.tsx`
- `apps/koryxa/frontend/app/sitemap.ts`
- `apps/koryxa/frontend/app/robots.ts`
- Tests unitaires pour ScrollReveal et CountUp

**Modifier:**
- `styles/globals.css`, `app/globals.css` — dark tokens
- `components/layout/PublicHeader.tsx`, `components/layout/footer.tsx`
- `app/page.tsx` + toutes les pages publiques
- `package.json` — framer-motion

---

## Task 1: Installer Framer Motion

**Files:** `apps/koryxa/frontend/package.json`

- [ ] **Step 1: Installer**
```bash
cd apps/koryxa/frontend && npm install framer-motion
```
Expected: `added X packages`, pas d'erreur.

- [ ] **Step 2: Verifier**
```bash
node -e "require('framer-motion'); console.log('ok')"
```
Expected: `ok`

- [ ] **Step 3: Commit**
```bash
git add apps/koryxa/frontend/package.json apps/koryxa/frontend/package-lock.json
git commit -m "chore(frontend): add framer-motion"
```

---

## Task 2: Design tokens dark premium

**Files:** `apps/koryxa/frontend/styles/globals.css`, `apps/koryxa/frontend/app/globals.css`

- [ ] **Step 1: Remplacer `:root` et `html.dark` dans `styles/globals.css`**
```css
:root {
  --bg: #020617;
  --surface: rgba(9, 19, 38, 0.82);
  --surface-emphasis: rgba(9, 19, 38, 0.94);
  --border: rgba(71, 85, 105, 0.3);
  --border-strong: rgba(56, 189, 248, 0.35);
  --text: #e2e8f0;
  --muted: #94a3b8;
  --accent: #0ea5e9;
  --accent-soft: #38bdf8;
  --accent-indigo: #6366f1;
  --accent-bg: rgba(14, 165, 233, 0.1);
  --success: #22c55e;
  --warning: #facc15;
  --danger: #ef4444;
  --shadow-soft: 0 24px 64px rgba(2, 6, 23, 0.34);
  --kx-glow: rgba(14, 165, 233, 0.2);
  --sidebar-w: 0px;
  --container-max: 1120px;
  font-family: var(--font-sans), "Inter", "Segoe UI", sans-serif;
  color: var(--text);
  background: var(--bg);
}
html.dark {
  --bg: #020617;
  --surface: rgba(9, 19, 38, 0.82);
  --surface-emphasis: rgba(9, 19, 38, 0.94);
  --border: rgba(71, 85, 105, 0.3);
  --border-strong: rgba(56, 189, 248, 0.35);
  --text: #e2e8f0;
  --muted: #94a3b8;
  --accent: #0ea5e9;
  --accent-soft: #38bdf8;
  --accent-indigo: #6366f1;
  --shadow-soft: 0 24px 64px rgba(2, 6, 23, 0.34);
  --kx-glow: rgba(14, 165, 233, 0.2);
}
```

- [ ] **Step 2: Remplacer `html, body` dans `styles/globals.css`**
```css
html, body { height: 100%; margin: 0; background: #020617; color: var(--text); }
html.dark body { background: #020617; }
```

- [ ] **Step 3: Remplacer `.btn-primary` dans `styles/globals.css`**
```css
.btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 14px 28px; border-radius: 8px;
  background: linear-gradient(90deg, #0ea5e9, #6366f1);
  color: #fff; font-weight: 700; letter-spacing: -0.02em; border: none;
  box-shadow: 0 0 32px rgba(14, 165, 233, 0.25);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  text-decoration: none; cursor: pointer;
}
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 0 48px rgba(14, 165, 233, 0.38); }
```

- [ ] **Step 4: Remplacer `.btn-secondary` dans `styles/globals.css`**
```css
.btn-secondary {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 14px 28px; border-radius: 8px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(148,163,184,0.2);
  color: #94a3b8; font-weight: 600; letter-spacing: -0.02em;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
  text-decoration: none; cursor: pointer;
}
.btn-secondary:hover { background: rgba(255,255,255,0.08); color: #e2e8f0; border-color: rgba(56,189,248,0.35); }
```

- [ ] **Step 5: Ajouter classes utilitaires a la fin de `styles/globals.css`**
```css
.kx-grid-bg {
  background-image:
    linear-gradient(rgba(148,163,184,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148,163,184,0.04) 1px, transparent 1px);
  background-size: 48px 48px;
}
.kx-glow-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(148,163,184,0.12); border-radius: 16px;
  transition: border-color 0.3s, background 0.3s, box-shadow 0.3s;
}
.kx-glow-card:hover {
  border-color: rgba(14,165,233,0.4); background: rgba(14,165,233,0.04);
  box-shadow: 0 0 32px rgba(14,165,233,0.08);
}
.kx-section-label {
  font-size: 11px; font-weight: 700; letter-spacing: 0.2em;
  text-transform: uppercase; color: #0ea5e9; margin-bottom: 12px;
}
```

- [ ] **Step 6: Dans `app/globals.css` — passer en dark par defaut**

Remplacer `--background: #f8fafc; --foreground: #0f172a;` par `--background: #020617; --foreground: #e2e8f0;`

Ajouter si absent dans `app/globals.css`:
```css
@keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
.kx-ticker-track { animation: ticker 28s linear infinite; }
```

- [ ] **Step 7: Commit**
```bash
git add apps/koryxa/frontend/styles/globals.css apps/koryxa/frontend/app/globals.css
git commit -m "feat(frontend): dark premium design tokens"
```
TEST_APPEND

---

## Task 3: Composants UI

**Files:** components/ui/{ScrollReveal,CountUp,GlowCard,AnimatedBeam,AnimatedTicker}.tsx + tests

- [ ] **Step 1: Test ScrollReveal** — components/ui/__tests__/ScrollReveal.test.tsx

Run:  → FAIL expected

- [ ] **Step 2: Créer ** ("use client", framer-motion useInView)



- [ ] **Step 3:**  → PASS

- [ ] **Step 4: Test CountUp** — components/ui/__tests__/CountUp.test.tsx

Run:  → FAIL expected

- [ ] **Step 5: Créer **



- [ ] **Step 6:**  → PASS

- [ ] **Step 7: Créer **



- [ ] **Step 8: Créer **



- [ ] **Step 9: Créer **



- [ ] **Step 10: Commit**


---

## Task 3: Composants UI

**Files:** components/ui/{ScrollReveal,CountUp,GlowCard,AnimatedBeam,AnimatedTicker}.tsx + tests

- [ ] **Step 1: Test ScrollReveal** — `components/ui/__tests__/ScrollReveal.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ScrollReveal from "../ScrollReveal";
describe("ScrollReveal", () => {
  it("renders", () => { render(<ScrollReveal><span>hi</span></ScrollReveal>); expect(screen.getByText("hi")).toBeTruthy(); });
});
```

- [ ] **Step 2:** `npm test -- ScrollReveal` -> FAIL expected

- [ ] **Step 3: Creer `components/ui/ScrollReveal.tsx`**

```tsx
"use client";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
type Props = { children: React.ReactNode; delay?: number; className?: string; direction?: "up"|"down"|"left"|"right" };
export default function ScrollReveal({ children, delay = 0, className, direction = "up" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const initial = { opacity: 0, y: direction==="up"?24:direction==="down"?-24:0, x: direction==="left"?24:direction==="right"?-24:0 };
  return (
    <motion.div ref={ref} initial={initial} animate={inView?{opacity:1,y:0,x:0}:initial} transition={{duration:0.6,delay,ease:[0.22,1,0.36,1]}} className={className}>
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 4:** `npm test -- ScrollReveal` -> PASS

- [ ] **Step 5: Creer `components/ui/CountUp.tsx`** (test d'abord: `npm test -- CountUp` -> FAIL)

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
type Props = { end: number; duration?: number; prefix?: string; suffix?: string; className?: string };
export default function CountUp({ end, duration = 1.8, prefix = "", suffix = "", className }: Props) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    const s = performance.now();
    const tick = (n: number) => { const p = Math.min((n-s)/(duration*1000),1); setValue(Math.floor(p*end)); if(p<1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }, [inView, end, duration]);
  return <span ref={ref} className={className}>{prefix}{value}{suffix}</span>;
}
```

- [ ] **Step 6:** `npm test -- CountUp` -> PASS

- [ ] **Step 7: Creer `components/ui/GlowCard.tsx`**

```tsx
import clsx from "clsx";
type Props = { children: React.ReactNode; className?: string; as?: "div"|"article"|"section" };
export default function GlowCard({ children, className, as: Tag = "div" }: Props) {
  return <Tag className={clsx("kx-glow-card p-6", className)}>{children}</Tag>;
}
```

- [ ] **Step 8: Creer `components/ui/AnimatedBeam.tsx`**

```tsx
"use client";
import { useEffect, useRef } from "react";
export default function AnimatedBeam() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    let id: number, t = 0;
    const resize = () => { c.width = c.offsetWidth; c.height = c.offsetHeight; };
    resize(); window.addEventListener("resize", resize);
    const draw = () => {
      ctx.clearRect(0,0,c.width,c.height); t += 0.008;
      const cx = c.width/2 + Math.sin(t*0.7)*40;
      const g = ctx.createLinearGradient(cx,0,cx,c.height*0.7);
      g.addColorStop(0,"rgba(56,189,248,0.9)"); g.addColorStop(0.5,"rgba(56,189,248,0.3)"); g.addColorStop(1,"rgba(56,189,248,0)");
      ctx.save(); ctx.filter="blur(1.5px)"; ctx.strokeStyle=g; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(cx,0); ctx.lineTo(cx+Math.sin(t)*12,c.height*0.7); ctx.stroke(); ctx.restore();
      id = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(id); window.removeEventListener("resize",resize); };
  }, []);
  return <canvas ref={ref} aria-hidden style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none"}} />;
}
```

- [ ] **Step 9: Creer `components/ui/AnimatedTicker.tsx`**

```tsx
type Props = { items: readonly string[]; className?: string };
export default function AnimatedTicker({ items, className }: Props) {
  const d = [...items,...items];
  return (
    <div className={"overflow-hidden " + (className??"")}>
      <div className="kx-ticker-track flex whitespace-nowrap gap-10">
        {d.map((item,i)=>(
          <span key={item+i} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500"/>{item}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Commit**

```bash
git add apps/koryxa/frontend/components/ui/
git commit -m "feat(ui): ScrollReveal, CountUp, GlowCard, AnimatedBeam, AnimatedTicker"
```

---

## Task 4: SEO infra

**Files:** components/seo/JsonLd.tsx, app/sitemap.ts, app/robots.ts

- [ ] **Step 1:** `mkdir -p apps/koryxa/frontend/components/seo`

- [ ] **Step 2: Creer `components/seo/JsonLd.tsx`**

```tsx
type Props = { data: Record<string, unknown> };
export default function JsonLd({ data }: Props) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
```

- [ ] **Step 3: Creer `app/sitemap.ts`**

```ts
import type { MetadataRoute } from "next";
const B = process.env.NEXT_PUBLIC_SITE_URL ?? "https://koryxa.com";
export default function sitemap(): MetadataRoute.Sitemap {
  const n = new Date();
  return [
    {url:B,lastModified:n,priority:1.0,changeFrequency:"weekly"},
    {url:B+"/about",lastModified:n,priority:0.8},
    {url:B+"/services-ia",lastModified:n,priority:0.9},
    {url:B+"/services-ia/decouvrir",lastModified:n,priority:0.7},
    {url:B+"/entreprise",lastModified:n,priority:0.9},
    {url:B+"/entreprise/demarrer",lastModified:n,priority:0.8},
    {url:B+"/chatlaya",lastModified:n,priority:0.8},
    {url:B+"/trajectoire",lastModified:n,priority:0.8},
    {url:B+"/opportunities",lastModified:n,priority:0.6},
    {url:B+"/login",lastModified:n,priority:0.4},
    {url:B+"/signup",lastModified:n,priority:0.5},
  ];
}
```

- [ ] **Step 4: Creer `app/robots.ts`**

```ts
import type { MetadataRoute } from "next";
const B = process.env.NEXT_PUBLIC_SITE_URL ?? "https://koryxa.com";
export default function robots(): MetadataRoute.Robots {
  return { rules:{userAgent:"*",allow:"/",disallow:["/me/","/account/","/onboarding"]}, sitemap:B+"/sitemap.xml" };
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/koryxa/frontend/components/seo/ apps/koryxa/frontend/app/sitemap.ts apps/koryxa/frontend/app/robots.ts
git commit -m "feat(seo): JsonLd, sitemap, robots"
```

---

## Task 5: Header + Footer dark

**Files:** components/layout/PublicHeader.tsx, components/layout/footer.tsx

- [ ] **Step 1: Header — balise racine**

```tsx
<header className="sticky top-0 z-50 w-full border-b border-white/8 bg-slate-950/80 backdrop-blur-xl">
```

- [ ] **Step 2: Header — liens nav**

```tsx
className={clsx("text-sm font-medium transition-colors", isActive(pathname,link.href)?"text-sky-400":"text-slate-400 hover:text-slate-100")}
```

- [ ] **Step 3: Header — bouton CTA**

```tsx
className="rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
```

- [ ] **Step 4: Footer — remplacer l'implementation**

```tsx
import Link from "next/link";
export default function Footer() {
  const links = [
    {href:"/about",label:"A propos"},{href:"/services-ia",label:"Services IA"},
    {href:"/entreprise",label:"Entreprise"},{href:"/chatlaya",label:"ChatLAYA"},
    {href:"/contact",label:"Contact"},{href:"/legal/mentions",label:"Mentions legales"},
    {href:"/legal/confidentialite",label:"Confidentialite"},
  ];
  return (
    <footer className="border-t border-white/8 bg-slate-950 px-6 py-10">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-6 sm:flex-row">
        <span className="text-sm font-bold tracking-[0.2em] uppercase text-sky-400">KORYXA</span>
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          {links.map(l=><Link key={l.href} href={l.href} className="text-xs text-slate-500 hover:text-slate-300">{l.label}</Link>)}
        </nav>
        <p className="text-xs text-slate-600">2025 KORYXA</p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 5:** `npm run dev` -> verifier http://localhost:3000 header dark glassmorphism

- [ ] **Step 6: Commit**

```bash
git add apps/koryxa/frontend/components/layout/
git commit -m "feat(layout): dark header + footer"
```

---

## Task 6: Homepage — dark premium

**Files:** app/page.tsx

- [ ] **Step 1: Remplacer `app/page.tsx` complet**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, BriefcaseBusiness, Compass, ChartNoAxesCombined, Sparkles, Zap } from "lucide-react";
import ScrollReveal from "@/components/ui/ScrollReveal";
import CountUp from "@/components/ui/CountUp";
import GlowCard from "@/components/ui/GlowCard";
import AnimatedBeam from "@/components/ui/AnimatedBeam";
import AnimatedTicker from "@/components/ui/AnimatedTicker";
import JsonLd from "@/components/seo/JsonLd";
import LoopTypewriter from "@/components/marketing/LoopTypewriter";

export const metadata: Metadata = {
  title: "KORYXA | Plateforme IA en Afrique",
  description: "Premiere plateforme d'orchestration IA en Afrique : Blueprint, Entreprise, Service IA, ChatLAYA. Cadrage, build et delivery en 72h.",
  openGraph: { title: "KORYXA | L'IA qui transforme vos besoins en execution", url: "https://koryxa.com", siteName: "KORYXA", type: "website" },
  twitter: { card: "summary_large_image", title: "KORYXA | Plateforme IA Afrique" },
  alternates: { canonical: "https://koryxa.com" },
};

const ORG_JSONLD = { "@context":"https://schema.org","@type":"Organization",name:"KORYXA",url:"https://koryxa.com",description:"Premiere plateforme IA en Afrique" };
const TICKER = ["Python","Pandas","NumPy","SQL","LLM","Automation","Forecasting","Data Viz","APIs","MLOps"] as const;
const KPIS = [{label:"Modules connectes",end:5,suffix:""},{label:"Offres Service IA",end:10,suffix:"+"},{label:"Qualification",end:72,suffix:"h"},{label:"Africain",end:100,suffix:"%"}] as const;
const MODULES = [
  {icon:Compass,title:"Blueprint",description:"Profilage talent, trajectoire claire, plan d'action concret.",href:"/trajectoire",cta:"Lancer Blueprint"},
  {icon:BriefcaseBusiness,title:"Entreprise",description:"Cadrage intelligent des besoins avant toute execution.",href:"/entreprise",cta:"Cadrer un besoin"},
  {icon:Bot,title:"Service IA",description:"Execution : agents IA, modeles, apps, plateformes.",href:"/services-ia",cta:"Demander un service"},
  {icon:ChartNoAxesCombined,title:"Opportunites",description:"Pipeline de missions et activation commerciale.",href:"/opportunities",cta:"Voir les opportunites"},
  {icon:Sparkles,title:"ChatLAYA",description:"Assistant pour lancer, structurer et vendre un projet.",href:"/chatlaya",cta:"Ouvrir ChatLAYA"},
] as const;

export default function HomePage() {
  return (
    <main>
      <JsonLd data={ORG_JSONLD} />
      <section className="relative min-h-[92vh] overflow-hidden bg-[#020617] flex flex-col items-center justify-center text-center px-4 py-24">
        <div aria-hidden className="kx-grid-bg absolute inset-0" />
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(14,165,233,0.18)_0%,transparent_60%)]" />
        <AnimatedBeam />
        <div className="relative z-10 mx-auto w-full max-w-5xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-500/10 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-sky-300 mb-8">
            <span className="inline-block h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
            Premiere plateforme IA en Afrique
          </div>
          <h1 className="text-[clamp(2.4rem,7vw,5rem)] font-black leading-[0.95] tracking-[-0.06em] text-white mb-6">
            L&apos;IA qui transforme<br />
            <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">vos besoins en execution</span>
          </h1>
          <p className="mx-auto max-w-xl text-base leading-7 text-slate-400 mb-4">De l&apos;idee au delivery reel : Blueprint, Entreprise, Service IA et ChatLAYA.</p>
          <p className="text-sm font-semibold text-sky-300 mb-10">
            Nous construisons avec <LoopTypewriter words={["Data Analysts","Data Scientists","AI Builders","Data Engineers"]} className="text-white" />
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/services-ia" className="btn-primary">Demander un service IA <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/entreprise/demarrer" className="btn-secondary">Cadrer un besoin entreprise</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            {KPIS.map(k=>(
              <div key={k.label}>
                <p className="text-3xl font-black text-sky-400"><CountUp end={k.end} suffix={k.suffix} /></p>
                <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">{k.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="border-y border-sky-500/10 bg-sky-500/5 py-3">
        <AnimatedTicker items={TICKER} />
      </div>

      <section className="bg-[#020617] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1200px]">
          <ScrollReveal>
            <p className="kx-section-label">Modules</p>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-black tracking-[-0.05em] text-white mb-12">Tout ce dont vous avez besoin, connecte.</h2>
          </ScrollReveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {MODULES.map((item,i)=>{
              const Icon = item.icon;
              return (
                <ScrollReveal key={item.title} delay={i*0.08}>
                  <GlowCard as="article" className="flex flex-col h-full">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-500/10 text-sky-300 mb-4">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-sm leading-6 text-slate-400 flex-1">{item.description}</p>
                    <Link href={item.href} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-sky-400 hover:text-sky-300">
                      {item.cta} <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </GlowCard>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#020617] px-4 py-24 text-center">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(14,165,233,0.1)_0%,transparent_70%)]" />
        <div className="relative z-10 mx-auto max-w-2xl">
          <ScrollReveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-300 mb-6">
              <Zap className="h-4 w-4" /> Start now
            </div>
            <h2 className="text-[clamp(1.8rem,4vw,3.2rem)] font-black tracking-[-0.05em] text-white mb-4">
              Vous avez un besoin data ou IA ?<br />On le transforme en execution.
            </h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              <Link href="/services-ia" className="btn-primary">Ouvrir Service IA <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/chatlaya" className="btn-secondary">Discuter avec ChatLAYA</Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2:** `npm run dev` -> verifier http://localhost:3000 (beam, KPIs, ticker, glow cards, CTA)

- [ ] **Step 3: Commit**

```bash
git add apps/koryxa/frontend/app/page.tsx
git commit -m "feat(homepage): dark premium + Framer Motion + animations"
```

---

## Task 7: Pages publiques — dark + SEO (pattern répété)

**Regles applicables a chaque page ci-dessous:**
- Remplacer `bg-white`, `bg-slate-50`, `bg-gray-*` → `bg-[#020617]` ou `bg-slate-950`
- Remplacer `text-slate-900`, `text-gray-900` → `text-white`
- Remplacer `text-slate-600`, `text-gray-600` → `text-slate-400`
- Remplacer `border-slate-200` → `border-slate-800`
- Enrober les sections dans `<ScrollReveal>`
- Enrober les cards dans `<GlowCard>`
- Inputs auth: `bg-slate-900 border-slate-700 text-white placeholder:text-slate-500`

### 7a: About

- [ ] **Step 1:** Mettre a jour metadata
```tsx
export const metadata: Metadata = {
  title: "A propos — KORYXA | Orchestration IA en Afrique",
  description: "KORYXA : premiere plateforme d'orchestration IA en Afrique. Mission, vision, equipe.",
  openGraph: { title: "A propos de KORYXA", url: "https://koryxa.com/about" },
  alternates: { canonical: "https://koryxa.com/about" },
};
```
- [ ] **Step 2:** Appliquer regles dark + ScrollReveal
- [ ] **Step 3:** `git add apps/koryxa/frontend/app/about/ && git commit -m "feat(about): dark + SEO"`

### 7b: Services IA

- [ ] **Step 1:** Metadata + JSON-LD Service
```tsx
export const metadata: Metadata = {
  title: "Services IA — KORYXA | Data, Automation, LLM en Afrique",
  description: "10 services IA cles-en-main : agents LLM, automatisation, data engineering, MLOps.",
  openGraph: { title: "Services IA KORYXA", url: "https://koryxa.com/services-ia" },
  alternates: { canonical: "https://koryxa.com/services-ia" },
};
const SERVICE_JSONLD = { "@context":"https://schema.org","@type":"Service",name:"Services IA KORYXA",provider:{"@type":"Organization",name:"KORYXA"},areaServed:"Africa" };
// Dans le JSX: <JsonLd data={SERVICE_JSONLD} />
```
- [ ] **Step 2:** Appliquer regles dark + GlowCard sur les cards service + ScrollReveal
- [ ] **Step 3:** Meme traitement sur `services-ia/decouvrir/page.tsx` (metadata: title "Decouvrir les Services IA — KORYXA")
- [ ] **Step 4:** `git add apps/koryxa/frontend/app/services-ia/ && git commit -m "feat(services-ia): dark + SEO + JSON-LD"`

### 7c: Entreprise

- [ ] **Step 1:** Metadata
```tsx
export const metadata: Metadata = {
  title: "Entreprise — KORYXA | Cadrage IA pour entreprises africaines",
  description: "Cadrage intelligent, qualification en 72h, plan d'execution concret.",
  openGraph: { title: "KORYXA Entreprise", url: "https://koryxa.com/entreprise" },
  alternates: { canonical: "https://koryxa.com/entreprise" },
};
```
- [ ] **Step 2:** Dark + ScrollReveal sur entreprise/page.tsx, demarrer/page.tsx, resultat/[need_id]/page.tsx, cockpit/page.tsx
- [ ] **Step 3:** `git add apps/koryxa/frontend/app/entreprise/ && git commit -m "feat(entreprise): dark + SEO"`

### 7d: ChatLAYA

- [ ] **Step 1:** Metadata
```tsx
export const metadata: Metadata = {
  title: "ChatLAYA — Assistant IA KORYXA",
  description: "Assistant IA pour lancer, structurer et vendre vos projets data. Disponible en Afrique.",
  alternates: { canonical: "https://koryxa.com/chatlaya" },
};
```
- [ ] **Step 2:** Dark design — bulles IA: `bg-slate-900`, bulles user: `bg-sky-500/10`, input: `bg-slate-800 border-slate-700`
- [ ] **Step 3:** `git add apps/koryxa/frontend/app/chatlaya/ && git commit -m "feat(chatlaya): dark + SEO"`

### 7e: Trajectoire

- [ ] **Step 1:** Metadata
```tsx
export const metadata: Metadata = {
  title: "Blueprint / Trajectoire — KORYXA | Plan de carriere IA",
  description: "Planifiez votre montee en competences IA. Profilage talent, trajectoire personnalisee.",
  alternates: { canonical: "https://koryxa.com/trajectoire" },
};
```
- [ ] **Step 2:** Dark + ScrollReveal
- [ ] **Step 3:** `git add apps/koryxa/frontend/app/trajectoire/ && git commit -m "feat(trajectoire): dark + SEO"`

### 7f: Auth (Login / Signup / Recover)

- [ ] **Step 1:** Metadata login (`robots: { index: false }`)
- [ ] **Step 2:** Entourer chaque formulaire de:
```tsx
<div className="relative min-h-screen flex items-center justify-center bg-[#020617] px-4">
  <div aria-hidden className="kx-grid-bg absolute inset-0 opacity-50" />
  <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(14,165,233,0.12)_0%,transparent_60%)]" />
  <div className="relative z-10 w-full max-w-md">
    {/* formulaire existant */}
  </div>
</div>
```
Inputs: `bg-slate-900 border-slate-700 text-white placeholder:text-slate-500`, submit: `btn-primary`
- [ ] **Step 3:** `git add apps/koryxa/frontend/app/login/ apps/koryxa/frontend/app/signup/ apps/koryxa/frontend/app/account/recover/ && git commit -m "feat(auth): dark premium"`

### 7g: Remaining (Opportunities, Onboarding, Legales)

- [ ] **Step 1:** Dark sur opportunities/page.tsx (metadata: title "Opportunites — KORYXA | Missions IA en Afrique")
- [ ] **Step 2:** Dark sur onboarding/page.tsx (garder logique wizard)
- [ ] **Step 3:** Legal pages — ajouter `prose prose-invert` sur le container de contenu, fond `bg-[#020617]`
- [ ] **Step 4:** `git add apps/koryxa/frontend/app/opportunities/ apps/koryxa/frontend/app/onboarding/ apps/koryxa/frontend/app/legal/ apps/koryxa/frontend/app/terms/ apps/koryxa/frontend/app/privacy/ && git commit -m "feat(pages): dark remaining pages"`

---

## Task 8: Build final + validation

- [ ] **Step 1: Build**
```bash
cd apps/koryxa/frontend && npm run build
```
Expected: BUILD SUCCESS sans erreur TypeScript. Si erreurs: corriger avant de continuer.

- [ ] **Step 2: Tests**
```bash
npm test
```
Expected: tous PASS.

- [ ] **Step 3: Verifier en local**
```bash
npm start
```
Verifier:
- http://localhost:3000 — homepage dark, beam anime, KPIs CountUp, ticker
- http://localhost:3000/sitemap.xml — XML valide
- http://localhost:3000/robots.txt — robots.txt valide
- Navigation fluide entre toutes les pages

- [ ] **Step 4: Commit final**
```bash
git add -A
git commit -m "feat(frontend): complete dark premium redesign + SEO"
```

---

## Self-Review

- Dark premium cyan/indigo: Tasks 2, 5, 6, 7
- Framer Motion ScrollReveal: Task 3, utilise Tasks 6-7
- Canvas AnimatedBeam: Task 3, utilise Task 6
- CountUp anime: Task 3, utilise Task 6
- SEO metadata toutes pages: Tasks 7a-7g
- JSON-LD: Task 4, utilise Tasks 6, 7b
- Sitemap + robots: Task 4
- Header glassmorphism: Task 5
- Footer dark: Task 5
- Toutes les pages: Tasks 6-7
- Tests: ScrollReveal PASS, CountUp PASS
- Build final: Task 8
