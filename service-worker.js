// ─────────────────────────────────────────────
//  CRM Pro — Service Worker
//  ⚠️  MUDE O NÚMERO DA VERSÃO TODA VEZ que
//      fizer um deploy novo (ex: v5, v6, v7...)
//      Isso força o celular a baixar tudo de novo.
// ─────────────────────────────────────────────
const CACHE_VERSION = 'crm-v6';
const CACHE_STATIC  = `${CACHE_VERSION}-static`;

// Arquivos que ficam em cache offline
const STATIC_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ── INSTALL: abre cache com versão nova e guarda arquivos ──
self.addEventListener('install', event => {
  console.log('[SW] Install:', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_FILES))
      .then(() => self.skipWaiting()) // ← ativa imediatamente, sem esperar fechar abas
  );
});

// ── ACTIVATE: apaga caches ANTIGOS automaticamente ──
self.addEventListener('activate', event => {
  console.log('[SW] Activate:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_STATIC) // tudo que não é a versão atual
          .map(key => {
            console.log('[SW] Deletando cache antigo:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim()) // ← assume controle de todas as abas abertas
  );
});

// ── FETCH: Network First para HTML, Cache First para o resto ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignora requisições externas (Google Fonts, APIs, etc)
  if (url.origin !== location.origin) {
    return; // deixa o browser resolver normalmente
  }

  // Para o HTML principal: sempre tenta a rede primeiro
  // Se offline, serve do cache como fallback
  if (
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/'
  ) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Atualiza o cache com a versão nova baixada
          const clone = response.clone();
          caches.open(CACHE_STATIC).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('./index.html')) // offline: serve do cache
    );
    return;
  }

  // Para demais arquivos (ícones, manifest): cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_STATIC).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});

// ── MENSAGEM: permite forçar update via código JS no app ──
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
