import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  animaisNoRebanho, historicoDoAnimal, registroDeEntrada, situacaoDoAnimal, somarNaContagem, ultimaPesagem, validarAnimal,
} from '../src/animais.js';

const HOJE = '2026-10-28';
const malhada = { id: 'a1', identificacao: 'Malhada', categoria: 'cabra', entrada: 'ja-estava', data: '2026-10-01' };
const reg = (tipo, data, extra = {}) => ({ tipo, categoria: 'cabra', quantidade: 1, data, animalId: 'a1', criadoEm: 1, ...extra });

test('cadastro válido passa e limpa os espaços', () => {
  const r = validarAnimal({ ...malhada, identificacao: '  Malhada  ' }, HOJE);
  assert.equal(r.ok, true);
  assert.equal(r.animal.identificacao, 'Malhada');
});

test('cadastro exige nome, animal, entrada e data válida', () => {
  const r = validarAnimal({ identificacao: '', categoria: 'matriz', entrada: 'achei', data: '2026-10-29' }, HOJE);
  assert.equal(r.ok, false);
  assert.equal(r.erros.length, 4);
});

test('não deixa dois animais com o mesmo nome no rebanho', () => {
  const r = validarAnimal({ ...malhada, id: 'a2', identificacao: 'malhada' }, HOJE, [malhada]);
  assert.equal(r.ok, false);
  assert.match(r.erros[0], /mesmo nome|Já existe/);
});

test('o nome volta a ficar livre depois que o animal sai do rebanho', () => {
  const r = validarAnimal({ ...malhada, id: 'a2' }, HOJE, [malhada], [reg('venda', '2026-10-10')]);
  assert.equal(r.ok, true);
});

test('situação segue o último lançamento de saída', () => {
  assert.equal(situacaoDoAnimal(malhada, []).situacao, 'no-rebanho');
  assert.deepEqual(situacaoDoAnimal(malhada, [reg('pesagem', '2026-10-02', { pesoKg: 40 }), reg('morte', '2026-10-05')]), { situacao: 'morreu', data: '2026-10-05' });
  assert.equal(situacaoDoAnimal(malhada, [reg('venda', '2026-10-05')]).situacao, 'vendido');
  assert.equal(animaisNoRebanho([malhada], [reg('venda', '2026-10-05')]).length, 0);
});

test('histórico e última pesagem ficam em ordem de data', () => {
  const registros = [reg('pesagem', '2026-10-20', { pesoKg: 44 }), reg('pesagem', '2026-10-02', { pesoKg: 40 }), reg('pesagem', '2026-10-09', { animalId: 'outro', pesoKg: 99 })];
  assert.deepEqual(historicoDoAnimal('a1', registros).map((r) => r.pesoKg), [40, 44]);
  assert.deepEqual(ultimaPesagem('a1', registros), { pesoKg: 44, data: '2026-10-20' });
  assert.equal(ultimaPesagem('a2', registros), null);
});

test('"nasceu aqui" e "comprei" geram lançamento; "já estava" não', () => {
  assert.equal(registroDeEntrada(malhada), null);
  assert.deepEqual(registroDeEntrada({ ...malhada, entrada: 'compra' }, 450), { tipo: 'compra', categoria: 'cabra', quantidade: 1, valor: 450, data: '2026-10-01', animalId: 'a1' });
  assert.equal(registroDeEntrada({ ...malhada, entrada: 'nascimento' }, 450).valor, null);
});

test('"já estava" soma o animal na contagem inicial', () => {
  assert.deepEqual(somarNaContagem(null, 'cabra').porCategoria, { cabra: 1 });
  const base = { data: '2026-09-01', porCategoria: { cabra: 4 } };
  assert.deepEqual(somarNaContagem(base, 'cabra'), { data: '2026-09-01', porCategoria: { cabra: 5 } });
  assert.deepEqual(base.porCategoria, { cabra: 4 });
});
