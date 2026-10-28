// Interface do Diário do Rebanho. Só cuida da tela: as regras ficam em /src.
import { interpretar } from '/src/interpretador.js';
import { CATEGORIAS, EXPLICACOES, ROTULOS_TIPO, TIPOS, TIPOS_REGISTRO, descrever, nomeCategoria } from '/src/rotulos.js';
import { ordenarRegistros, validarRegistro } from '/src/registros.js';
import { SEM_DADOS, calcularIndicadores, periodoAnual, periodoMensal, resumoTexto } from '/src/indicadores.js';
import { formatarData, formatarNumero, formatarReais, isoDeData, lerValorDigitado } from '/src/formato.js';
import { ouvir, verificarVoz } from './voz.js';

const CHAVE = 'diario-rebanho:v1';
const TELAS = ['aviso', 'inicio', 'voz', 'rapido', 'lancamentos', 'indicadores'];
const ROTULO_ACAO = { nascimento: 'Nasceu', morte: 'Morreu', compra: 'Comprei', venda: 'Vendi', pesagem: 'Pesei', custo: 'Gasto' };
const ROTULO_CONFIANCA = { alta: 'alta', media: 'média', baixa: 'baixa' };
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const COM_VALOR = ['compra', 'venda', 'custo'];

const $ = (seletor) => document.querySelector(seletor);
const hoje = () => isoDeData(new Date());
const capital = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);
const esc = (texto) => String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

let estado = carregar();
let rascunho = null; // lançamento sendo preenchido no registro rápido
let entendido = null; // lançamento vindo de uma frase
let pararDeOuvir = null;
let editandoSaldo = false;
const agora = new Date();
const periodo = { modo: 'mensal', ano: agora.getFullYear(), mes: agora.getMonth() + 1 };

// ---------- Armazenamento ----------

function carregar() {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAVE));
    if (dados && Array.isArray(dados.registros)) return { saldoBase: null, avisoVisto: false, ...dados };
  } catch {
    // Sem armazenamento ou dado corrompido: começa vazio.
  }
  return { registros: [], saldoBase: null, avisoVisto: false };
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

// ---------- Navegação ----------

function irPara(tela, { historico = true } = {}) {
  if (!TELAS.includes(tela)) tela = 'inicio';
  if (!estado.avisoVisto) tela = 'aviso';
  if (tela !== 'voz') pararGravacao();
  document.querySelectorAll('[data-tela]').forEach((secao) => { secao.hidden = secao.dataset.tela !== tela; });
  if (tela === 'voz') abrirVoz();
  if (tela === 'rapido') abrirRapido();
  if (tela === 'lancamentos') renderLancamentos();
  if (tela === 'indicadores') renderIndicadores();
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
    partes.push(`<p class="rotulo">Qual animal?</p><div class="chips categorias">${CATEGORIAS.map((c) => chip('voz-categoria', c, capital(nomeCategoria(c, 1)), entendido.categoria === c, EXPLICACOES[c])).join('')}</div>`);
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
    $('#erros-voz').innerHTML = r.erros.map((e) => `<p>${esc(e)}</p>`).join('');
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
  rascunho = { id: null, tipo: null, categoria: null, quantidade: null, valorTexto: '', pesoTexto: '', descricao: '', data: hoje(), criadoEm: null, ...dados };
}

function abrirRapido() {
  if (!rascunho) novoRascunho();
  $('#titulo-rapido').textContent = rascunho.id ? 'Corrigir lançamento' : 'Registro rápido';
  $('#qtd-outro').value = rascunho.quantidade > 6 ? rascunho.quantidade : '';
  $('#valor').value = rascunho.valorTexto;
  $('#descricao').value = rascunho.descricao;
  $('#peso').value = rascunho.pesoTexto;
  $('#data').value = rascunho.data;
  $('#data').max = hoje();
  $('#erros-rapido').textContent = '';
  atualizarRapido();
}

