const CACHE_PREFIX = "farytale";
const CACHE_NAME = `${CACHE_PREFIX}-reader-v1`;
const PRECACHE_URLS = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(`${CACHE_PREFIX}-`) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function shouldHandle(request, url) {
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return false;
  }

  // Future authoring/provider APIs should remain network-owned. Canonical book
  // images are the only API resource required by the offline reader.
  if (
    url.pathname.startsWith("/api/") &&
    !url.pathname.startsWith("/api/content/books/")
  ) {
    return false;
  }

  return true;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    if (request.mode === "navigate") {
      const shell = await cache.match("/");
      if (shell) {
        return shell;
      }
    }

    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!shouldHandle(event.request, url)) {
    return;
  }

  event.respondWith(networkFirst(event.request));
});
