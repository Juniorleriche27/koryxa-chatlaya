"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CLIENT_INNOVA_API_BASE, INNOVA_API_BASE } from "@/lib/env";
import { FORCED_PLAN, PlanTier } from "@/config/planFeatures";

type WorkspaceRole = "demandeur" | "prestataire";

type User = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  roles?: string[];
  plan?: PlanTier;
  created_at?: string;
  workspace_role?: WorkspaceRole | null;
} | null;

type AuthContextValue = {
  user: User;
  loading: boolean;
  refresh: () => Promise<void>;
  clear: () => void;
  initialLoggedIn: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const pendingRefresh = new WeakMap<Window | Document, Promise<void>>();
const CHATLAYA_AUTONOMOUS_HOST = "chatlaya.innovaplus.africa";

function withForcedPlan(user: User): User {
  if (!user || !FORCED_PLAN) return user;
  return { ...user, plan: FORCED_PLAN };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoggedIn, setInitialLoggedIn] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    const timeout = setTimeout(() => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    }, 8000);
    try {
      const authBase =
        typeof window !== "undefined" && window.location.hostname === CHATLAYA_AUTONOMOUS_HOST
          ? INNOVA_API_BASE
          : CLIENT_INNOVA_API_BASE;
      const res = await fetch(`${authBase}/auth/me`, {
        cache: "no-store",
        credentials: "include",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("not auth");
      const data = (await res.json()) as User;
      setUser(withForcedPlan(data));
      setInitialLoggedIn(true);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setUser(null);
        setInitialLoggedIn(false);
      }
    } finally {
      clearTimeout(timeout);
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setUser(null);
    setInitialLoggedIn(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    return () => abortRef.current?.abort();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const targetWindow = window;
    const targetDocument = document;

    const scheduleRefresh = () => {
      const existing = pendingRefresh.get(targetWindow);
      if (existing) return;
      const promise = refresh().finally(() => pendingRefresh.delete(targetWindow));
      pendingRefresh.set(targetWindow, promise);
    };

    const handleVisibility = () => {
      if (targetDocument.visibilityState === "visible") {
        scheduleRefresh();
      }
    };

    targetWindow.addEventListener("focus", scheduleRefresh);
    targetDocument.addEventListener("visibilitychange", handleVisibility);
    return () => {
      targetWindow.removeEventListener("focus", scheduleRefresh);
      targetDocument.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, refresh, clear, initialLoggedIn }),
    [user, loading, refresh, clear, initialLoggedIn]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
