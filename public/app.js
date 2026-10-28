// Interface do Diário do Rebanho. Só cuida da tela: as regras ficam em /src.
import { interpretar } from './src/interpretador.js';
import {
  CATEGORIAS_POR_ESPECIE, ESPECIES, ESPECIE_DA_CATEGORIA, EXPLICACOES, NOMES_ESPECIE, ROTULOS_TIPO, TIPOS, TIPOS_REGISTRO,
  descrever, nomeCategoria,
} from './src/rotulos.js';
import { ordenarRegistros, validarRegistro } from './src/registros.js';
import {
  SEM_DADOS, calcularIndicadores, periodoAnual, periodoMensal, resumoPorEspecie, resumoTexto, saldoAtual, temContagemInicial,
} from './src/indicadores.js';
import {
  ENTRADAS, animaisNoRebanho, historicoDoAnimal, registroDeEntrada, situacaoDoAnimal, somarNaContagem, ultimaPesagem, validarAnimal,
} from './src/animais.js';
import { formatarData, formatarNumero, formatarReais, isoDeData, lerValorDigitado } from './src/formato.js';
import { ouvir, verificarVoz } from './voz.js';

const CHAVE = 'diario-rebanho:v1';
const TELAS = ['aviso', 'inicio', 'voz', 'rapido', 'lancamentos', 'relatorio', 'animais', 'animal', 'novo-animal'];
const ROTULO_ACAO = { nascimento: 'Nasceu', morte: 'Morreu', compra: 'Comprei', venda: 'Vendi', pesagem: 'Pesei', custo: 'Gasto' };
const ROTULO_CONFIANCA = { alta: 'alta', media: 'média', baixa: 'baixa' };
const ROTULO_SITUACAO = { 'no-rebanho': 'No rebanho', vendido: 'Vendido', morreu: 'Morreu' };
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const COM_VALOR = ['compra', 'venda', 'custo'];
// Categorias que existiam antes da separação por espécie.
const CATEGORIAS_ANTIGAS = { matriz: 'cabra', reprodutor: 'bode' };

const $ = (seletor) => document.querySelector(seletor);
const hoje = () => isoDeData(new Date());
const capital = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);
const esc = (texto) => String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

let estado = carregar();
let rascunho = null; // lançamento sendo preenchido no registro rápido
let entendido = null; // lançamento vindo de uma frase
let novoAnimal = null; // animal sendo cadastrado
let animalAberto = null; // id do animal na tela de detalhe
let pararDeOuvir = null;
let editandoSaldo = false;
const agora = new Date();
const periodo = { modo: 'mensal', ano: agora.getFullYear(), mes: agora.getMonth() + 1 };

// ---------- Armazenamento ----------

function migrarCategoria(categoria) {
  return CATEGORIAS_ANTIGAS[categoria] ?? categoria;
}

function carregar() {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAVE));
    if (dados && Array.isArray(dados.registros)) {
      const registros = dados.registros.map((r) => ({ ...r, categoria: r.categoria ? migrarCategoria(r.categoria) : r.categoria }));
      let saldoBase = dados.saldoBase ?? null;
      if (saldoBase) {
        const porCategoria = {};
        for (const [c, n] of Object.entries(saldoBase.porCategoria)) porCategoria[migrarCategoria(c)] = (porCategoria[migrarCategoria(c)] ?? 0) + n;
        saldoBase = { ...saldoBase, porCategoria };
      }
      return { avisoVisto: false, animais: [], ...dados, registros, saldoBase };
    }
  } catch {
    // Sem armazenamento ou dado corrompido: começa vazio.
  }
  return { registros: [], animais: [], saldoBase: null, avisoVisto: false };
}

function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
    return true;
  } catch {
    avisar('Não consegui guardar neste aparelho. Exporte os dados para não perder.');
    return false;
  }
}

function gravarRegistro(registro) {
  const indice = estado.registros.findIndex((r) => r.id === registro.id);
  if (indice >= 0) estado.registros[indice] = registro;
  else estado.registros.push(registro);
  salvar();
}

const animalPorId = (id) => estado.animais.find((a) => a.id === id);

// ---------- Navegação ----------

function irPara(tela, { historico = true } = {}) {
  if (tela === 'indicadores') tela = 'relatorio';
  if (!TELAS.includes(tela)) tela = 'inicio';
  if (tela === 'animal' && !animalPorId(animalAberto)) tela = 'animais';
  if (!estado.avisoVisto) tela = 'aviso';
  if (tela !== 'voz') pararGravacao();
  document.querySelectorAll('[data-tela]').forEach((secao) => { secao.hidden = secao.dataset.tela !== tela; });
  if (tela === 'inicio') renderInicio();
  if (tela === 'voz') abrirVoz();
  if (tela === 'rapido') abrirRapido();
  if (tela === 'lancamentos') renderLancamentos();
  if (tela === 'relatorio') renderRelatorio();
  if (tela === 'animais') renderAnimais();
  if (tela === 'animal') renderAnimal();
  if (tela === 'novo-animal') abrirNovoAnimal();
  window.scrollTo(0, 0);
  if (historico && location.hash !== `#${tela}`) history.pushState(null, '', `#${tela}`);
}

window.addEventListener('popstate', () => irPara(location.hash.slice(1), { historico: false }));

let temporizador = null;
function avisar(texto) {
  const caixa = $('#mensagem');
  caixa.textContent = texto;
  caixa.hidden = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { caixa.hidden = true; }, 4500);
}

