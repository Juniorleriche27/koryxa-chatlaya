"use client";

import { FormEvent, KeyboardEvent, WheelEvent as ReactWheelEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUp, Check, Copy, Lock, MapPin, MessageSquarePlus } from "lucide-react";
import { CHATLAYA_AUTONOMOUS_HOST, getChatlayaApiBase } from "@/lib/env";
import { useAuth } from "@/components/auth/AuthProvider";
import ProblemCollectorFlow from "./ProblemCollectorFlow";
import FounderWorkspace from "./FounderWorkspace";

type AssistantMode = "general" | "launch_structure_sell";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  pending?: boolean;
};

type Conversation = {
  conversation_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  archived: boolean;
  assistant_mode: AssistantMode;
};

function apiUrl(path: string): string {
  return `${getChatlayaApiBase()}${path}`;
}
const STREAM_TIMEOUT_MS = 130_000;
const TYPEWRITER_BASE_DELAY_MS = 12;
const TYPEWRITER_PAUSE_DELAY_MS = 26;
const GENERAL_STARTER_PROMPTS = [
  {
    label: "Clarifier ma trajectoire",
    prompt: "Aide-moi à clarifier ma trajectoire KORYXA, mon point de départ et mes prochaines étapes prioritaires.",
  },
  {
    label: "Cadrer un besoin entreprise",
    prompt: "Aide-moi à cadrer un besoin entreprise en distinguant objectif, contexte, livrable, urgence et mode de traitement.",
  },
  {
    label: "Choisir la bonne entrée",
    prompt: "Aide-moi à choisir la bonne entrée KORYXA selon mon besoin actuel.",
  },
  {
    label: "Prioriser mes prochaines étapes",
    prompt: "Aide-moi à identifier les prochaines étapes les plus utiles selon ma situation actuelle.",
  },
] as const;

const CHATLAYA_AUTONOMOUS_URL = `https://${CHATLAYA_AUTONOMOUS_HOST}/`;

function buildAuthHref(isAutonomousHost: boolean, path: "/login" | "/signup") {
  let redirectTarget = isAutonomousHost ? CHATLAYA_AUTONOMOUS_URL : "/chatlaya";
  if (typeof window !== "undefined") {
    try {
      const currentUrl = new URL(window.location.href);
      currentUrl.hash = "";
      if (currentUrl.hostname === CHATLAYA_AUTONOMOUS_HOST) {
        redirectTarget = currentUrl.toString();
      } else if (currentUrl.pathname.startsWith("/chatlaya")) {
        redirectTarget = `${currentUrl.pathname}${currentUrl.search}`;
      }
    } catch {
      // Keep the safe fallback computed above.
    }
  }
  return `/chatlaya/auth${path}?redirect=${encodeURIComponent(redirectTarget)}`;
}

function buildLoginHref(isAutonomousHost: boolean) {
  return buildAuthHref(isAutonomousHost, "/login");
}

function buildSignupHref(isAutonomousHost: boolean) {
  return buildAuthHref(isAutonomousHost, "/signup");
}

function detectAutonomousChatlayaHost() {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.dataset.appHost;
    if (attr) return attr === CHATLAYA_AUTONOMOUS_HOST;
  }
  if (typeof window !== "undefined") {
    return window.location.hostname === CHATLAYA_AUTONOMOUS_HOST;
  }
  return false;
}

const ASSISTANT_MODE_OPTIONS: Array<{ value: AssistantMode; label: string; hint: string }> = [
  {
    value: "general",
    label: "Mode général",
    hint: "ChatLAYA répond avec son contexte produit habituel.",
  },
  {
    value: "launch_structure_sell",
    label: "Mode Fondateur",
    hint: "Corpus dédié aux porteurs de projet : lancer, structurer, vendre.",
  },
];

function normalizeTitle(value?: string | null) {
  return value?.trim() || "Nouvelle conversation";
}

function normalizeAssistantMode(value?: string | null): AssistantMode {
  return value === "launch_structure_sell" ? "launch_structure_sell" : "general";
}

function normalizeConversation(conversation: Conversation): Conversation {
  return {
    ...conversation,
    assistant_mode: normalizeAssistantMode(conversation?.assistant_mode),
  };
}

function formatDate(value?: string | null) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function normalizeStreamError(text: string, status?: number, contentType?: string | null) {
  const raw = text.trim();
  const lower = raw.toLowerCase();
  const htmlLike = (contentType || "").includes("text/html") || lower.includes("<html");
  if (status === 504 || lower.includes("gateway time-out") || lower.includes("gateway timeout")) {
    return "ChatLAYA met trop de temps à répondre. Réessayez dans un instant.";
  }
  if (status === 502 || status === 503 || htmlLike) {
    return "Le service ChatLAYA est temporairement indisponible. Réessayez dans un instant.";
  }
  return raw || "Échec de la réponse.";
}

type MdBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "ordered-list"; items: string[] }
  | { type: "unordered-list"; items: string[] }
  | { type: "code-block"; text: string };

