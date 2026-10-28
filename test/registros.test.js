import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ordenarRegistros, validarRegistro } from '../src/registros.js';

const HOJE = '2026-10-28';
const base = { tipo: 'venda', categoria: 'cabrito', quantidade: 2, valor: 600, data: '2026-10-20' };

test('registro válido passa', () => {
  const r = validarRegistro(base, HOJE);
  assert.equal(r.ok, true);
  assert.equal(r.registro.valor, 600);
});

test('quantidade zero é rejeitada', () => {
  const r = validarRegistro({ ...base, quantidade: 0 }, HOJE);
  assert.equal(r.ok, false);
  assert.match(r.erros.join(' '), /quantidade/);
});

test('quantidade quebrada é rejeitada', () => {
  assert.equal(validarRegistro({ ...base, quantidade: 1.5 }, HOJE).ok, false);
});

test('valor negativo é rejeitado', () => {
  const r = validarRegistro({ ...base, valor: -10 }, HOJE);
  assert.equal(r.ok, false);
  assert.match(r.erros.join(' '), /negativo/);
});

test('data futura é rejeitada', () => {
  const r = validarRegistro({ ...base, data: '2026-10-29' }, HOJE);
  assert.equal(r.ok, false);
  assert.match(r.erros.join(' '), /futuro/);
});

test('data inexistente é rejeitada', () => {
  assert.equal(validarRegistro({ ...base, data: '2026-02-30' }, HOJE).ok, false);
});

test('animal desconhecido é rejeitado', () => {
  assert.equal(validarRegistro({ ...base, categoria: 'vaca' }, HOJE).ok, false);
});

test('pesagem exige peso', () => {
  assert.equal(validarRegistro({ tipo: 'pesagem', categoria: 'bode', quantidade: 1, data: HOJE }, HOJE).ok, false);
  assert.equal(validarRegistro({ tipo: 'pesagem', categoria: 'bode', quantidade: 1, pesoKg: 42, data: HOJE }, HOJE).ok, true);
});

test('custo exige valor e não precisa de animal', () => {
  assert.equal(validarRegistro({ tipo: 'custo', data: HOJE }, HOJE).ok, false);
  const r = validarRegistro({ tipo: 'custo', valor: 150, descricao: ' ração ', data: HOJE }, HOJE);
  assert.equal(r.ok, true);
  assert.equal(r.registro.categoria, null);
  assert.equal(r.registro.descricao, 'ração');
});

test('nascimento descarta valor', () => {
  const r = validarRegistro({ tipo: 'nascimento', categoria: 'cabrito', quantidade: 1, valor: 100, data: HOJE }, HOJE);
  assert.equal(r.registro.valor, null);
});

test('ordenar coloca o mais recente primeiro', () => {
  const lista = ordenarRegistros([
    { id: 'a', data: '2026-10-01', criadoEm: 1 },
    { id: 'b', data: '2026-10-05', criadoEm: 2 },
    { id: 'c', data: '2026-10-05', criadoEm: 3 },
  ]);
  assert.deepEqual(lista.map((r) => r.id), ['c', 'b', 'a']);
});
