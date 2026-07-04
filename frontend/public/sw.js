self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("innova-pwa")).map((key) => caches.delete(key)));
      await self.registration.unregister();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", () => {
  // Service worker intentionally disabled to avoid stale auth and stale frontend bundles.
});