// Os botões respondem direto: o evento "close" do <dialog> pode chegar atrasado
// e entregar a resposta de uma pergunta à pergunta seguinte.
let responderConfirmacao = null;

function confirmar(texto, rotuloSim) {
  responderConfirmacao?.(false);
  $('#confirmar-texto').textContent = texto;
  $('#confirmar-sim').textContent = rotuloSim;
  $('#confirmar').showModal();
  return new Promise((responder) => { responderConfirmacao = responder; });
}

function fecharConfirmacao(resposta) {
  const responder = responderConfirmacao;
  responderConfirmacao = null;
  if ($('#confirmar').open) $('#confirmar').close();
  responder?.(resposta);
}

$('#confirmar').addEventListener('cancel', () => fecharConfirmacao(false));

const chip = (campo, valor, rotulo, ativo, detalhe = '') =>
  `<button type="button" class="chip${ativo ? ' ativo' : ''}" data-campo="${campo}" data-valor="${esc(valor)}" aria-pressed="${ativo}">${esc(rotulo)}${detalhe ? `<small>${esc(detalhe)}</small>` : ''}</button>`;

const icone = (nome) => `<svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${nome}"/></svg>`;

// Chip de tipo com a mesma cor e ícone do botão da tela inicial.
const chipTipo = (campo, tipo, ativo) =>
  `<button type="button" class="chip tipo-${tipo}${ativo ? ' ativo' : ''}" data-campo="${campo}" data-valor="${tipo}" aria-pressed="${ativo}">${icone(tipo)}${ROTULO_ACAO[tipo]}</button>`;

// Categorias separadas por espécie, para cabra, ovelha e vaca não ficarem misturadas.
const chipsPorEspecie = (campo, ativo) => ESPECIES.map((especie) => `
  <p class="especie-titulo">${NOMES_ESPECIE[especie]}</p>
  <div class="chips categorias">${CATEGORIAS_POR_ESPECIE[especie].map((c) => chip(campo, c, capital(nomeCategoria(c, 1)), ativo === c, EXPLICACOES[c])).join('')}</div>`).join('');

const mostrarErros = (seletor, erros) => { $(seletor).innerHTML = erros.map((e) => `<p>${esc(e)}</p>`).join(''); };

// ---------- Início: o rebanho hoje ----------

function renderInicio() {
  const resumo = resumoPorEspecie(saldoAtual(estado.saldoBase, estado.registros, hoje()));
  const especies = Object.entries(resumo);
  const alvo = $('#rebanho-hoje');
  if (especies.length === 0) {
    alvo.innerHTML = `
      <h2>Seu rebanho hoje</h2>
      <p class="dica-esquerda">Ainda não há animais anotados. Toque em Nasceu ou Comprei, ou conte os que você já tem.</p>
      <button class="btn" data-acao="contar">Contar os animais que já tenho</button>`;
    return;
  }
  alvo.innerHTML = `
    <h2>Seu rebanho hoje</h2>
    ${especies.map(([especie, e]) => `
      <div class="especie-hoje">
        <div class="especie-total"><span>${NOMES_ESPECIE[especie]}</span><strong>${e.total}</strong></div>
        <p class="especie-detalhe">${Object.entries(e.categorias).filter(([, n]) => n !== 0).map(([c, n]) => `${nomeCategoria(c, n)} ${n}`).join(' · ') || 'nenhum animal agora'}</p>
      </div>`).join('')}
    ${temContagemInicial(estado.saldoBase) ? '' : '<p class="dica-esquerda">Contando só o que você anotou. <button class="link" data-acao="contar">Informar os animais que você já tinha</button></p>'}`;
}

// ---------- Registro por voz ou frase ----------

async function abrirVoz() {
  const caixa = $('#voz-estado');
  caixa.className = 'caixa';
  caixa.textContent = 'Verificando a voz…';
  const voz = await verificarVoz();
  if (voz.ok) {
    caixa.innerHTML = `<button class="btn principal falar" data-acao="gravar" id="botao-gravar">${icone('microfone')}<span>Tocar e falar</span></button>`;
  } else {
    caixa.className = 'caixa alerta';
    caixa.innerHTML = `<p><strong>${esc(voz.motivo)}</strong></p><p>Escreva a frase aqui embaixo ou use o registro rápido.</p><button class="btn" data-ir="rapido">Ir para o registro rápido</button>`;
  }
  renderEntendido();
}

async function alternarGravacao() {
  if (pararDeOuvir) {
    pararGravacao();
    return;
  }
  const botao = $('#botao-gravar');
  const transcricao = $('#transcricao');
  try {
    pararDeOuvir = await ouvir({
      aoParcial: (texto) => { transcricao.hidden = false; transcricao.textContent = texto || '…'; },
      aoFinal: (texto) => {
        if (!texto) { avisar('Não ouvi nada. Tente de novo, perto do celular.'); return; }
        $('#frase').value = texto;
        entender();
      },
    });
    botao.classList.add('ouvindo');
    botao.querySelector('span').textContent = 'Parar';
  } catch (erro) {
    pararDeOuvir = null;
    avisar(`A voz falhou: ${erro.message}. Escreva a frase ou use o registro rápido.`);
  }
}

function pararGravacao() {
  if (!pararDeOuvir) return;
  pararDeOuvir();
  pararDeOuvir = null;
  const botao = $('#botao-gravar');
  if (botao) {
    botao.classList.remove('ouvindo');
    botao.querySelector('span').textContent = 'Tocar e falar';
  }
}

