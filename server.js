// Servidor estático: entrega public/ e os módulos de src/ (usados também no navegador).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('.', import.meta.url));
const PASTA_PUBLICA = resolve(raiz, 'public');
const PASTA_SRC = resolve(raiz, 'src');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
};

// Converte o caminho da URL (já decodificado) em arquivo no disco.
// Retorna null se o caminho tentar sair das pastas permitidas.
export function resolverCaminho(caminhoUrl) {
  const emSrc = caminhoUrl.startsWith('/src/');
  const base = emSrc ? PASTA_SRC : PASTA_PUBLICA;
  let relativo = caminhoUrl.slice(emSrc ? '/src/'.length : 1);
  if (relativo === '' || relativo.endsWith('/')) relativo += 'index.html';
  const alvo = resolve(base, relativo);
  if (alvo !== base && !alvo.startsWith(base + sep)) return null;
  return alvo;
}

export function criarServidor() {
  return http.createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    let caminho;
    try {
      caminho = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400).end('Endereço inválido');
      return;
    }
    const alvo = resolverCaminho(caminho);
    if (!alvo) {
      res.writeHead(403).end('Acesso negado');
      return;
    }
    try {
      const dados = await readFile(alvo);
      res.writeHead(200, {
        'Content-Type': TIPOS[extname(alvo)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : dados);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado');
    }
  });
}

const executadoDireto = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (executadoDireto) {
  const porta = Number(process.env.PORT) || 3000;
  criarServidor().listen(porta, () => {
    console.log(`Diário do Rebanho rodando em http://localhost:${porta}`);
  });
}
