const CACHE_NAME = "church-app-v9";
const APP_SHELL = [
  "/",
  "/index.html",
  "/login.html",
  "/register.html",
  "/dashboard.html",
  "/my-qr-pass.html",
  "/departments.html",
  "/members.html",
  "/attendance.html",
  "/qr-attendance.html",
  "/graphs.html",
  "/events.html",
  "/announcements.html",
  "/donations.html",
  "/weekly-programs.html",
  "/worship-songs.html",
  "/worship-songs-folder.html",
  "/church-album.html",
  "/css/styles.css",
  "/css/church-theme.css",
  "/js/pwa.js",
  "/js/my-qr-pass.js",
  "/js/qr-attendance.js",
  "/js/members.js",
  "/js/worship-songs.js",
  "/js/worship-songs-folder.js",
  "/js/church-album.js",
  "/assets/icon-192.png",
  "/assets/icon-512.png",
  "/assets/logo.jpeg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  const isApiRequest =
    requestUrl.origin === self.location.origin &&
    requestUrl.pathname.startsWith("/api/");

  const isMutableAsset =
    requestUrl.origin === self.location.origin &&
    (
      requestUrl.pathname.startsWith("/js/") ||
      requestUrl.pathname.startsWith("/css/") ||
      requestUrl.pathname === "/manifest.webmanifest"
    );

  if (isApiRequest) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (isMutableAsset) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          throw new Error(`Asset fetch failed for ${requestUrl.pathname}`);
        })
    );
    return;
  }

  const isPageRequest =
    event.request.mode === "navigate" ||
    event.request.destination === "document" ||
    event.request.headers.get("accept")?.includes("text/html");

  if (isPageRequest) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          return cached || caches.match("/index.html");
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }

          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => caches.match("/index.html"));
    })
  );
});