function entender() {
  const texto = $('#frase').value;
  const i = interpretar(texto);
  entendido = {
    tipo: i.tipo === 'desconhecido' ? null : i.tipo,
    categoria: i.categoria === 'desconhecida' ? null : i.categoria,
    quantidade: i.quantidade,
    valorTexto: i.valor !== null ? formatarNumero(i.valor, 2) : '',
    pesoTexto: i.pesoKg !== null ? formatarNumero(i.pesoKg) : '',
    interpretacao: i,
  };
  renderEntendido();
}

function registroDe(fonte) {
  return {
    tipo: fonte.tipo,
    categoria: fonte.categoria,
    quantidade: fonte.quantidade,
    valor: COM_VALOR.includes(fonte.tipo) ? lerValorDigitado(fonte.valorTexto) : null,
    pesoKg: fonte.tipo === 'pesagem' ? lerValorDigitado(fonte.pesoTexto) : null,
    descricao: fonte.descricao ?? '',
    data: fonte.data ?? hoje(),
    animalId: fonte.animalId ?? null,
  };
}

function fraseEntendida() {
  const r = registroDe(entendido);
  return r.tipo && r.categoria ? descrever({ ...r, valor: Number.isFinite(r.valor) ? r.valor : null }) : 'ainda falta informação';
}

function renderEntendido() {
  const alvo = $('#interpretacao');
  if (!entendido) { alvo.innerHTML = ''; return; }
  const i = entendido.interpretacao;
  const falta = new Set(i.faltando);
  const pedeValor = falta.has('valor') || (falta.has('tipo') && ['compra', 'venda'].includes(entendido.tipo));
  const pedePeso = falta.has('pesoKg') || (falta.has('tipo') && entendido.tipo === 'pesagem');
  const partes = [`<div class="caixa confianca-${i.confianca}">`];
  partes.push(`<p class="certeza">Certeza: ${ROTULO_CONFIANCA[i.confianca]}</p>`);
  partes.push(`<p class="entendi">Entendi: <strong id="frase-entendida">${esc(fraseEntendida())}</strong>. Está certo?</p>`);
  if (i.avisos.length) partes.push(`<ul class="avisos">${i.avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`);
  if (falta.has('tipo')) {
    partes.push(`<p class="rotulo">O que aconteceu?</p><div class="chips">${TIPOS.map((t) => chipTipo('voz-tipo', t, entendido.tipo === t)).join('')}</div>`);
  }
  if (falta.has('categoria')) {
    partes.push(`<p class="rotulo">Qual animal?</p>${chipsPorEspecie('voz-categoria', entendido.categoria)}`);
  }
  if (falta.has('quantidade')) {
    partes.push(`<label class="rotulo" for="voz-quantidade">Quantos animais?</label><input id="voz-quantidade" type="number" inputmode="numeric" min="1" step="1" value="${entendido.quantidade ?? ''}">`);
  }
  if (pedeValor) {
    partes.push(`<label class="rotulo" for="voz-valor">Valor total em R$ (deixe vazio se não souber)</label><input id="voz-valor" inputmode="decimal" value="${esc(entendido.valorTexto)}" autocomplete="off">`);
  }
  if (pedePeso) {
    partes.push(`<label class="rotulo" for="voz-peso">Peso em kg</label><input id="voz-peso" inputmode="decimal" value="${esc(entendido.pesoTexto)}" autocomplete="off">`);
  }
  partes.push('<div id="erros-voz" class="erros" role="alert"></div>');
  partes.push('<div class="acoes"><button class="btn" data-acao="corrigir-voz">Não, corrigir</button><button class="btn principal" data-acao="salvar-voz">Sim, salvar</button></div></div>');
  alvo.innerHTML = partes.join('');
}

function salvarEntendido() {
  const r = validarRegistro({ ...registroDe(entendido), id: novoId(), criadoEm: Date.now() }, hoje());
  if (!r.ok) {
    mostrarErros('#erros-voz', r.erros);
    return;
  }
  gravarRegistro(r.registro);
  avisar(`Salvo: ${descrever(r.registro)}.`);
  entendido = null;
  $('#frase').value = '';
  $('#transcricao').hidden = true;
  renderEntendido();
}

// ---------- Registro rápido ----------

function novoRascunho(dados = {}) {
  rascunho = {
    id: null, tipo: null, categoria: null, quantidade: null, valorTexto: '', pesoTexto: '', descricao: '',
    data: hoje(), criadoEm: null, animalId: null, nomeNovo: '', ...dados,
  };
}

function abrirRapido() {
  if (!rascunho) novoRascunho();
  $('#titulo-rapido').textContent = rascunho.id ? 'Corrigir lançamento' : 'Registro rápido';
  $('#qtd-outro').value = rascunho.quantidade > 6 ? rascunho.quantidade : '';
  $('#valor').value = rascunho.valorTexto;
  $('#descricao').value = rascunho.descricao;
  $('#peso').value = rascunho.pesoTexto;
  $('#nome-novo').value = rascunho.nomeNovo;
  $('#data').value = rascunho.data;
  $('#data').max = hoje();
  $('#erros-rapido').textContent = '';
  atualizarRapido();
}

// Animais identificados que podem estar neste lançamento (mesma categoria, ainda no rebanho).
function animaisPossiveis(r) {
  return animaisNoRebanho(estado.animais, estado.registros)
    .filter((a) => a.categoria === r.categoria || a.id === r.animalId);
}

