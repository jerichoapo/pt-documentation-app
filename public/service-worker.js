/* eslint-disable no-restricted-globals */
// A minimal service worker so Chrome offers to install the app and the shell
// opens without a network round trip when the connection is poor.
//
// - Page loads go to the network first, so a new deploy shows on the next
//   launch. The last good index.html is the fallback.
// - Nothing else is cached here. Hashed files under /static/ are already
//   cached by the browser, and requests to Supabase or any other origin are
//   never touched, so patient data always comes from the network.

const CACHE = 'pt-notes-shell-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put('/index.html', response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match('/index.html');
      return cached || Response.error();
    }
  })());
});
