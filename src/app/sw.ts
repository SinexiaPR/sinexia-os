import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Only static, non-authenticated assets are cached. Anything that can
 * reflect per-user or per-company data — /dashboard/*, /api/*, /login,
 * and Supabase auth/data/storage calls — is intentionally left out of
 * this list so it always goes straight to the network.
 */
const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: /^\/_next\/static\/.*/i,
    handler: new CacheFirst({
      cacheName: "static-assets",
      plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 })],
    }),
  },
  {
    matcher: /^\/icons\/.*\.png$/i,
    handler: new CacheFirst({
      cacheName: "pwa-icons",
      plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 30 * 24 * 60 * 60 })],
    }),
  },
  {
    matcher: /^\/(favicon\.svg|apple-touch-icon\.png|manifest\.webmanifest)$/i,
    handler: new CacheFirst({
      cacheName: "pwa-shell",
      plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 30 * 24 * 60 * 60 })],
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
});

serwist.addEventListeners();
