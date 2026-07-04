"use client";

import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const resetPwaState = async () => {
      try {
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.filter((key) => key.startsWith("innova-pwa")).map((key) => caches.delete(key)));
        }
      } catch {
        // Ignore cleanup failures; auth must keep working even if cache cleanup is partial.
      }
    };

    void resetPwaState();
  }, []);
  return null;
}
