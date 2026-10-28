import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adicionarDias, dataValida, formatarData, formatarNumero, formatarReais, lerData, lerValorDigitado } from '../src/formato.js';

test('formata reais', () => {
  assert.equal(formatarReais(1234.56), 'R$ 1.234,56');
  assert.equal(formatarReais(0), 'R$ 0,00');
  assert.equal(formatarReais(1000000), 'R$ 1.000.000,00');
  assert.equal(formatarReais(0.1 + 0.2), 'R$ 0,30');
});

test('formata números', () => {
  assert.equal(formatarNumero(32), '32');
  assert.equal(formatarNumero(18.5), '18,5');
  assert.equal(formatarNumero(700, 2), '700,00');
});

test('lê valor digitado', () => {
  assert.equal(lerValorDigitado('1.234,56'), 1234.56);
  assert.equal(lerValorDigitado('700'), 700);
  assert.equal(lerValorDigitado('R$ 1.500'), 1500);
  assert.equal(lerValorDigitado('18.5'), 18.5);
  assert.equal(lerValorDigitado(''), null);
  assert.ok(Number.isNaN(lerValorDigitado('abc')));
});

test('datas', () => {
  assert.equal(formatarData('2026-10-28'), '28/10/2026');
  assert.equal(lerData('31/12/2025'), '2025-12-31');
  assert.equal(lerData('31/02/2025'), null);
  assert.equal(dataValida('2024-02-29'), true);
  assert.equal(dataValida('2025-02-29'), false);
  assert.equal(adicionarDias('2026-12-31', 1), '2027-01-01');
});