function atualizarRapido() {
  const r = rascunho;
  const comAnimal = r.tipo && r.tipo !== 'custo';
  const pronto = r.tipo === 'custo' || Boolean(comAnimal && r.categoria && r.quantidade);
  const umSo = pronto && comAnimal && r.quantidade === 1;
  const entraNovo = umSo && (r.tipo === 'nascimento' || r.tipo === 'compra') && !r.id;
  const possiveis = umSo && !entraNovo ? animaisPossiveis(r) : [];
  $('#chips-tipo').innerHTML = TIPOS_REGISTRO.map((t) => chipTipo('tipo', t, r.tipo === t)).join('');
  $('#chips-categoria').innerHTML = chipsPorEspecie('categoria', r.categoria);
  $('#chips-quantidade').innerHTML = [1, 2, 3, 4, 5, 6].map((n) => chip('quantidade', n, n, r.quantidade === n)).join('');
  $('#grupo-categoria').hidden = !comAnimal;
  $('#grupo-quantidade').hidden = !comAnimal || !r.categoria;
  $('#grupo-animal').hidden = possiveis.length === 0;
  $('#chips-animal').innerHTML = possiveis.length === 0 ? '' : [
    chip('animal', '', 'Nenhum em especial', !r.animalId),
    ...possiveis.map((a) => chip('animal', a.id, a.identificacao, r.animalId === a.id)),
  ].join('');
  $('#grupo-nome-novo').hidden = !entraNovo;
  $('#grupo-valor').hidden = !pronto || !COM_VALOR.includes(r.tipo);
  $('#legenda-valor').textContent = r.tipo === 'custo' ? 'Quanto gastou? (R$)' : `Valor total da ${r.tipo === 'compra' ? 'compra' : 'venda'} (R$, se souber)`;
  $('#campo-descricao').hidden = r.tipo !== 'custo';
  $('#grupo-peso').hidden = !pronto || r.tipo !== 'pesagem';
  $('#grupo-data').hidden = !pronto;
  $('#salvar-rapido').hidden = !pronto;
}

