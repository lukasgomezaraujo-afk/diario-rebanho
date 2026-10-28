// Service worker: guarda o app no celular para abrir sem internet.
import { ARQUIVOS, VERSAO_CACHE } from './arquivos-offline.js';

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSAO_CACHE)
      .then((cache) => cache.addAll(ARQUIVOS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((nome) => nome !== VERSAO_CACHE).map((nome) => caches.delete(nome))))
      .then(() => self.clients.claim()),
  );
});

// Responde na hora com a cópia guardada e, se houver internet, atualiza a cópia por trás.
// Assim o app abre no curral sem sinal e pega as melhorias quando o celular conectar.
self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  evento.respondWith(caches.open(VERSAO_CACHE).then(async (cache) => {
    const guardada = await cache.match(request, { ignoreSearch: true });
    const daRede = fetch(request).then((resposta) => {
      if (resposta.ok) cache.put(request, resposta.clone());
      return resposta;
    });
    if (guardada) {
      evento.waitUntil(daRede.catch(() => {}));
      return guardada;
    }
    try {
      return await daRede;
    } catch {
      if (request.mode === 'navigate') return (await cache.match('./')) ?? Response.error();
      return Response.error();
    }
  }));
});
