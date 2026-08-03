importScripts("https://cdn.onesignal.com/sdks/OneSignalSDKWorker.js");

const CACHE_NAME = "vivi-bariano-v3";
const APP_SHELL = [
  "./",
  "index.html",
  "eventi.html",
  "link-utili.html",
  "css/style.css",
  "js/app.js",
  "manifest.webmanifest",
  "icons/vb_logo_SOLOCERCHIO.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
