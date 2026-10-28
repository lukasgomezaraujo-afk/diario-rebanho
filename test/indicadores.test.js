import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SEM_DADOS, calcularIndicadores, custoPorCabeca, mediaDeAnimais, periodoAnual, periodoMensal,
  resumoPorEspecie, resumoTexto, saldoAtual, saldoNaData, saldoPorCategoria, taxaMortalidade,
} from '../src/indicadores.js';

const reg = (tipo, categoria, quantidade, data, valor = null) => ({ tipo, categoria, quantidade, data, valor });

test('saldo por categoria soma nascimentos e compras e tira mortes e vendas', () => {
  const tabela = saldoPorCategoria({ cabra: 10, cabrito: 4 }, [
    reg('nascimento', 'cabrito', 3, '2026-01-02'),
    reg('venda', 'cabrito', 2, '2026-01-03', 500),
    reg('morte', 'cabra', 1, '2026-01-04'),
    reg('compra', 'bode', 1, '2026-01-05', 900),
    reg('pesagem', 'cabra', 1, '2026-01-06'),
  ]);
  assert.deepEqual(tabela.cabra, { inicial: 10, nascimentos: 0, compras: 0, mortes: 1, vendas: 0, final: 9 });
  assert.deepEqual(tabela.cabrito, { inicial: 4, nascimentos: 3, compras: 0, mortes: 0, vendas: 2, final: 5 });
  assert.deepEqual(tabela.bode, { inicial: 0, nascimentos: 0, compras: 1, mortes: 0, vendas: 0, final: 1 });
});

test('média diária quando o rebanho muda no período', () => {
  // 20 animais; morrem 2 no dia 3; chegam 10 no dia 9. Saldos: 20,20,18×6,28,28.
  const registros = [reg('morte', 'cabra', 2, '2026-01-03'), reg('compra', 'cabra', 10, '2026-01-09')];
  const m = mediaDeAnimais(20, registros, '2026-01-01', '2026-01-10');
  assert.equal(m.metodo, 'media-diaria');
  assert.equal(m.dias, 10);
  assert.equal(m.final, 28);
  assert.ok(Math.abs(m.media - 20.4) < 1e-9);
  // (inicial + final) / 2 daria 24: por isso a média diária é usada quando há lançamentos.
  assert.ok(Math.abs(taxaMortalidade(2, m.media) - (2 / 20.4) * 100) < 1e-9);
});

test('média por (inicial + final) ÷ 2 quando não há lançamentos', () => {
  const m = mediaDeAnimais(15, [reg('pesagem', 'cabra', 1, '2026-01-02')], '2026-01-01', '2026-01-31');
  assert.equal(m.metodo, 'inicial-final');
  assert.equal(m.media, 15);
});

test('mortalidade sem animais dá "sem dados"', () => {
  assert.equal(taxaMortalidade(0, 0), SEM_DADOS);
});

test('custo por cabeça com custos', () => {
  assert.equal(custoPorCabeca([100, 50], 15), 10);
});

test('custo por cabeça sem custos dá "sem dados", não zero', () => {
  assert.equal(custoPorCabeca([], 15), SEM_DADOS);
  assert.equal(custoPorCabeca([100], 0), SEM_DADOS);
});

test('períodos mensal e anual', () => {
  assert.deepEqual(periodoMensal(2024, 2), { inicio: '2024-02-01', fim: '2024-02-29' });
  assert.deepEqual(periodoMensal(2026, 12), { inicio: '2026-12-01', fim: '2026-12-31' });
  assert.deepEqual(periodoAnual(2026), { inicio: '2026-01-01', fim: '2026-12-31' });
});

test('saldo na data aplica só lançamentos desde a contagem base', () => {
  const base = { data: '2026-03-01', porCategoria: { cabra: 10 } };
  const registros = [
    reg('morte', 'cabra', 5, '2026-02-20'), // antes da contagem: já está nos 10
    reg('nascimento', 'cabrito', 2, '2026-03-01'),
    reg('venda', 'cabra', 1, '2026-03-04'),
  ];
  assert.deepEqual(saldoNaData(base, registros, '2026-03-04'), { cabra: 10, cabrito: 2 });
  assert.deepEqual(saldoNaData(base, registros, '2026-03-05'), { cabra: 9, cabrito: 2 });
});