function escolherNoRapido(campo, valor) {
  const anterior = rascunho[campo];
  if (campo === 'quantidade') {
    rascunho.quantidade = Number(valor);
    $('#qtd-outro').value = '';
  } else if (campo === 'animal') {
    rascunho.animalId = valor || null;
  } else {
    rascunho[campo] = valor;
  }
  if (campo === 'tipo' && (valor === 'custo') !== (anterior === 'custo')) {
    rascunho.categoria = null;
    rascunho.quantidade = null;
  }
  if (campo === 'categoria' && valor !== anterior) rascunho.animalId = null;
  atualizarRapido();
  const proximo = { tipo: valor === 'custo' ? '#grupo-valor' : '#grupo-categoria', categoria: '#grupo-quantidade', quantidade: '#salvar-rapido' }[campo];
  const alvo = proximo && $(proximo);
  if (alvo && !alvo.hidden) alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function salvarRapido(evento) {
  evento.preventDefault();
  const editando = Boolean(rascunho.id);
  const id = rascunho.id ?? novoId();
  const dados = { ...registroDe(rascunho), id, criadoEm: rascunho.criadoEm ?? Date.now() };
  const nome = rascunho.nomeNovo.trim();
  const entraNovo = !editando && nome && dados.quantidade === 1 && (dados.tipo === 'nascimento' || dados.tipo === 'compra');
  let animal = null;
  if (entraNovo) {
    const a = validarAnimal({ id: novoId(), identificacao: nome, categoria: dados.categoria, entrada: dados.tipo, data: dados.data, criadoEm: Date.now() }, hoje(), estado.animais, estado.registros);
    if (!a.ok) { mostrarErros('#erros-rapido', a.erros); return; }
    animal = a.animal;
    dados.animalId = animal.id;
  }
  const r = validarRegistro(dados, hoje());
  if (!r.ok) {
    mostrarErros('#erros-rapido', r.erros);
    return;
  }
  if (animal) estado.animais.push(animal);
  gravarRegistro(r.registro);
  const nomeAnimal = r.registro.animalId ? ` (${animalPorId(r.registro.animalId)?.identificacao})` : '';
  avisar(`${editando ? 'Corrigido' : 'Salvo'}: ${descrever(r.registro)}${nomeAnimal}.`);
  const voltarAoAnimal = rascunho.voltarAoAnimal;
  rascunho = null;
  irPara(voltarAoAnimal ? 'animal' : editando ? 'lancamentos' : 'inicio');
}

// ---------- Lançamentos ----------

function itemLancamento(r, { acoes = true } = {}) {
  const animal = r.animalId ? animalPorId(r.animalId) : null;
  return `
    <li class="item">
      <div><span class="etiqueta tipo-${r.tipo}">${icone(r.tipo)}${ROTULOS_TIPO[r.tipo]}</span> <span class="data">${formatarData(r.data)}</span></div>
      <div>${esc(capital(descrever(r)))}${animal ? ` · <strong>${esc(animal.identificacao)}</strong>` : ''}</div>
      ${acoes ? `<div class="acoes">
        <button class="btn" data-acao="editar" data-id="${esc(r.id)}">Editar</button>
        <button class="btn perigo" data-acao="apagar" data-id="${esc(r.id)}">Apagar</button>
      </div>` : ''}
    </li>`;
}

function renderLancamentos() {
  const lista = ordenarRegistros(estado.registros);
  $('#lista').innerHTML = lista.length === 0
    ? '<li class="vazio">Nenhum lançamento ainda.</li>'
    : lista.map((r) => itemLancamento(r)).join('');
}

function editar(id) {
  const r = estado.registros.find((x) => x.id === id);
  if (!r) return;
  novoRascunho({
    ...r,
    valorTexto: r.valor !== null ? formatarNumero(r.valor, 2) : '',
    pesoTexto: r.pesoKg !== null ? formatarNumero(r.pesoKg) : '',
  });
  irPara('rapido');
}

async function apagar(id) {
  const r = estado.registros.find((x) => x.id === id);
  if (!r) return;
  if (!(await confirmar(`Apagar “${descrever(r)}” de ${formatarData(r.data)}?`, 'Sim, apagar'))) return;
  estado.registros = estado.registros.filter((x) => x.id !== id);
  salvar();
  renderLancamentos();
  avisar('Lançamento apagado.');
}

// ---------- Animais ----------

function renderAnimais() {
  const alvo = $('#lista-animais');
  if (estado.animais.length === 0) {
    alvo.innerHTML = '<p class="vazio">Nenhum animal cadastrado. Cadastre os que você quer acompanhar um por um, como uma matriz ou o reprodutor.</p>';
    return;
  }
  alvo.innerHTML = ESPECIES.map((especie) => {
    const daEspecie = estado.animais.filter((a) => ESPECIE_DA_CATEGORIA[a.categoria] === especie);
    if (daEspecie.length === 0) return '';
    const comSituacao = daEspecie
      .map((a) => ({ a, s: situacaoDoAnimal(a, estado.registros), peso: ultimaPesagem(a.id, estado.registros) }))
      .sort((x, y) => (x.s.situacao === 'no-rebanho' ? 0 : 1) - (y.s.situacao === 'no-rebanho' ? 0 : 1) || x.a.identificacao.localeCompare(y.a.identificacao));
    return `
      <p class="especie-titulo">${NOMES_ESPECIE[especie]}</p>
      <ul class="lista">${comSituacao.map(({ a, s, peso }) => `
        <li><button class="item item-animal${s.situacao === 'no-rebanho' ? '' : ' saiu'}" data-acao="abrir-animal" data-id="${esc(a.id)}">
          <strong>${esc(a.identificacao)}</strong>
          <span>${capital(nomeCategoria(a.categoria, 1))} · ${ROTULO_SITUACAO[s.situacao]}${peso ? ` · ${formatarNumero(peso.pesoKg)} kg` : ''}</span>
        </button></li>`).join('')}
      </ul>`;
  }).join('');
}

function renderAnimal() {
  const a = animalPorId(animalAberto);
  const s = situacaoDoAnimal(a, estado.registros);
  const peso = ultimaPesagem(a.id, estado.registros);
  const historico = historicoDoAnimal(a.id, estado.registros).reverse();
  $('#titulo-animal').textContent = a.identificacao;
  $('#detalhe-animal').innerHTML = `
    <div class="cartao">
      <p><strong>${capital(nomeCategoria(a.categoria, 1))}</strong> (${NOMES_ESPECIE[ESPECIE_DA_CATEGORIA[a.categoria]].toLowerCase()})</p>
      <p>Situação: <strong>${ROTULO_SITUACAO[s.situacao]}</strong>${s.data ? ` em ${formatarData(s.data)}` : ''}</p>
      <p>Entrada: ${ENTRADAS[a.entrada]} em ${formatarData(a.data)}</p>
      <p>Último peso: ${peso ? `<strong>${formatarNumero(peso.pesoKg)} kg</strong> em ${formatarData(peso.data)}` : 'ainda não pesado'}</p>
      ${a.observacao ? `<p>${esc(a.observacao)}</p>` : ''}
    </div>
    ${s.situacao === 'no-rebanho' ? `
      <div class="acoes-animal">
        <button class="btn tipo-pesagem colorido" data-acao="animal-registrar" data-valor="pesagem">${icone('pesagem')}Pesar</button>
        <button class="btn tipo-venda colorido" data-acao="animal-registrar" data-valor="venda">${icone('venda')}Vendi</button>
        <button class="btn tipo-morte colorido" data-acao="animal-registrar" data-valor="morte">${icone('morte')}Morreu</button>
      </div>` : ''}
    <h2 class="titulo-secao">Histórico</h2>
    <ul class="lista">${historico.length ? historico.map((r) => itemLancamento(r, { acoes: false })).join('') : '<li class="vazio">Nada anotado para este animal ainda.</li>'}</ul>
    <button class="btn perigo" data-acao="apagar-animal">Apagar o cadastro</button>`;
}

function registrarParaAnimal(tipo) {
  const a = animalPorId(animalAberto);
  novoRascunho({ tipo, categoria: a.categoria, quantidade: 1, animalId: a.id, voltarAoAnimal: true });
  irPara('rapido');
}

async function apagarAnimal() {
  const a = animalPorId(animalAberto);
  if (!(await confirmar(`Apagar o cadastro de ${a.identificacao}? Os lançamentos continuam na lista, sem o nome.`, 'Sim, apagar'))) return;
  estado.animais = estado.animais.filter((x) => x.id !== a.id);
  estado.registros = estado.registros.map((r) => (r.animalId === a.id ? { ...r, animalId: null } : r));
  salvar();
  avisar('Cadastro apagado.');
  irPara('animais');
}

function abrirNovoAnimal() {
  novoAnimal ??= { identificacao: '', categoria: null, entrada: null, valorTexto: '', data: hoje(), observacao: '' };
  $('#animal-nome').value = novoAnimal.identificacao;
  $('#animal-valor').value = novoAnimal.valorTexto;
  $('#animal-data').value = novoAnimal.data;
  $('#animal-data').max = hoje();
  $('#animal-obs').value = novoAnimal.observacao;
  $('#erros-animal').textContent = '';
  atualizarNovoAnimal();
}

function atualizarNovoAnimal() {
  $('#animal-categorias').innerHTML = chipsPorEspecie('animal-categoria', novoAnimal.categoria);
  $('#animal-entradas').innerHTML = Object.entries(ENTRADAS).map(([valor, rotulo]) => chip('animal-entrada', valor, rotulo, novoAnimal.entrada === valor)).join('');
  $('#grupo-animal-valor').hidden = novoAnimal.entrada !== 'compra';
}

function salvarNovoAnimal(evento) {
  evento.preventDefault();
  const a = validarAnimal({ ...novoAnimal, id: novoId(), criadoEm: Date.now() }, hoje(), estado.animais, estado.registros);
  if (!a.ok) { mostrarErros('#erros-animal', a.erros); return; }
  const entrada = registroDeEntrada(a.animal, lerValorDigitado(novoAnimal.valorTexto));
  let registro = null;
  if (entrada) {
    const r = validarRegistro({ ...entrada, id: novoId(), criadoEm: Date.now() }, hoje());
    if (!r.ok) { mostrarErros('#erros-animal', r.erros); return; }
    registro = r.registro;
  }
  estado.animais.push(a.animal);
  if (registro) estado.registros.push(registro);
  else estado.saldoBase = somarNaContagem(estado.saldoBase, a.animal.categoria);
  salvar();
  avisar(`${a.animal.identificacao} cadastrado.`);
  novoAnimal = null;
  animalAberto = a.animal.id;
  irPara('animal');
}

// ---------- Relatório ----------

function renderRelatorio() {
  $('#form-saldo').hidden = !editandoSaldo;
  $('#painel').hidden = editandoSaldo;
  if (editandoSaldo) renderFormSaldo();
  else renderPainel();
}

function renderFormSaldo() {
  const atual = estado.saldoBase?.porCategoria ?? {};
  $('#campos-saldo').innerHTML = ESPECIES.map((especie) => `
    <p class="especie-titulo">${NOMES_ESPECIE[especie]}</p>
    ${CATEGORIAS_POR_ESPECIE[especie].map((c) => `
      <label class="rotulo" for="saldo-${c}">${capital(nomeCategoria(c, 2))} <small>(${esc(EXPLICACOES[c])})</small></label>
      <input id="saldo-${c}" data-categoria="${c}" type="number" inputmode="numeric" min="0" step="1" value="${atual[c] ?? ''}">`).join('')}`).join('');
  // Sem contagem feita, sugere o dia do primeiro lançamento: a contagem vale para o começo desse dia.
  const primeiro = estado.registros.map((r) => r.data).sort().at(0);
  const dataReal = temContagemInicial(estado.saldoBase) ? estado.saldoBase.data : primeiro ?? hoje();
  $('#data-saldo').value = dataReal;
  $('#data-saldo').max = hoje();
  $('#erros-saldo').textContent = '';
}

function salvarSaldo(evento) {
  evento.preventDefault();
  const porCategoria = {};
  const erros = [];
  document.querySelectorAll('#campos-saldo input').forEach((campo) => {
    if (campo.value.trim() === '') return;
    const n = Number(campo.value);
    if (!Number.isInteger(n) || n < 0) erros.push(`${capital(nomeCategoria(campo.dataset.categoria, 2))}: use um número inteiro, zero ou mais.`);
    else if (n > 0) porCategoria[campo.dataset.categoria] = n;
  });
  const data = $('#data-saldo').value;
  if (!data) erros.push('Informe a data da contagem.');
  else if (data > hoje()) erros.push('A data da contagem não pode ser no futuro.');
  if (erros.length) {
    mostrarErros('#erros-saldo', erros);
    return;
  }
  estado.saldoBase = { data, porCategoria };
  editandoSaldo = false;
  salvar();
  avisar('Contagem guardada.');
  renderRelatorio();
}

function tituloPeriodo() {
  return periodo.modo === 'mensal' ? `${MESES[periodo.mes - 1]} de ${periodo.ano}` : `ano de ${periodo.ano}`;
}

function mudarPeriodo(passo) {
  if (periodo.modo === 'anual') {
    periodo.ano += passo;
  } else {
    periodo.mes += passo;
    if (periodo.mes < 1) { periodo.mes = 12; periodo.ano -= 1; }
    if (periodo.mes > 12) { periodo.mes = 1; periodo.ano += 1; }
  }
  renderPainel();
}

function indicadoresAtuais() {
  const { inicio, fim } = periodo.modo === 'mensal' ? periodoMensal(periodo.ano, periodo.mes) : periodoAnual(periodo.ano);
  return calcularIndicadores({ saldoBase: estado.saldoBase, registros: estado.registros, inicio, fim, hoje: hoje() });
}

const mostrar = (valor, formatar) => (valor === SEM_DADOS ? 'sem dados' : formatar(valor));
const porcento = (v) => `${formatarNumero(v, 1)}%`;

function cartaoEspecie(especie, e) {
  const linhas = Object.entries(e.tabela).map(([c, l]) => `
    <div class="linha-cat">
      <div><strong>${esc(capital(nomeCategoria(c, 2)))}</strong>
        <small>início ${l.inicial} · +${l.nascimentos} nasc. · +${l.compras} compras · −${l.mortes} mortes · −${l.vendas} vendas</small></div>
      <div class="final">${l.final}</div>
    </div>`).join('');
  return `
    <div class="cartao">
      <h2>${NOMES_ESPECIE[especie]}</h2>
      <div class="numero">${e.final} <small>${e.final === 1 ? 'animal' : 'animais'}</small></div>
      <p>Começou o período com ${e.inicial}. Nasceram <strong>${e.nascimentos}</strong>, morreram <strong>${e.mortes}</strong>, comprou <strong>${e.compras}</strong>, vendeu <strong>${e.vendas}</strong>.</p>
      <p>Mortalidade: <strong>${mostrar(e.mortalidade, porcento)}</strong>${e.receitaVendas ? ` · Vendas: <strong>${formatarReais(e.receitaVendas)}</strong>` : ''}</p>
      ${linhas}
    </div>`;
}

function renderPainel() {
  const ind = indicadoresAtuais();
  const partes = [`
    <div class="chips">
      ${chip('periodo-modo', 'mensal', 'Por mês', periodo.modo === 'mensal')}
      ${chip('periodo-modo', 'anual', 'Por ano', periodo.modo === 'anual')}
    </div>
    <div class="periodo">
      <button class="chip" data-acao="periodo-anterior" aria-label="Período anterior">‹</button>
      <span class="titulo">${esc(capital(tituloPeriodo()))}</span>
      <button class="chip" data-acao="periodo-seguinte" aria-label="Próximo período">›</button>
    </div>`];

  if (ind.erro) {
    partes.push(`<div class="caixa alerta"><p>${esc(ind.erro)}</p></div>`);
  } else {
    if (ind.semContagemInicial) {
      partes.push('<div class="caixa alerta"><p>A conta começa do zero e soma só o que você anotou. Se você já tinha animais antes, informe quantos para os números ficarem certos.</p><button class="btn" data-acao="editar-saldo">Informar os animais que eu já tinha</button></div>');
    } else if (ind.cortado) {
      partes.push(`<p class="dica">Contando de ${formatarData(ind.inicio)} a ${formatarData(ind.fim)}: antes da contagem inicial ou depois de hoje não há dados.</p>`);
    }
    const especies = Object.entries(ind.porEspecie);
    partes.push(especies.length ? especies.map(([especie, e]) => cartaoEspecie(especie, e)).join('') : '<p class="vazio">Nenhum animal anotado neste período.</p>');
    partes.push(`
      <div class="cartao"><h2>Gastos e dinheiro (todo o rebanho)</h2>
        <p>Vendas: <strong>${formatarReais(ind.vendas)}</strong> · Compras: <strong>${formatarReais(ind.compras)}</strong> · Gastos: <strong>${formatarReais(ind.custoTotal)}</strong></p>
        <p>Custo por cabeça: <strong>${mostrar(ind.custoPorCabeca, formatarReais)}</strong>${ind.custoPorCabeca === SEM_DADOS ? '. Lance gastos com ração, vacina etc. no botão Gasto.' : ''}</p>
        <p class="formula">Mortalidade = mortes ÷ média de animais × 100 · Custo por cabeça = gastos ÷ média de animais</p></div>
      <a class="btn principal" id="enviar-whatsapp" href="https://wa.me/?text=${encodeURIComponent(resumoTexto(ind, tituloPeriodo()))}" target="_blank" rel="noopener">Enviar relatório pelo WhatsApp</a>
      <button class="btn" data-acao="copiar-resumo">Copiar relatório</button>`);
  }
  partes.push(`
    <button class="btn" data-acao="editar-saldo">${temContagemInicial(estado.saldoBase) ? 'Corrigir' : 'Informar'} os animais que eu já tinha</button>
    <button class="btn" data-acao="exportar">Exportar dados</button>
    <button class="btn" data-acao="importar">Restaurar uma cópia</button>`);
  $('#painel').innerHTML = partes.join('');
}

async function copiarResumo() {
  const ind = indicadoresAtuais();
  if (ind.erro) return;
  const texto = resumoTexto(ind, tituloPeriodo());
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const area = document.createElement('textarea');
    area.value = texto;
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  avisar('Relatório copiado. Cole no WhatsApp ou onde quiser.');
}

// ---------- Cópia de segurança ----------

function exportar() {
  const conteudo = JSON.stringify({
    app: 'diario-rebanho',
    versao: 2,
    exportadoEm: new Date().toISOString(),
    saldoBase: estado.saldoBase,
    registros: estado.registros,
    animais: estado.animais,
  }, null, 2);
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `diario-rebanho-${hoje()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  avisar('Cópia criada. Guarde o arquivo em lugar seguro.');
}

async function importar(arquivo) {
  let dados;
  try {
    dados = JSON.parse(await arquivo.text());
  } catch {
    avisar('Esse arquivo não é uma cópia do Diário do Rebanho.');
    return;
  }
  if (dados?.app !== 'diario-rebanho' || !Array.isArray(dados.registros)) {
    avisar('Esse arquivo não é uma cópia do Diário do Rebanho.');
    return;
  }
  const validos = dados.registros
    .map((r) => validarRegistro({ ...r, categoria: r.categoria ? migrarCategoria(r.categoria) : r.categoria }, hoje()))
    .filter((r) => r.ok && r.registro.id)
    .map((r) => r.registro);
  const animais = (Array.isArray(dados.animais) ? dados.animais : [])
    .map((a) => validarAnimal(a, hoje()))
    .filter((r) => r.ok && r.animal.id)
    .map((r) => r.animal);
  const ignorados = dados.registros.length - validos.length;
  const pergunta = `Trocar os dados deste aparelho pelos ${validos.length} lançamentos e ${animais.length} animais da cópia?${ignorados ? ` (${ignorados} lançamentos com problema serão ignorados)` : ''}`;
  if (!(await confirmar(pergunta, 'Sim, restaurar'))) return;
  estado.registros = validos;
  estado.animais = animais;
  estado.saldoBase = dados.saldoBase?.data ? dados.saldoBase : estado.saldoBase;
  salvar();
  avisar('Cópia restaurada.');
  renderRelatorio();
}

// ---------- Eventos ----------

document.addEventListener('click', (evento) => {
  const alvo = evento.target.closest('button');
  if (!alvo) return;
  const { ir, atalho, acao, campo, valor, id } = alvo.dataset;

  if (ir) {
    if (ir === 'rapido') rascunho = null;
    if (ir === 'novo-animal') novoAnimal = null;
    if (ir === 'relatorio') editandoSaldo = false;
    irPara(ir);
  } else if (atalho) {
    novoRascunho({ tipo: atalho });
    irPara('rapido');
  } else if (campo && ['tipo', 'categoria', 'quantidade', 'animal'].includes(campo)) {
    escolherNoRapido(campo, valor);
  } else if (campo === 'voz-tipo' || campo === 'voz-categoria') {
    entendido[campo.slice(4)] = valor;
    renderEntendido();
  } else if (campo === 'animal-categoria' || campo === 'animal-entrada') {
    novoAnimal[campo.slice(7)] = valor;
    atualizarNovoAnimal();
  } else if (campo === 'periodo-modo') {
    periodo.modo = valor;
    renderPainel();
  }

  switch (acao) {
    case 'aceitar-aviso':
      estado.avisoVisto = true;
      salvar();
      irPara('inicio', { historico: false });
      history.replaceState(null, '', '#inicio');
      break;
    case 'confirmar-sim': fecharConfirmacao(true); break;
    case 'confirmar-nao': fecharConfirmacao(false); break;
    case 'entender': entender(); break;
    case 'gravar': alternarGravacao(); break;
    case 'salvar-voz': salvarEntendido(); break;
    case 'corrigir-voz':
      novoRascunho({
        tipo: entendido.tipo,
        categoria: entendido.categoria,
        quantidade: entendido.quantidade,
        valorTexto: entendido.valorTexto,
        pesoTexto: entendido.pesoTexto,
      });
      entendido = null;
      irPara('rapido');
      break;
    case 'editar': editar(id); break;
    case 'apagar': apagar(id); break;
    case 'contar': editandoSaldo = true; irPara('relatorio'); break;
    case 'editar-saldo': editandoSaldo = true; renderRelatorio(); window.scrollTo(0, 0); break;
    case 'cancelar-saldo': editandoSaldo = false; renderRelatorio(); break;
    case 'periodo-anterior': mudarPeriodo(-1); break;
    case 'periodo-seguinte': mudarPeriodo(1); break;
    case 'copiar-resumo': copiarResumo(); break;
    case 'exportar': exportar(); break;
    case 'importar': $('#arquivo-importar').click(); break;
    case 'abrir-animal': animalAberto = id; irPara('animal'); break;
    case 'animal-registrar': registrarParaAnimal(valor); break;
    case 'apagar-animal': apagarAnimal(); break;
    default: break;
  }
});

document.addEventListener('input', (evento) => {
  const campo = evento.target;
  if (rascunho) {
    if (campo.id === 'qtd-outro') {
      const n = Number(campo.value);
      rascunho.quantidade = campo.value === '' ? null : n;
      atualizarRapido();
    }
    if (campo.id === 'valor') rascunho.valorTexto = campo.value;
    if (campo.id === 'descricao') rascunho.descricao = campo.value;
    if (campo.id === 'peso') rascunho.pesoTexto = campo.value;
    if (campo.id === 'nome-novo') rascunho.nomeNovo = campo.value;
    if (campo.id === 'data') rascunho.data = campo.value;
  }
  if (novoAnimal) {
    if (campo.id === 'animal-nome') novoAnimal.identificacao = campo.value;
    if (campo.id === 'animal-valor') novoAnimal.valorTexto = campo.value;
    if (campo.id === 'animal-data') novoAnimal.data = campo.value;
    if (campo.id === 'animal-obs') novoAnimal.observacao = campo.value;
  }
  if (entendido) {
    if (campo.id === 'voz-quantidade') entendido.quantidade = campo.value === '' ? null : Number(campo.value);
    if (campo.id === 'voz-valor') entendido.valorTexto = campo.value;
    if (campo.id === 'voz-peso') entendido.pesoTexto = campo.value;
    const frase = $('#frase-entendida');
    if (frase && campo.id.startsWith('voz-')) frase.textContent = fraseEntendida();
  }
});

$('#form-rapido').addEventListener('submit', salvarRapido);
$('#form-saldo').addEventListener('submit', salvarSaldo);
$('#form-animal').addEventListener('submit', salvarNovoAnimal);
$('#frase').addEventListener('keydown', (evento) => {
  if (evento.key === 'Enter' && !evento.shiftKey) {
    evento.preventDefault();
    entender();
  }
});
$('#arquivo-importar').addEventListener('change', (evento) => {
  const [arquivo] = evento.target.files;
  if (arquivo) importar(arquivo);
  evento.target.value = '';
});

irPara(location.hash.slice(1) || 'inicio', { historico: false });

// Guarda o app no celular para abrir sem internet (só funciona em https ou localhost).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { type: 'module' }).catch(() => {});
}
