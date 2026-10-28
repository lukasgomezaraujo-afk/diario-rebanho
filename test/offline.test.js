import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARQUIVOS } from '../public/arquivos-offline.js';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = join(raiz, 'public');
const SRC = join(raiz, 'src');
// Fora da lista de propósito: o próprio service worker, documentação e os arquivos de voz,
// que são colocados à mão e guardados no celular na primeira vez que forem usados.
const IGNORADOS = [/^sw\.js$/, /\.md$/, /^modelo-pt\//, /^vendor\//];

async function listar(pasta) {
  const itens = await readdir(pasta, { recursive: true, withFileTypes: true });
  return itens.filter((i) => i.isFile()).map((i) => relative(pasta, join(i.parentPath ?? i.path, i.name)).split(sep).join('/'));
}

// "versoes/v0/index.html" é pedido pelo navegador como "versoes/v0/".
const comoUrl = (caminho) => (caminho === 'index.html' ? caminho : caminho.replace(/(^|\/)index\.html$/, '$1'));

test('todo arquivo do app está na lista offline', async () => {
  const doApp = (await listar(PUBLIC)).filter((c) => !IGNORADOS.some((padrao) => padrao.test(c))).map(comoUrl);
  const deSrc = (await listar(SRC)).map((c) => `src/${c}`);
  const faltando = [...doApp, ...deSrc].filter((c) => !ARQUIVOS.includes(c));
  assert.deepEqual(faltando, []);
});

test('todo item da lista offline existe', async () => {
  for (const item of ARQUIVOS.filter((a) => a !== './')) {
    const caminho = item.startsWith('src/') ? join(raiz, item) : join(PUBLIC, item.endsWith('/') ? `${item}index.html` : item);
    await assert.doesNotReject(stat(caminho), item);
  }
});

test('manifesto do app é válido e aponta para ícones existentes', async () => {
  const manifesto = JSON.parse(await readFile(join(PUBLIC, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifesto.start_url, './');
  assert.equal(manifesto.display, 'standalone');
  for (const tamanho of ['192x192', '512x512']) assert.ok(manifesto.icons.some((i) => i.sizes === tamanho), tamanho);
  for (const icone of manifesto.icons) await assert.doesNotReject(stat(join(PUBLIC, icone.src)), icone.src);
});

test('nenhum caminho absoluto: o app precisa funcionar numa subpasta do GitHub Pages', async () => {
  for (const arquivo of (await listar(PUBLIC)).filter((c) => /\.(html|js)$/.test(c))) {
    const texto = await readFile(join(PUBLIC, arquivo), 'utf8');
    assert.doesNotMatch(texto, /(from\s+|src=|href=)["']\/(?!\/)/, arquivo);
  }
});
