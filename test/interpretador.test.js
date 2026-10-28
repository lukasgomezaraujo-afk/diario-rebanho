import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretar, normalizar } from '../src/interpretador.js';

// [frase, tipo, categoria, quantidade, valor, pesoKg, confiança, faltando]
const CASOS = [
  ['nasceram dois cabritos', 'nascimento', 'cabrito', 2, null, null, 'alta', []],
  ['Nasceu uma cabrita', 'nascimento', 'cabrita', 1, null, null, 'alta', []],
  ['a cabra pariu três cabritos', 'nascimento', 'cabrito', 3, null, null, 'alta', []],
  ['deu cria a dois cabritos', 'nascimento', 'cabrito', 2, null, null, 'alta', []],
  ['nasceram meia dúzia de borregos', 'nascimento', 'borrego', 6, null, null, 'alta', []],
  ['nasceram 2 bodes novos', 'nascimento', 'bode', 2, null, null, 'alta', []],
  ['morreu um bode', 'morte', 'bode', 1, null, null, 'alta', []],
  ['morreram 3 ovelhas', 'morte', 'ovelha', 3, null, null, 'alta', []],
  ['morreu a cabra', 'morte', 'cabra', 1, null, null, 'alta', []],
  ['morreram cento e cinquenta cabras', 'morte', 'cabra', 150, null, null, 'alta', []],
  ['vendi três cabritos por setecentos reais', 'venda', 'cabrito', 3, 700, null, 'alta', []],
  ['vendi 2 bodes por R$ 1.500', 'venda', 'bode', 2, 1500, null, 'alta', []],
  ['vendi uma cabra por um conto', 'venda', 'cabra', 1, 1000, null, 'alta', []],
  ['vendi um reprodutor por um conto e meio', 'venda', 'reprodutor', 1, 1500, null, 'alta', []],
  ['comprei duas matrizes de cabra por dois mil e quatrocentos reais', 'compra', 'matriz', 2, 2400, null, 'alta', []],
  ['compramos 5 cabras por 2 mil reais', 'compra', 'cabra', 5, 2000, null, 'alta', []],
  ['vendi três cabritos a 300 reais cada', 'venda', 'cabrito', 3, 900, null, 'alta', []],
  ['vendi um bode de 2 anos por 800 reais', 'venda', 'bode', 1, 800, null, 'alta', []],
  ['pesei o bode, deu trinta e dois quilos', 'pesagem', 'bode', 1, null, 32, 'alta', []],
  ['a cabrita pesou 18,5 kg', 'pesagem', 'cabrita', 1, null, 18.5, 'alta', []],
  ['comprei um carneiro', 'compra', 'carneiro', 1, null, null, 'media', ['valor']],
  ['comprei uma dúzia de ovelhas', 'compra', 'ovelha', 12, null, null, 'media', ['valor']],
  ['vendi dois cabritos por quinhentos', 'venda', 'cabrito', 2, 500, null, 'media', ['valor']],
  ['vendi a cabra a 400', 'venda', 'cabra', 1, 400, null, 'media', ['valor']],
  ['pesei a ovelha', 'pesagem', 'ovelha', 1, null, null, 'media', ['pesoKg']],
  ['morreu cabrito', 'morte', 'cabrito', 1, null, null, 'media', ['quantidade']],
  // Confiança baixa
  ['vendi dois cabritos por quinhentos conto', 'venda', 'cabrito', 2, null, null, 'baixa', ['valor']],
  ['vendi uns cabritos', 'venda', 'cabrito', null, null, null, 'baixa', ['quantidade', 'valor']],
  ['nasceram cabritos', 'nascimento', 'cabrito', null, null, null, 'baixa', ['quantidade']],
  ['nasceram dois', 'nascimento', 'desconhecida', 2, null, null, 'baixa', ['categoria']],
  ['a cabra pariu gêmeos', 'nascimento', 'desconhecida', 2, null, null, 'baixa', ['categoria']],
  ['nasceu um cabrito e uma cabrita', 'nascimento', 'desconhecida', 1, null, null, 'baixa', ['categoria']],
  ['comprei e vendi cabras', 'desconhecido', 'cabra', null, null, null, 'baixa', ['tipo', 'quantidade']],
  ['bom dia, tudo bem?', 'desconhecido', 'desconhecida', null, null, null, 'baixa', ['tipo', 'categoria', 'quantidade']],
  ['', 'desconhecido', 'desconhecida', null, null, null, 'baixa', ['tipo', 'categoria', 'quantidade']],
];

for (const [frase, tipo, categoria, quantidade, valor, pesoKg, confianca, faltando] of CASOS) {
  test(`interpreta "${frase}"`, () => {
    const r = interpretar(frase);
    assert.deepEqual(
      { tipo: r.tipo, categoria: r.categoria, quantidade: r.quantidade, valor: r.valor, pesoKg: r.pesoKg, confianca: r.confianca, faltando: r.faltando },
      { tipo, categoria, quantidade, valor, pesoKg, confianca, faltando },
    );
  });
}

test('tem pelo menos 25 frases e 5 de confiança baixa', () => {
  assert.ok(CASOS.length >= 25);
  assert.ok(CASOS.filter((c) => c[6] === 'baixa').length >= 5);
});

test('"quinhentos conto" explica o problema ao produtor', () => {
  const r = interpretar('vendi dois cabritos por quinhentos conto');
  assert.ok(r.avisos.some((a) => a.includes('quinhentos conto')));
});

test('entrada nula ou não textual não quebra', () => {
  assert.equal(interpretar(null).confianca, 'baixa');
  assert.equal(interpretar(undefined).tipo, 'desconhecido');
  assert.equal(interpretar(42).confianca, 'baixa');
});

test('normalizar tira acentos, pontuação e converte R$', () => {
  assert.equal(normalizar('Vendi TRÊS cabritos, por R$ 1.250,50!'), 'vendi tres cabritos por 1.250,50 reais');
  assert.equal(normalizar('pesou 30kg.'), 'pesou 30 kg');
});
