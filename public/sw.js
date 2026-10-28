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

// Com internet, busca a versão nova (e guarda a cópia). Sem resposta em 3 segundos, ou sem
// sinal, usa a cópia guardada: o app abre no curral e mostra as melhorias assim que houver rede.
const ESPERA_REDE_MS = 3000;

self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  evento.respondWith(caches.open(VERSAO_CACHE).then(async (cache) => {
    const daRede = fetch(request).then((resposta) => {
      if (resposta.ok) cache.put(request, resposta.clone());
      return resposta;
    });
    const guardada = await cache.match(request, { ignoreSearch: true });
    if (!guardada) {
      try {
        return await daRede;
      } catch {
        if (request.mode === 'navigate') return (await cache.match('./')) ?? Response.error();
        return Response.error();
      }
    }
    const tempoEsgotado = new Promise((responder) => setTimeout(() => responder(null), ESPERA_REDE_MS));
    try {
      const resposta = await Promise.race([daRede, tempoEsgotado]);
      if (resposta?.ok) return resposta;
    } catch {
      // Sem rede: segue para a cópia guardada.
    }
    evento.waitUntil(daRede.catch(() => {}));
    return guardada;
  }));
});
