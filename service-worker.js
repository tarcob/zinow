const CACHE_NAME = 'zino world-v10'; // Atualize a versão do cache
const ASSETS = [
  '/',
  '/index.html?v=10', // Adicione parâmetro de versão
  '/css/style.css?v=10',
  '/js/game.js?v=10',
  // ... outros assets
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()) // Força a ativação imediata
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache); // Remove caches antigos
          }
        })
      );
    }).then(() => self.clients.claim()) // Assume controle imediato
  );
});