function parseMdBlocks(content: string): MdBlock[] {
  const lines = content.split("\n");
  const blocks: MdBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) { codeLines.push(lines[i]); i++; }
      i++;
      blocks.push({ type: "code-block", text: codeLines.join("\n") });
      continue;
    }

    if (line.startsWith("### ")) { blocks.push({ type: "heading", level: 3, text: line.slice(4) }); i++; continue; }
    if (line.startsWith("## ")) { blocks.push({ type: "heading", level: 2, text: line.slice(3) }); i++; continue; }
    if (line.startsWith("# ")) { blocks.push({ type: "heading", level: 1, text: line.slice(2) }); i++; continue; }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        if (/^\d+\.\s/.test(lines[i])) {
          items.push(lines[i].replace(/^\d+\.\s+/, ""));
          i++;
        } else if (!lines[i].trim()) {
          let j = i + 1;
          while (j < lines.length && !lines[j].trim()) j++;
          if (j < lines.length && /^\d+\.\s/.test(lines[j])) { i = j; } else { break; }
        } else { break; }
      }
      blocks.push({ type: "ordered-list", items });
      continue;
    }

    if (/^[-•*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        if (/^[-•*]\s/.test(lines[i])) {
          items.push(lines[i].replace(/^[-•*]\s+/, ""));
          i++;
        } else if (!lines[i].trim()) {
          let j = i + 1;
          while (j < lines.length && !lines[j].trim()) j++;
          if (j < lines.length && /^[-•*]\s/.test(lines[j])) { i = j; } else { break; }
        } else { break; }
      }
      blocks.push({ type: "unordered-list", items });
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith("#") &&
      !/^\d+\.\s/.test(lines[i]) &&
      !/^[-•*]\s/.test(lines[i]) &&
      !lines[i].startsWith("```")
    ) { paraLines.push(lines[i]); i++; }
    if (paraLines.length) blocks.push({ type: "paragraph", text: paraLines.join(" ") });
  }

  return blocks;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
        if (part.startsWith("*") && part.endsWith("*"))
          return <em key={i} className="italic text-slate-700">{part.slice(1, -1)}</em>;
        if (part.startsWith("`") && part.endsWith("`"))
          return <code key={i} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[12px] text-sky-700">{part.slice(1, -1)}</code>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function AssistantContent({ content }: { content: string }) {
  const blocks = parseMdBlocks(content);

  return (
    <div className="break-words space-y-3">
      {blocks.map((block, idx) => {
        if (block.type === "heading") {
          const cls =
            block.level === 1
              ? "text-base font-bold text-slate-900"
              : block.level === 2
                ? "text-sm font-bold text-slate-900"
                : "text-sm font-semibold text-slate-800";
          if (block.level === 1) return <h1 key={idx} className={cls}>{renderInline(block.text)}</h1>;
          if (block.level === 2) return <h2 key={idx} className={cls}>{renderInline(block.text)}</h2>;
          return <h3 key={idx} className={cls}>{renderInline(block.text)}</h3>;
        }

        if (block.type === "ordered-list") {
          return (
            <ol key={idx} className="space-y-2.5">
              {block.items.map((item, li) => (
                <li key={li} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-50 text-[10px] font-bold text-sky-600 ring-1 ring-sky-100">
                    {li + 1}
                  </span>
                  <span className="flex-1 text-sm leading-6 text-slate-700">{renderInline(item)}</span>
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "unordered-list") {
          return (
            <ul key={idx} className="space-y-2">
              {block.items.map((item, li) => (
                <li key={li} className="flex gap-2.5">
                  <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                  <span className="flex-1 text-sm leading-7 text-slate-700">{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "code-block") {
          return (
            <pre key={idx} className="overflow-x-auto rounded-xl bg-slate-900 px-4 py-3 text-[12px] leading-5 text-slate-200">
              <code>{block.text}</code>
            </pre>
          );
        }

        return (
          <p key={idx} className="text-sm leading-7 text-slate-700">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}

const THINKING_MSGS = (name?: string) => [
  name ? `Je lis attentivement votre message, ${name}…` : "Je lis attentivement votre message…",
  "J'analyse chaque dimension de votre demande…",
  name ? `Je construis une réponse sur mesure pour vous, ${name}…` : "Je construis une réponse structurée pour vous…",
  "Je mobilise tout mon corpus pour vous donner le meilleur…",
  "Je peaufine les détails pour que ce soit vraiment utile…",
  "Presque terminé — je finalise ma réponse…",
];

function ThinkingIndicator({ firstName }: { firstName?: string }) {
  const [phase, setPhase] = useState(0);
  const messages = THINKING_MSGS(firstName);

  useEffect(() => {
    setPhase(0);
    const id = setInterval(() => setPhase((p) => (p + 1) % messages.length), 2800);
    return () => clearInterval(id);
  }, [messages.length]);

  return (
    <div className="flex max-w-[78%] flex-col gap-3 rounded-2xl rounded-bl-sm border border-sky-100 bg-white px-5 py-4 shadow-[0_4px_24px_rgba(14,165,233,0.10)]">
      {/* Dots wave + label */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-end gap-[5px]">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="kx-thinking-dot inline-block rounded-full bg-sky-500"
              style={{
                width: i === 1 || i === 2 ? "7px" : "5px",
                height: i === 1 || i === 2 ? "7px" : "5px",
                animationDelay: `${i * 0.13}s`,
              }}
            />
          ))}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-sky-500">
          ChatLAYA réfléchit
        </span>
      </div>
      {/* Rotating message */}
      <p key={phase} className="kx-thinking-msg text-sm leading-relaxed text-slate-600">
        {messages[phase]}
      </p>
      {/* Scan bar */}
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-slate-100">
        <div className="kx-thinking-scan h-full w-1/3 rounded-full bg-gradient-to-r from-sky-400 via-violet-400 to-sky-400" />
      </div>
    </div>
  );
}

function ChatlayaContent({ initialAutonomousHost = false }: { initialAutonomousHost?: boolean }) {
  const searchParams = useSearchParams();
  const isProblemCollector = searchParams.get("intent") === "problem_collector";
  const { user, loading: authLoading } = useAuth();
  const firstName = user?.first_name || undefined;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessMode, setAccessMode] = useState<"guest" | "user" | null>(null);
  const [founderAuthRequired, setFounderAuthRequired] = useState(false);
  const [founderWorkspaceVisible, setFounderWorkspaceVisible] = useState(false);
  const [assistantModeSaving, setAssistantModeSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAutonomousHost, setIsAutonomousHost] = useState(initialAutonomousHost || detectAutonomousChatlayaHost);
  const loginHref = buildLoginHref(isAutonomousHost);
  const signupHref = buildSignupHref(isAutonomousHost);

  const bootstrappedRef = useRef(false);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const conversationsViewportRef = useRef<HTMLDivElement | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const typewriterQueueRef = useRef("");
  const typewriterTimerRef = useRef<number | null>(null);
  const typewriterDrainWaitersRef = useRef<Array<() => void>>([]);
  const autonomousFounderBootRef = useRef(false);

  function focusComposer(preventScroll = false) {
    const composer = composerRef.current;
    if (!composer) return;
    try {
      composer.focus({ preventScroll });
    } catch {
      composer.focus();
    }
  }

  function resolveTypewriterDrain() {
    const waiters = [...typewriterDrainWaitersRef.current];
    typewriterDrainWaitersRef.current = [];
    for (const resolve of waiters) {
      resolve();
    }
  }

  function resetTypewriterQueue() {
    typewriterQueueRef.current = "";
    if (typewriterTimerRef.current !== null) {
      window.clearTimeout(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }
    resolveTypewriterDrain();
  }

  function flushTypewriterTick() {
    if (!typewriterQueueRef.current) {
      typewriterTimerRef.current = null;
      resolveTypewriterDrain();
      return;
    }

    const nextCharacter = typewriterQueueRef.current[0];
    typewriterQueueRef.current = typewriterQueueRef.current.slice(1);
    setMessages((current) =>
      current.map((item) => (item.pending ? { ...item, content: item.content + nextCharacter } : item)),
    );

    const delay =
      nextCharacter === "\n" || /[.!?;:,]/.test(nextCharacter)
        ? TYPEWRITER_PAUSE_DELAY_MS
        : nextCharacter === " "
          ? Math.max(6, TYPEWRITER_BASE_DELAY_MS - 4)
          : TYPEWRITER_BASE_DELAY_MS;
    typewriterTimerRef.current = window.setTimeout(flushTypewriterTick, delay);
  }

  function enqueueTypewriterChunk(chunk: string) {
    if (!chunk) return;
    typewriterQueueRef.current += chunk;
    if (typewriterTimerRef.current === null) {
      typewriterTimerRef.current = window.setTimeout(flushTypewriterTick, TYPEWRITER_BASE_DELAY_MS);
    }
  }

  function waitForTypewriterDrain() {
    if (!typewriterQueueRef.current && typewriterTimerRef.current === null) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      typewriterDrainWaitersRef.current.push(resolve);
    });
  }

  function forwardWheelToViewport(
    event: ReactWheelEvent<HTMLElement>,
    viewportRef: React.RefObject<HTMLDivElement | null>,
  ) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const target = event.target;
    if (target instanceof Element && viewport.contains(target)) return;
    if (viewport.scrollHeight <= viewport.clientHeight) return;

    const maxScrollTop = viewport.scrollHeight - viewport.clientHeight;
    if ((event.deltaY < 0 && viewport.scrollTop <= 0) || (event.deltaY > 0 && viewport.scrollTop >= maxScrollTop)) {
      return;
    }

    event.preventDefault();
    viewport.scrollTop = Math.min(maxScrollTop, Math.max(0, viewport.scrollTop + event.deltaY));
  }

  function forwardWheelToChatLayout(event: ReactWheelEvent<HTMLElement>) {
    const target = event.target;
    if (target instanceof Element && conversationsViewportRef.current?.contains(target)) {
      forwardWheelToViewport(event, conversationsViewportRef);
      return;
    }
    forwardWheelToViewport(event, messagesViewportRef);
  }

  async function createConversationRequest() {
    const response = await fetch(apiUrl("/chatlaya/conversations"), {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.detail || "Impossible de créer la conversation.");
    }
    return normalizeConversation((await response.json()) as Conversation);
  }

  async function ensureSession() {
    const response = await fetch(apiUrl("/chatlaya/session"), {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.detail || "Impossible d'ouvrir la session ChatLAYA.");
    }
    const data = await response.json().catch(() => ({}));
    if (data?.mode === "guest" || data?.mode === "user") {
      setAccessMode(data.mode);
    }
    return {
      conversationId: typeof data?.conversation_id === "string" ? data.conversation_id : null,
      mode: data?.mode === "guest" || data?.mode === "user" ? data.mode : null,
    };
  }

  async function createConversation() {
    await switchToGeneralMode();
  }

  async function loadConversations(force = false) {
    setConversationsLoading(true);
    try {
      const session = await ensureSession();
      const response = await fetch(apiUrl("/chatlaya/conversations"), {
        cache: "no-store",
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.detail || "Impossible de charger les conversations.");
      }

      const data = await response.json().catch(() => ({}));
      const items: Conversation[] = Array.isArray(data?.items) ? data.items.map(normalizeConversation) : [];

      if (!items.length && session.conversationId) {
        setError(null);
        setSelectedConversationId(session.conversationId);
        setMessages([]);
        return;
      }

      if (!items.length && !force) {
        await loadConversations(true);
        return;
      }

      if (!items.length && force) {
        const created = await createConversationRequest();
        setError(null);
        setConversations([created]);
        setSelectedConversationId(created.conversation_id);
        setMessages([]);
        return;
      }

      setError(null);
      setConversations(items);
      setSelectedConversationId((current) => {
        if (isAutonomousHost) {
          const founderConversation = items.find((item) => item.assistant_mode === "launch_structure_sell");
          if (founderConversation) {
            return founderConversation.conversation_id;
          }
        }
        if (current && items.some((item) => item.conversation_id === current)) return current;
        if (session.conversationId && items.some((item) => item.conversation_id === session.conversationId)) {
          return session.conversationId;
        }
        return items[0]?.conversation_id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue.");
    } finally {
      setConversationsLoading(false);
    }
  }

  async function loadMessages(conversationId: string) {
    setMessagesLoading(true);
    try {
      const response = await fetch(
        apiUrl(`/chatlaya/messages?conversation_id=${encodeURIComponent(conversationId)}`),
        { cache: "no-store", credentials: "include" },
      );
      if (!response.ok) {
        if (response.status === 401) {
          const conv = conversations.find((c) => c.conversation_id === conversationId);
          if (!conv || conv.assistant_mode === "launch_structure_sell") {
            setFounderAuthRequired(true);
            setMessages([]);
            return;
          }
        }
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.detail || "Impossible de récupérer les messages.");
      }
      const data = await response.json().catch(() => ({}));
      resetTypewriterQueue();
      if (!(isAutonomousHost && (!user || accessMode === "guest"))) {
        setFounderAuthRequired(false);
      }
      setError(null);
      setMessages(Array.isArray(data?.items) ? data.items : []);
      // Auto-redirect: founder conversations always open as workspace, not chat
      const conv = conversations.find((c) => c.conversation_id === conversationId);
      setFounderWorkspaceVisible(conv?.assistant_mode === "launch_structure_sell" && !!user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue.");
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }

  useEffect(() => {
    if (bootstrappedRef.current) return;
    if (isAutonomousHost && authLoading) return;
    if (isAutonomousHost && !user) {
      setError(null);
      setConversationsLoading(false);
      setMessagesLoading(false);
      return;
    }
    bootstrappedRef.current = true;
    void loadConversations();
  }, [authLoading, isAutonomousHost, user]);

  useEffect(() => {
    setIsAutonomousHost((current) => current || detectAutonomousChatlayaHost());
  }, []);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedConversationId);
  }, [selectedConversationId]);

  const latestMessageContent = messages[messages.length - 1]?.content ?? "";

  useEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: streaming ? "auto" : "smooth" });
  }, [messages.length, latestMessageContent, streaming]);

  useEffect(() => {
    focusComposer(true);
  }, [selectedConversationId]);

  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "0px";
    const nextHeight = Math.min(el.scrollHeight, 220);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > 220 ? "auto" : "hidden";
  }, [input]);

  useEffect(
    () => () => {
      streamAbortRef.current?.abort();
      resetTypewriterQueue();
    },
    [],
  );

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "ChatLAYA | KORYXA";
    }
  }, []);

  async function archiveConversation(conversationId: string) {
    setError(null);
    try {
      const response = await fetch(apiUrl(`/chatlaya/conversations/${conversationId}/archive`), {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.detail || "Impossible d'archiver la conversation.");
      }
      setConversations((current) => {
        const remaining = current.filter((item) => item.conversation_id !== conversationId);
        if (selectedConversationId === conversationId) {
          setSelectedConversationId(remaining[0]?.conversation_id ?? null);
          setMessages([]);
        }
        return remaining;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue.");
    }
  }

  async function switchToGeneralMode() {
    if (assistantModeSaving || streaming) return;
    setFounderAuthRequired(false);
    setFounderWorkspaceVisible(false);
    setError(null);
    setAssistantModeSaving(true);
    try {
      streamAbortRef.current?.abort();
      resetTypewriterQueue();
      setStreaming(false);
      const created = await createConversationRequest();
      setConversations((current) => [created, ...current.filter((c) => c.conversation_id !== created.conversation_id)]);
      setSelectedConversationId(created.conversation_id);
      setMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue.");
    } finally {
      setAssistantModeSaving(false);
    }
  }

  async function switchToFounderMode() {
    if (assistantModeSaving || streaming) return;
    if (accessMode === "guest" || !user) {
      setFounderAuthRequired(true);
      return;
    }
    setFounderAuthRequired(false);
    setError(null);
    setAssistantModeSaving(true);
    try {
      streamAbortRef.current?.abort();
      resetTypewriterQueue();
      setStreaming(false);
      const created = await createConversationRequest();
      const response = await fetch(apiUrl(`/chatlaya/conversations/${created.conversation_id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assistant_mode: "launch_structure_sell" }),
      });
      if (!response.ok) {
        if (response.status === 401) {
          setFounderAuthRequired(true);
          return;
        }
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.detail || "Impossible de changer le mode assistant.");
      }
      const finalConv = normalizeConversation((await response.json()) as Conversation);
      setConversations((current) => [finalConv, ...current.filter((c) => c.conversation_id !== finalConv.conversation_id)]);
      setSelectedConversationId(finalConv.conversation_id);
      setMessages([]);
      setFounderWorkspaceVisible(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue.");
    } finally {
      setAssistantModeSaving(false);
    }
  }

  function applyStarterPrompt(prompt: string) {
    setError(null);
    setInput(prompt);
    focusComposer(true);
  }

  function copyMessage(id: string, content: string) {
    const plain = content
      .replace(/\*\*([^*\n]+)\*\*/g, "$1")
      .replace(/\*([^*\n]+)\*/g, "$1")
      .replace(/`([^`\n]+)`/g, "$1")
      .replace(/^#{1,3}\s+/gm, "")
      .replace(/^```[\w]*\n?/gm, "")
      .replace(/^```$/gm, "")
      .trim();
    navigator.clipboard.writeText(plain).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000);
    }).catch(() => {});
  }

  async function streamAssistant(conversationId: string, prompt: string) {
    const controller = new AbortController();
    streamAbortRef.current = controller;
    let timedOut = false;
    const timeoutId =
      typeof window !== "undefined"
        ? window.setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, STREAM_TIMEOUT_MS)
        : null;

    const response = await fetch(apiUrl("/chatlaya/message"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ conversation_id: conversationId, message: prompt }),
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type");
    const isEventStream = (contentType || "").includes("text/event-stream");
    if (!response.ok || !response.body || !isEventStream) {
      const text = await response.text().catch(() => "");
      const err = new Error(normalizeStreamError(text, response.status, contentType));
      if (response.status === 401) Object.assign(err, { status: 401 });
      throw err;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

        let boundary: number;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const packet = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          if (!packet.trim()) continue;

          let event = "message";
          const dataLines: string[] = [];
          for (const line of packet.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            if (line.startsWith("data:")) dataLines.push(line.slice(5));
          }

          const data = dataLines.join("\n");
          if (event === "token") {
            enqueueTypewriterChunk(data);
          } else if (event === "done") {
            await waitForTypewriterDrain();
            setMessages((current) => current.filter((item) => !item.pending));
            return;
          } else if (event === "error") {
            throw new Error(data || "Erreur de streaming.");
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        resetTypewriterQueue();
        setMessages((current) => current.filter((item) => !item.pending));
        if (timedOut) {
          throw new Error("ChatLAYA met trop de temps à répondre. Réessayez dans un instant.");
        }
        return;
      }
      resetTypewriterQueue();
      if (err instanceof Error) throw err;
      throw new Error("Erreur de streaming.");
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      if (streamAbortRef.current === controller) {
        streamAbortRef.current = null;
      }
    }
  }

  async function sendMessage() {
    if (streaming) return;
    const prompt = input.trim();
    if (!prompt) return;

    let convId = selectedConversationId;
    if (!convId) {
      try {
        const session = await ensureSession();
        convId = session.conversationId;
        if (!convId) {
          const created = await createConversationRequest();
          setConversations((current) => [created, ...current]);
          setSelectedConversationId(created.conversation_id);
          setMessages([]);
          convId = created.conversation_id;
        } else {
          setSelectedConversationId(convId);
          setMessages([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de créer la conversation.");
        return;
      }
    }

    setError(null);
    resetTypewriterQueue();
    const now = Date.now();
    setMessages((current) => [
      ...current,
      { id: `user-${now}`, role: "user", content: prompt },
      { id: `pending-${now}`, role: "assistant", content: "", pending: true },
    ]);
    setInput("");
    setStreaming(true);

    try {
      await streamAssistant(convId, prompt);
      await loadMessages(convId);
      await loadConversations(true);
    } catch (err) {
      if (err instanceof Error && (err as Error & { status?: number }).status === 401) {
        setFounderAuthRequired(true);
      } else {
        setError(err instanceof Error ? err.message : "Erreur pendant la génération.");
      }
      setMessages((current) => current.filter((item) => !item.pending));
    } finally {
      setStreaming(false);
      focusComposer(true);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendMessage();
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  const activeConversation = useMemo(
    () => conversations.find((item) => item.conversation_id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );
  const activeAssistantMode = activeConversation?.assistant_mode ?? "general";
  const starterPrompts = GENERAL_STARTER_PROMPTS;

  useEffect(() => {
    if (
      !isAutonomousHost ||
      founderAuthRequired ||
      authLoading ||
      conversationsLoading ||
      assistantModeSaving ||
      streaming
    ) {
      return;
    }

    if (!user || accessMode === "guest") {
      setError(null);
      setFounderAuthRequired(false);
      autonomousFounderBootRef.current = false;
      return;
    }

    if (accessMode !== "user") {
      return;
    }

    const founderConversation =
      activeConversation?.assistant_mode === "launch_structure_sell"
        ? activeConversation
        : conversations.find((item) => item.assistant_mode === "launch_structure_sell");

    if (founderConversation) {
      if (selectedConversationId !== founderConversation.conversation_id) {
        setSelectedConversationId(founderConversation.conversation_id);
        return;
      }
      if (!founderWorkspaceVisible) {
        setFounderWorkspaceVisible(true);
      }
      autonomousFounderBootRef.current = false;
      return;
    }

    if (autonomousFounderBootRef.current) {
      return;
    }

    autonomousFounderBootRef.current = true;
    void switchToFounderMode();
  }, [
    activeConversation,
    accessMode,
    assistantModeSaving,
    conversations,
    conversationsLoading,
    authLoading,
    founderAuthRequired,
    founderWorkspaceVisible,
    isAutonomousHost,
    selectedConversationId,
    streaming,
    user,
  ]);

  const autonomousFounderReady =
    isAutonomousHost &&
    user &&
    !founderAuthRequired &&
    !!selectedConversationId &&
    activeAssistantMode === "launch_structure_sell" &&
    founderWorkspaceVisible;

  const autonomousFounderBootPending =
    isAutonomousHost &&
    !isProblemCollector &&
    !founderAuthRequired &&
    (
      authLoading ||
      conversationsLoading ||
      assistantModeSaving ||
      accessMode === null ||
      (user && accessMode === "user" && !autonomousFounderReady)
    );

  const autonomousFounderAuthRequired =
    isAutonomousHost &&
    !isProblemCollector &&
    !authLoading &&
    (founderAuthRequired || accessMode === "guest" || (!user && accessMode === "user"));

  if (isAutonomousHost && !isProblemCollector && !authLoading && !user) {
    return (
      <FounderWorkspace
        conversationId={null}
        loginHref={loginHref}
        signupHref={signupHref}
        onExit={() => void switchToGeneralMode()}
      />
    );
  }

  if (!isProblemCollector && autonomousFounderReady) {
    return (
      <FounderWorkspace
        conversationId={selectedConversationId}
        firstName={firstName}
        loginHref={loginHref}
        signupHref={signupHref}
        conversations={conversations}
        selectedConversationId={selectedConversationId}
        historyLoading={conversationsLoading}
        onSelectConversation={(conversationId) => {
          streamAbortRef.current?.abort();
          resetTypewriterQueue();
          setStreaming(false);
          setError(null);
          setMessages([]);
          setFounderWorkspaceVisible(true);
          setSelectedConversationId(conversationId);
        }}
        onCreateConversation={() => void switchToFounderMode()}
        onArchiveConversation={(conversationId) => void archiveConversation(conversationId)}
        onExit={() => void switchToGeneralMode()}
      />
    );
  }

  if (autonomousFounderBootPending) {
    return (
      <main className="flex h-full min-h-[60vh] items-center justify-center">
        <div className="rounded-3xl border border-slate-200/80 bg-white/92 px-6 py-4 text-sm font-medium text-slate-600 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
          Ouverture de l&apos;espace Founder...
        </div>
      </main>
    );
  }

  if (autonomousFounderAuthRequired) {
    return (
      <FounderWorkspace
        conversationId={null}
        firstName={firstName}
        loginHref={loginHref}
        signupHref={signupHref}
        onExit={() => void switchToGeneralMode()}
      />
    );
  }

  if (isProblemCollector) {
    return (
      <main className="grid h-full min-h-0 gap-3 overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
        {/* Sidebar — identique au mode normal */}
        <aside className="hidden min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-[0_2px_16px_rgba(15,23,42,0.06)] lg:flex">
          <div className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Collecte terrain</h2>
              <span className="rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-600">
                Mode général
              </span>
            </div>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-600 shadow-sm">
              <span className="text-sm font-bold text-white">L</span>
            </div>
            <p className="text-sm font-semibold text-slate-800">Terrain africain</p>
            <p className="mt-2 text-xs leading-6 text-slate-400">
              Partagez un problème réel observé autour de vous. Votre contribution aide KORYXA à mieux comprendre les réalités locales.
            </p>
          </div>
        </aside>

        {/* Main area — problem collector flow */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
          <div className="shrink-0 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500">
                <MapPin className="h-3 w-3 text-white" />
              </span>
              <span className="text-sm font-semibold text-slate-800">Voix du terrain africain</span>
              <span className="text-slate-300">·</span>
              <span className="truncate text-xs text-slate-400">Partagez un problème réel observé autour de vous</span>
            </div>
          </div>
          <ProblemCollectorFlow />
        </section>
      </main>
    );
  }

  return (
    <main
      onWheelCapture={forwardWheelToChatLayout}
      className="grid h-full min-h-0 gap-3 overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]"
    >
      {/* ─── Sidebar ─── */}
      <aside className="hidden min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-[0_2px_16px_rgba(15,23,42,0.06)] lg:flex">
        {/* Header */}
        <div className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Conversations</h2>
          </div>
          {accessMode ? (
            <p className="mt-1 text-[10px] font-medium text-slate-400">
              {accessMode === "guest" ? "Mode invité" : "Mode connecté"}
            </p>
          ) : null}
        </div>

        {/* Action buttons */}
        <div className="shrink-0 border-b border-slate-100 px-3 py-2.5">
          <button
            type="button"
            onClick={() => void createConversation()}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 active:scale-[0.98]"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            Nouvelle conversation
          </button>
          {activeConversation ? (
            <button
              type="button"
              onClick={() => void archiveConversation(activeConversation.conversation_id)}
              disabled={streaming}
              className="mt-1.5 w-full rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-400 transition hover:text-slate-600 disabled:opacity-40"
            >
              Archiver
            </button>
          ) : null}
        </div>

        {/* Conversation list – scrollable */}
        <div
          ref={conversationsViewportRef}
          className="sidebar-nav min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y px-2 py-2 [-webkit-overflow-scrolling:touch]"
        >
          {conversationsLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="mb-1.5 h-[52px] animate-pulse rounded-xl bg-slate-100" />
            ))
          ) : conversations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-400">
              Aucune conversation pour le moment.
            </div>
          ) : (
            conversations.map((conversation) => {
              const active = conversation.conversation_id === selectedConversationId;
              return (
                <button
                  key={conversation.conversation_id}
                  type="button"
                  onClick={() => {
                    streamAbortRef.current?.abort();
                    resetTypewriterQueue();
                    setStreaming(false);
                    setError(null);
                    setMessages([]);
                    setSelectedConversationId(conversation.conversation_id);
                  }}
                  className={`mb-0.5 w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "bg-sky-50 shadow-[0_1px_4px_rgba(14,165,233,0.10)]"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <p className={`truncate text-xs font-semibold leading-snug ${active ? "text-sky-700" : "text-slate-800"}`}>
                    {normalizeTitle(conversation.title)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {formatDate(conversation.updated_at) || "Nouvelle conversation"}
                  </p>
                </button>
              );
            })
          )}
        </div>

        {/* Starter prompts */}
        <div className="shrink-0 border-t border-slate-100 px-3 py-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Démarrage rapide
          </p>
          <div className="grid gap-0.5">
            {starterPrompts.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => applyStarterPrompt(item.prompt)}
                className="rounded-lg px-2 py-1.5 text-left text-[11px] font-medium text-slate-500 transition hover:bg-sky-50 hover:text-sky-700"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* ─── Main chat area ─── */}
      <section
        onWheelCapture={(event) => forwardWheelToViewport(event, messagesViewportRef)}
        className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-[0_2px_16px_rgba(15,23,42,0.06)]"
      >
        {/* Error banner */}
        {error ? (
          <div className="shrink-0 border-b border-rose-100 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-600">
            {error}
          </div>
        ) : null}

        {/* Mode bar – compact */}
        <div className="shrink-0 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Mode</span>
            <div className="flex gap-1.5">
              {ASSISTANT_MODE_OPTIONS.map((option) => {
                const active = option.value === activeAssistantMode;
                const isFounderLocked = option.value === "launch_structure_sell" && accessMode === "guest";
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={assistantModeSaving || streaming || (option.value === "general" && !selectedConversationId)}
                    onClick={() => void (option.value === "launch_structure_sell" ? switchToFounderMode() : switchToGeneralMode())}
                    title={isFounderLocked ? "Connexion requise pour accéder au Mode Fondateur" : option.hint}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                      active
                        ? "bg-sky-600 text-white shadow-sm"
                        : isFounderLocked
                          ? "border border-slate-200 bg-white text-slate-400 hover:border-amber-300 hover:text-amber-600"
                          : "border border-slate-200 bg-white text-slate-500 hover:border-sky-300 hover:text-sky-600"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {isFounderLocked && <Lock className="h-3 w-3" />}
                    {option.label}
                  </button>
                );
              })}
            </div>
            {assistantModeSaving ? (
              <span className="ml-auto text-[10px] text-slate-400">Enregistrement…</span>
            ) : null}
          </div>
        </div>

        {/* Messages viewport */}
        <div
          ref={messagesViewportRef}
          className="sidebar-nav min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y px-4 py-5 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch] sm:px-5"
        >
          {founderAuthRequired ? (
            <div className="flex h-full min-h-[200px] items-center justify-center">
              <div className="w-full max-w-sm text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 ring-1 ring-amber-100">
                  <Lock className="h-5 w-5 text-amber-500" />
                </div>
                <p className="text-base font-semibold text-slate-800">Mode Fondateur — Accès réservé</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Le Mode Fondateur est réservé aux utilisateurs connectés. Connectez-vous pour accéder au corpus spécialisé&nbsp;: lancer, structurer, vendre.
                </p>
                <div className="mt-5 flex flex-col items-center gap-3">
                  <a
                    href={loginHref}
                    className="inline-flex items-center justify-center rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
                  >
                    Se connecter
                  </a>
                  <a
                    href={loginHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-sky-700 underline underline-offset-4 transition hover:text-sky-900"
                  >
                    Ouvrir la connexion Founder dans un nouvel onglet
                  </a>
                  <button
                    type="button"
                    onClick={() => { setFounderAuthRequired(false); void switchToGeneralMode(); }}
                    className="text-xs text-slate-400 transition hover:text-slate-600"
                  >
                    Rester en Mode général
                  </button>
                </div>
              </div>
            </div>
          ) : messagesLoading ? (
            <div className="grid gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className={`h-16 animate-pulse rounded-2xl bg-slate-100 ${index % 2 === 0 ? "ml-auto w-[60%]" : "w-[72%]"}`}
                />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full min-h-[200px] items-center justify-center">
              <div className="w-full max-w-md text-center">
                <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-600 shadow-sm">
                  <span className="text-sm font-bold text-white">L</span>
                </div>
                <p className="text-base font-semibold text-slate-800">Partez d'une question simple.</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  ChatLAYA vous aide à clarifier, cadrer et décider avant d'ouvrir la bonne suite dans KORYXA.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {starterPrompts.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => applyStarterPrompt(item.prompt)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
              {messages.map((message) => {
                const isUser = message.role === "user";
                const isCopied = copiedId === message.id;
                return (
                  <div key={message.id} className={`group flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
                    {!isUser ? (
                      <div className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600 shadow-sm">
                        <span className="text-[9px] font-bold leading-none text-white">L</span>
                      </div>
                    ) : null}
                    <div className={`flex max-w-[78%] flex-col ${isUser ? "items-end" : "items-start"}`}>
                      {message.pending && !message.content ? (
                        <ThinkingIndicator firstName={firstName} />
                      ) : (
                        <div
                          className={`rounded-2xl px-4 py-3 ${
                            isUser
                              ? "rounded-br-sm border border-sky-100 bg-sky-50"
                              : "rounded-bl-sm border border-slate-100 bg-white shadow-[0_1px_6px_rgba(15,23,42,0.06)]"
                          }`}
                        >
                          {isUser ? (
                            <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
                              {message.content}
                            </div>
                          ) : (
                            <AssistantContent content={message.content} />
                          )}
                        </div>
                      )}
                      {!isUser && !message.pending && message.content ? (
                        <button
                          type="button"
                          onClick={() => copyMessage(message.id, message.content)}
                          className="mt-1 flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] text-slate-400 opacity-0 transition-all hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
                          title="Copier la réponse"
                        >
                          {isCopied ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          {isCopied ? "Copié !" : "Copier"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={onSubmit}
          className="shrink-0 border-t border-slate-100 bg-white px-3 py-3 sm:px-4"
        >
          <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 transition-colors focus-within:border-sky-300 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(14,165,233,0.07)]">
            <textarea
              ref={composerRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder={streaming ? "Patientez pendant la réponse..." : "Posez votre question à ChatLAYA"}
              rows={1}
              aria-label="Message pour ChatLAYA"
              className="min-h-[40px] w-full resize-none bg-transparent text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none"
              disabled={streaming}
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              <span className="sr-only">Envoyer</span>
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1.5 text-right text-[10px] text-slate-400">
            Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne
          </p>
        </form>
      </section>
    </main>
  );
}

export default function ChatlayaClient({ initialAutonomousHost = false }: { initialAutonomousHost?: boolean }) {
  return (
    <Suspense>
      <ChatlayaContent initialAutonomousHost={initialAutonomousHost} />
    </Suspense>
  );
}