test('indicadores cortam o período na contagem base e em hoje', () => {
  const base = { data: '2026-03-10', porCategoria: { cabra: 10 } };
  const registros = [reg('morte', 'cabra', 1, '2026-03-12'), { ...reg('custo', null, null, '2026-03-11', 90) }];
  const { inicio, fim } = periodoMensal(2026, 3);
  const ind = calcularIndicadores({ saldoBase: base, registros, inicio, fim, hoje: '2026-03-15' });
  assert.equal(ind.inicio, '2026-03-10');
  assert.equal(ind.fim, '2026-03-15');
  assert.equal(ind.cortado, true);
  assert.equal(ind.mortes, 1);
  assert.equal(ind.tabela.cabra.final, 9);
  // Saldos: dias 10 e 11 com 10, dias 12 a 15 com 9 → 56 / 6.
  assert.ok(Math.abs(ind.media.media - 56 / 6) < 1e-9);
  assert.ok(Math.abs(ind.custoPorCabeca - 90 / (56 / 6)) < 1e-9);
  assert.match(resumoTexto(ind, 'março de 2026'), /Cabras e bodes: 10 → 9 animais/);
});

test('sem contagem inicial, o rebanho é contado do zero pelos lançamentos', () => {
  // O caso do professor: anotou 2 nascimentos e 1 morte e quer ver 1 animal.
  const registros = [reg('nascimento', 'cabrito', 2, '2026-01-05'), reg('morte', 'cabrito', 1, '2026-01-10')];
  assert.deepEqual(saldoAtual(null, registros, '2026-01-31'), { cabrito: 1 });
  const ind = calcularIndicadores({ saldoBase: null, registros, inicio: '2026-01-01', fim: '2026-01-31', hoje: '2026-02-01' });
  assert.equal(ind.erro, undefined);
  assert.equal(ind.semContagemInicial, true);
  assert.equal(ind.porEspecie.caprino.final, 1);
});

test('lançamentos de hoje entram na contagem de hoje', () => {
  assert.deepEqual(saldoAtual(null, [reg('compra', 'vaca', 3, '2026-05-02')], '2026-05-02'), { vaca: 3 });
});

test('resumo separa cabras, ovelhas e vacas', () => {
  const resumo = resumoPorEspecie({ cabra: 7, cabrito: 3, ovelha: 4, vaca: 2, bezerro: 1 });
  assert.equal(resumo.caprino.total, 10);
  assert.deepEqual(resumo.caprino.categorias, { cabra: 7, bode: 0, cabrito: 3, cabrita: 0 });
  assert.equal(resumo.ovino.total, 4);
  assert.equal(resumo.bovino.total, 3);
});

test('resumo deixa de fora a espécie que não aparece', () => {
  assert.deepEqual(Object.keys(resumoPorEspecie({ ovelha: 2 })), ['ovino']);
});

test('relatório calcula a mortalidade de cada espécie separada', () => {
  const base = { data: '2026-01-01', porCategoria: { cabra: 10, vaca: 4 } };
  const registros = [reg('morte', 'cabra', 1, '2026-01-01'), reg('venda', 'vaca', 1, '2026-01-01', 3000)];
  const ind = calcularIndicadores({ saldoBase: base, registros, inicio: '2026-01-01', fim: '2026-01-01', hoje: '2026-01-01' });
  assert.equal(ind.porEspecie.caprino.mortes, 1);
  assert.equal(ind.porEspecie.caprino.final, 9);
  assert.ok(Math.abs(ind.porEspecie.caprino.mortalidade - (1 / 9) * 100) < 1e-9);
  assert.equal(ind.porEspecie.bovino.mortalidade, 0);
  assert.equal(ind.porEspecie.bovino.receitaVendas, 3000);
  assert.equal(ind.porEspecie.ovino, undefined);
});