function atualizarRapido() {
  const r = rascunho;
  const comAnimal = r.tipo && r.tipo !== 'custo';
  const pronto = r.tipo === 'custo' || Boolean(comAnimal && r.categoria && r.quantidade);
  $('#chips-tipo').innerHTML = TIPOS_REGISTRO.map((t) => chipTipo('tipo', t, r.tipo === t)).join('');
  $('#chips-categoria').innerHTML = CATEGORIAS.map((c) => chip('categoria', c, capital(nomeCategoria(c, 1)), r.categoria === c, EXPLICACOES[c])).join('');
  $('#chips-quantidade').innerHTML = [1, 2, 3, 4, 5, 6].map((n) => chip('quantidade', n, n, r.quantidade === n)).join('');
  $('#grupo-categoria').hidden = !comAnimal;
  $('#grupo-quantidade').hidden = !comAnimal || !r.categoria;
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
  } else {
    rascunho[campo] = valor;
  }
  if (campo === 'tipo' && (valor === 'custo') !== (anterior === 'custo')) {
    rascunho.categoria = null;
    rascunho.quantidade = null;
  }
  atualizarRapido();
  const proximo = { tipo: valor === 'custo' ? '#grupo-valor' : '#grupo-categoria', categoria: '#grupo-quantidade', quantidade: '#salvar-rapido' }[campo];
  const alvo = proximo && $(proximo);
  if (alvo && !alvo.hidden) alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function salvarRapido(evento) {
  evento.preventDefault();
  const r = validarRegistro({ ...registroDe(rascunho), id: rascunho.id ?? novoId(), criadoEm: rascunho.criadoEm ?? Date.now() }, hoje());
  if (!r.ok) {
    $('#erros-rapido').innerHTML = r.erros.map((e) => `<p>${esc(e)}</p>`).join('');
    return;
  }
  const editando = Boolean(rascunho.id);
  gravarRegistro(r.registro);
  avisar(`${editando ? 'Corrigido' : 'Salvo'}: ${descrever(r.registro)}.`);
  rascunho = null;
  irPara(editando ? 'lancamentos' : 'inicio');
}

// ---------- Lançamentos ----------

