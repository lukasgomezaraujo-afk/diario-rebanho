import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarServidor, resolverCaminho } from '../server.js';

test('caminhos fora das pastas permitidas são bloqueados', () => {
  assert.match(resolverCaminho('/'), /public[\\/]index\.html$/);
  assert.match(resolverCaminho('/src/interpretador.js'), /src[\\/]interpretador\.js$/);
  assert.equal(resolverCaminho('/../package.json'), null);
  assert.equal(resolverCaminho('/src/../server.js'), null);
});

test('servidor entrega a página e os módulos', async () => {
  const servidor = criarServidor();
  await new Promise((pronto) => servidor.listen(0, pronto));
  const { port } = servidor.address();
  try {
    const pagina = await fetch(`http://localhost:${port}/`);
    assert.equal(pagina.status, 200);
    assert.match(await pagina.text(), /Diário do Rebanho/);
    const modulo = await fetch(`http://localhost:${port}/src/interpretador.js`);
    assert.equal(modulo.status, 200);
    assert.match(modulo.headers.get('content-type'), /javascript/);
    // A barra codificada (%2f) só vira "/" depois do decode: é o caso que o filtro precisa barrar.
    const fora = await fetch(`http://localhost:${port}/src/..%2fserver.js`);
    assert.equal(fora.status, 403);
    assert.equal((await fetch(`http://localhost:${port}/nao-existe.js`)).status, 404);
    for (const versao of ['/versoes/', '/versoes/v0/', '/versoes/v1/']) {
      const resposta = await fetch(`http://localhost:${port}${versao}`);
      assert.equal(resposta.status, 200, versao);
      assert.match(await resposta.text(), /Diário do Rebanho/, versao);
    }
  } finally {
    servidor.close();
  }
});
