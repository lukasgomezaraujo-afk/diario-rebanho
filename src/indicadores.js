// Indicadores do rebanho. Funções puras: recebem dados, devolvem números.
import { adicionarDias, formatarData, formatarNumero, formatarReais } from './formato.js';
import { nomeCategoria } from './rotulos.js';

export const SEM_DADOS = 'sem dados';

const SINAL = { nascimento: 1, compra: 1, morte: -1, venda: -1 };
const CAMPO = { nascimento: 'nascimentos', compra: 'compras', morte: 'mortes', venda: 'vendas' };

export function efeitoNoSaldo(registro) {
  return (SINAL[registro.tipo] ?? 0) * (registro.quantidade ?? 0);
}

const somar = (numeros) => numeros.reduce((total, n) => total + n, 0);

// final = inicial + nascimentos + compras − mortes − vendas, por categoria.
export function saldoPorCategoria(saldoInicial, registros) {
  const tabela = {};
  const linha = (categoria) => {
    tabela[categoria] ??= { inicial: 0, nascimentos: 0, compras: 0, mortes: 0, vendas: 0, final: 0 };
    return tabela[categoria];
  };
  for (const [categoria, quantidade] of Object.entries(saldoInicial ?? {})) {
    linha(categoria).inicial = quantidade;
  }
  for (const registro of registros) {
    const campo = CAMPO[registro.tipo];
    if (campo && registro.categoria) linha(registro.categoria)[campo] += registro.quantidade;
  }
  for (const l of Object.values(tabela)) {
    l.final = l.inicial + l.nascimentos + l.compras - l.mortes - l.vendas;
  }
  return tabela;
}

// Contagem no começo do dia `dataIso`, a partir da contagem base (começo do dia `saldoBase.data`).
// Lançamentos anteriores à data base já estão dentro da contagem base.
export function saldoNaData(saldoBase, registros, dataIso) {
  const entre = registros.filter((r) => r.data >= saldoBase.data && r.data < dataIso);
  const tabela = saldoPorCategoria(saldoBase.porCategoria, entre);
  return Object.fromEntries(Object.entries(tabela).map(([categoria, l]) => [categoria, l.final]));
}

// Média de animais no período. Com lançamentos que mudam o rebanho, usa a média dos saldos
// de cada dia (saldo no fim do dia). Sem lançamentos, usa (inicial + final) ÷ 2.
export function mediaDeAnimais(inicialTotal, registrosDoPeriodo, inicio, fim) {
  const comEfeito = registrosDoPeriodo.filter((r) => efeitoNoSaldo(r) !== 0);
  const final = inicialTotal + somar(comEfeito.map(efeitoNoSaldo));
  if (comEfeito.length === 0) {
    return { media: (inicialTotal + final) / 2, metodo: 'inicial-final', inicial: inicialTotal, final };
  }
  const porDia = new Map();
  for (const r of comEfeito) porDia.set(r.data, (porDia.get(r.data) ?? 0) + efeitoNoSaldo(r));
  let saldo = inicialTotal;
  let soma = 0;
  let dias = 0;
  for (let dia = inicio; dia <= fim; dia = adicionarDias(dia, 1)) {
    saldo += porDia.get(dia) ?? 0;
    soma += saldo;
    dias += 1;
  }
  return { media: soma / dias, metodo: 'media-diaria', inicial: inicialTotal, final, dias };
}

// Mortes a cada 100 animais.
export function taxaMortalidade(mortes, media) {
  return media > 0 ? (mortes / media) * 100 : SEM_DADOS;
}

export function custoPorCabeca(custos, media) {
  if (custos.length === 0 || !(media > 0)) return SEM_DADOS;
  return somar(custos) / media;
}

export function periodoMensal(ano, mes) {
  const mm = String(mes).padStart(2, '0');
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return { inicio: `${ano}-${mm}-01`, fim: `${ano}-${mm}-${String(ultimoDia).padStart(2, '0')}` };
}

export function periodoAnual(ano) {
  return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
}

// Junta tudo para a tela de indicadores. O período é cortado para começar na data do saldo
// inicial e terminar hoje, porque antes e depois disso não há contagem conhecida.
export function calcularIndicadores({ saldoBase, registros, inicio, fim, hoje }) {
  if (!saldoBase) return { erro: 'Informe quantos animais você tem para calcular os indicadores.' };
  const ini = inicio < saldoBase.data ? saldoBase.data : inicio;
  const fimReal = fim > hoje ? hoje : fim;
  if (ini > fimReal) return { erro: 'Não há dados para este período.' };

  const inicialPorCategoria = saldoNaData(saldoBase, registros, ini);
  const doPeriodo = registros.filter((r) => r.data >= ini && r.data <= fimReal);
  const tabela = saldoPorCategoria(inicialPorCategoria, doPeriodo);
  const media = mediaDeAnimais(somar(Object.values(inicialPorCategoria)), doPeriodo, ini, fimReal);
  const mortes = somar(doPeriodo.filter((r) => r.tipo === 'morte').map((r) => r.quantidade));
  const custos = doPeriodo.filter((r) => r.tipo === 'custo').map((r) => r.valor);
  const valores = (tipo) => somar(doPeriodo.filter((r) => r.tipo === tipo && r.valor !== null).map((r) => r.valor));

  return {
    inicio: ini,
    fim: fimReal,
    cortado: ini !== inicio || fimReal !== fim,
    tabela,
    media,
    mortes,
    mortalidade: taxaMortalidade(mortes, media.media),
    custoTotal: somar(custos),
    custoPorCabeca: custoPorCabeca(custos, media.media),
    vendas: valores('venda'),
    compras: valores('compra'),
  };
}

const porcentagem = (valor) => (valor === SEM_DADOS ? SEM_DADOS : `${formatarNumero(valor, 1)}%`);
const reais = (valor) => (valor === SEM_DADOS ? SEM_DADOS : formatarReais(valor));

// Texto simples para copiar e mandar no WhatsApp.
export function resumoTexto(indicadores, titulo) {
  const ind = indicadores;
  const linhas = [`Diário do Rebanho: ${titulo}`, `Período: ${formatarData(ind.inicio)} a ${formatarData(ind.fim)}`, ''];
  for (const [categoria, l] of Object.entries(ind.tabela)) {
    linhas.push(`${nomeCategoria(categoria, 2)}: ${l.inicial} → ${l.final} (nasc. ${l.nascimentos}, compras ${l.compras}, mortes ${l.mortes}, vendas ${l.vendas})`);
  }
  linhas.push(
    '',
    `Média de animais: ${formatarNumero(ind.media.media, 1)}`,
    `Mortalidade: ${porcentagem(ind.mortalidade)} (${ind.mortes} mortes)`,
    `Custo por cabeça: ${reais(ind.custoPorCabeca)}`,
    `Vendas: ${formatarReais(ind.vendas)} | Compras: ${formatarReais(ind.compras)} | Custos: ${formatarReais(ind.custoTotal)}`,
  );
  return linhas.join('\n');
}