function renderLancamentos() {
  const lista = ordenarRegistros(estado.registros);
  $('#lista').innerHTML = lista.length === 0
    ? '<li class="vazio">Nenhum lançamento ainda.</li>'
    : lista.map((r) => `
      <li class="item">
        <div><span class="etiqueta tipo-${r.tipo}">${icone(r.tipo)}${ROTULOS_TIPO[r.tipo]}</span> <span class="data">${formatarData(r.data)}</span></div>
        <div>${esc(capital(descrever(r)))}</div>
        <div class="acoes">
          <button class="btn" data-acao="editar" data-id="${esc(r.id)}">Editar</button>
          <button class="btn perigo" data-acao="apagar" data-id="${esc(r.id)}">Apagar</button>
        </div>
      </li>`).join('');
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

// ---------- Indicadores ----------

function renderIndicadores() {
  const mostrarFormulario = !estado.saldoBase || editandoSaldo;
  $('#form-saldo').hidden = !mostrarFormulario;
  $('#painel').hidden = mostrarFormulario;
  if (mostrarFormulario) renderFormSaldo();
  else renderPainel();
}

function renderFormSaldo() {
  const atual = estado.saldoBase?.porCategoria ?? {};
  $('#campos-saldo').innerHTML = CATEGORIAS.map((c) => `
    <label class="rotulo" for="saldo-${c}">${capital(nomeCategoria(c, 2))} <small>(${esc(EXPLICACOES[c])})</small></label>
    <input id="saldo-${c}" data-categoria="${c}" type="number" inputmode="numeric" min="0" step="1" value="${atual[c] ?? ''}">`).join('');
  $('#data-saldo').value = estado.saldoBase?.data ?? hoje();
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
    $('#erros-saldo').innerHTML = erros.map((e) => `<p>${esc(e)}</p>`).join('');
    return;
  }
  estado.saldoBase = { data, porCategoria };
  editandoSaldo = false;
  salvar();
  avisar('Contagem guardada.');
  renderIndicadores();
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
    partes.push(`<div class="caixa alerta"><p>${esc(ind.erro)}</p><p>A contagem inicial é de ${formatarData(estado.saldoBase.data)}.</p></div>`);
  } else {
    if (ind.cortado) partes.push(`<p class="dica">Contando de ${formatarData(ind.inicio)} a ${formatarData(ind.fim)}: antes da contagem inicial ou depois de hoje não há dados.</p>`);
    const linhas = Object.entries(ind.tabela).map(([c, l]) => `
      <div class="linha-cat">
        <div><strong>${esc(capital(nomeCategoria(c, 2)))}</strong>
          <small>início ${l.inicial} · +${l.nascimentos} nasc. · +${l.compras} compras · −${l.mortes} mortes · −${l.vendas} vendas</small></div>
        <div class="final">${l.final}</div>
      </div>`).join('');
    const metodo = ind.media.metodo === 'media-diaria'
      ? 'média dos saldos de cada dia do período'
      : '(animais no início + animais no fim) ÷ 2';
    partes.push(`
      <div class="cartao"><h2>Animais por tipo (saldo final)</h2>${linhas || '<p>Nenhum animal registrado.</p>'}
        <p class="formula">Saldo final = início + nascimentos + compras − mortes − vendas</p></div>
      <div class="cartao"><h2>Média de animais no período</h2><div class="numero">${formatarNumero(ind.media.media, 1)}</div>
        <p class="formula">Calculado por: ${metodo}</p></div>
      <div class="cartao"><h2>Taxa de mortalidade</h2><div class="numero">${mostrar(ind.mortalidade, (v) => `${formatarNumero(v, 1)}%`)}</div>
        <p>${ind.mortes} ${ind.mortes === 1 ? 'morte' : 'mortes'} no período. Quer dizer: de cada 100 animais, quantos morreram.</p>
        <p class="formula">Mortalidade = mortes ÷ média de animais × 100</p></div>
      <div class="cartao"><h2>Custo por cabeça</h2><div class="numero">${mostrar(ind.custoPorCabeca, formatarReais)}</div>
        <p>Custos lançados: ${formatarReais(ind.custoTotal)}${ind.custoPorCabeca === SEM_DADOS ? '. Lance gastos com ração, vacina etc. em “Registro rápido → Gasto”.' : ''}</p>
        <p class="formula">Custo por cabeça = custos ÷ média de animais</p></div>
      <div class="cartao"><h2>Dinheiro</h2>
        <p>Vendas: <strong>${formatarReais(ind.vendas)}</strong><br>Compras: <strong>${formatarReais(ind.compras)}</strong></p></div>
      <button class="btn principal" data-acao="copiar-resumo">Copiar resumo</button>`);
  }
  partes.push(`
    <button class="btn" data-acao="editar-saldo">Corrigir contagem inicial</button>
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
  avisar('Resumo copiado. Cole no WhatsApp ou onde quiser.');
}

// ---------- Cópia de segurança ----------

function exportar() {
  const conteudo = JSON.stringify({
    app: 'diario-rebanho',
    versao: 1,
    exportadoEm: new Date().toISOString(),
    saldoBase: estado.saldoBase,
    registros: estado.registros,
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
    .map((r) => validarRegistro(r, hoje()))
    .filter((r) => r.ok && r.registro.id)
    .map((r) => r.registro);
  const ignorados = dados.registros.length - validos.length;
  const pergunta = `Trocar os dados deste aparelho pelos ${validos.length} lançamentos da cópia?${ignorados ? ` (${ignorados} com problema serão ignorados)` : ''}`;
  if (!(await confirmar(pergunta, 'Sim, restaurar'))) return;
  estado.registros = validos;
  estado.saldoBase = dados.saldoBase?.data ? dados.saldoBase : estado.saldoBase;
  salvar();
  avisar('Cópia restaurada.');
  renderIndicadores();
}

// ---------- Eventos ----------

document.addEventListener('click', (evento) => {
  const alvo = evento.target.closest('button');
  if (!alvo) return;
  const { ir, atalho, acao, campo, valor, id } = alvo.dataset;

  if (ir) {
    if (ir === 'rapido') rascunho = null;
    irPara(ir);
  } else if (atalho) {
    novoRascunho({ tipo: atalho });
    irPara('rapido');
  } else if (campo && ['tipo', 'categoria', 'quantidade'].includes(campo)) {
    escolherNoRapido(campo, valor);
  } else if (campo === 'voz-tipo' || campo === 'voz-categoria') {
    entendido[campo.slice(4)] = valor;
    renderEntendido();
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
    case 'editar-saldo': editandoSaldo = true; renderIndicadores(); break;
    case 'periodo-anterior': mudarPeriodo(-1); break;
    case 'periodo-seguinte': mudarPeriodo(1); break;
    case 'copiar-resumo': copiarResumo(); break;
    case 'exportar': exportar(); break;
    case 'importar': $('#arquivo-importar').click(); break;
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
    if (campo.id === 'data') rascunho.data = campo.value;
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
