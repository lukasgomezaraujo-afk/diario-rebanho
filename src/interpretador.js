// Interpreta frases sobre o rebanho ("vendi três cabritos por setecentos reais").
// Função pura: texto entra, objeto sai. Sem DOM e sem localStorage.
import { CATEGORIAS, TIPOS } from './rotulos.js';
import { formatarReais } from './formato.js';

export { CATEGORIAS, TIPOS };

const NUMEROS = new Map(Object.entries({
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16,
  dezasseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40,
  cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100,
  duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quatrocentas: 400,
  quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700, setecentas: 700,
  oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900,
}));

const CATEGORIA_POR_PALAVRA = new Map([
  ['cabra', 'cabra'], ['cabras', 'cabra'],
  ['bode', 'bode'], ['bodes', 'bode'],
  ['cabrito', 'cabrito'], ['cabritos', 'cabrito'], ['cabritinho', 'cabrito'], ['cabritinhos', 'cabrito'],
  ['cabrita', 'cabrita'], ['cabritas', 'cabrita'], ['cabritinha', 'cabrita'], ['cabritinhas', 'cabrita'],
  ['ovelha', 'ovelha'], ['ovelhas', 'ovelha'],
  ['carneiro', 'carneiro'], ['carneiros', 'carneiro'],
  ['borrego', 'borrego'], ['borregos', 'borrego'], ['borrega', 'borrego'], ['borregas', 'borrego'],
  ['cordeiro', 'borrego'], ['cordeiros', 'borrego'], ['cordeira', 'borrego'], ['cordeiras', 'borrego'],
  ['matriz', 'matriz'], ['matrizes', 'matriz'],
  ['reprodutor', 'reprodutor'], ['reprodutores', 'reprodutor'],
]);
const FORMAS_PLURAIS = new Set([...CATEGORIA_POR_PALAVRA.keys()].filter((p) => p.endsWith('s')));
const FILHOTES = new Set(['cabrito', 'cabrita', 'borrego']);
const MAES = new Set(['cabra', 'ovelha', 'matriz']);
// "matriz de cabra" é matriz: a função do animal vale mais que a espécie.
const PRIORITARIAS = new Set(['matriz', 'reprodutor']);

const TIPO_POR_PALAVRA = new Map();
for (const [tipo, palavras] of Object.entries({
  nascimento: 'nasceu nasceram nasce nascer nascimento nascimentos pariu pariram parto partos',
  morte: 'morreu morreram morre morrer morte mortes morto morta mortos mortas',
  compra: 'comprei comprou compramos compraram compra comprar comprado comprada comprados compradas',
  venda: 'vendi vendeu vendemos venderam venda vender vendido vendida vendidos vendidas',
})) {
  for (const palavra of palavras.split(' ')) TIPO_POR_PALAVRA.set(palavra, tipo);
}
const PALAVRAS_PARTO = new Set(['pariu', 'pariram', 'parto', 'partos', 'cria']);
const PALAVRAS_PESAGEM = new Set(['pesei', 'pesou', 'pesamos', 'pesaram', 'pesando', 'pesa', 'pesava', 'pesagem', 'peso', 'pesar']);
const UNIDADES_PESO = new Set(['kg', 'kgs', 'quilo', 'quilos', 'kilo', 'kilos', 'quilograma', 'quilogramas']);
const ANTES_DE_VALOR = new Set(['por', 'a', 'pra', 'para']);
const ANTES_DE_PESO = new Set([...PALAVRAS_PESAGEM, 'com']);
const TEMPO = new Set(['dia', 'dias', 'semana', 'semanas', 'mes', 'meses', 'ano', 'anos']);
const VAGOS = new Set(['uns', 'umas', 'alguns', 'algumas', 'varios', 'varias', 'poucos', 'poucas', 'muitos', 'muitas']);
const ARTIGOS = new Set(['a', 'o', 'meu', 'minha', 'esse', 'essa', 'este', 'esta', 'aquele', 'aquela', 'nosso', 'nossa']);
const GEMEOS = new Map([['gemeos', 2], ['gemeas', 2], ['trigemeos', 3], ['trigemeas', 3]]);

export function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .replace(/r\$\s*(\d[\d.,]*)/g, '$1 reais')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/(\d)\s*(kg|kgs)\b/g, '$1 kg')
    .replace(/[^a-z0-9.,\s]/g, ' ')
    .replace(/[.,](?!\d)|(?<!\d)[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function lerDigitos(token) {
  if (/^\d{1,3}(\.\d{3})+$/.test(token)) return Number(token.replace(/\./g, ''));
  const decimal = token.replace(',', '.');
  return /^\d+(\.\d+)?$/.test(decimal) ? Number(decimal) : null;
}

const ehPalavraNumero = (t) => NUMEROS.has(t) || t === 'mil';
const ehDuzia = (t) => t === 'duzia' || t === 'duzias';

function somarPorExtenso(palavras) {
  let total = 0;
  let atual = 0;
  for (const palavra of palavras) {
    if (palavra === 'mil') {
      total += (atual || 1) * 1000;
      atual = 0;
    } else {
      atual += NUMEROS.get(palavra);
    }
  }
  return total + atual;
}

// Encontra números em algarismos ou por extenso ("cento e cinquenta", "meia dúzia").
function extrairNumeros(tokens) {
  const achados = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    let valor = null;
    let fim = i;
    if (/^\d/.test(token)) {
      valor = lerDigitos(token);
      if (tokens[i + 1] === 'mil' && valor !== null) {
        valor *= 1000;
        fim = i + 1;
      }
    } else if (token === 'meia' && ehDuzia(tokens[i + 1])) {
      valor = 6;
      fim = i + 1;
    } else if (ehPalavraNumero(token)) {
      const palavras = [token];
      for (;;) {
        if (ehPalavraNumero(tokens[fim + 1])) {
          palavras.push(tokens[fim + 1]);
          fim += 1;
        } else if (tokens[fim + 1] === 'e' && ehPalavraNumero(tokens[fim + 2])) {
          palavras.push(tokens[fim + 2]);
          fim += 2;
        } else {
          break;
        }
      }
      valor = somarPorExtenso(palavras);
    }
    if (valor === null) {
      i += 1;
      continue;
    }
    if (token !== 'meia' && ehDuzia(tokens[fim + 1])) {
      valor *= 12;
      fim += 1;
    }
    achados.push({ valor, inicio: i, fim });
    i = fim + 1;
  }
  return achados;
}

// Próxima palavra, pulando o "de" de "dúzia de cabritos".
const palavraApos = (tokens, indice) => (tokens[indice] === 'de' ? tokens[indice + 1] : tokens[indice]);

function escolherCategoria(mencoes, tipo, falaDeParto) {
  if (mencoes.length === 0) return null;
  let candidatas = mencoes;
  if (tipo === 'nascimento' && mencoes.some((m) => FILHOTES.has(m.categoria))) {
    candidatas = mencoes.filter((m) => FILHOTES.has(m.categoria));
  } else if (tipo === 'nascimento' && falaDeParto && mencoes.every((m) => MAES.has(m.categoria))) {
    // "a cabra pariu dois": a cabra é a mãe, não quem nasceu.
    return 'mae';
  } else if (mencoes.some((m) => PRIORITARIAS.has(m.categoria))) {
    candidatas = mencoes.filter((m) => PRIORITARIAS.has(m.categoria));
  }
  const distintas = new Set(candidatas.map((m) => m.categoria));
  return distintas.size === 1 ? candidatas[0] : 'conflito';
}

export function interpretar(texto) {
  const resultado = {
    tipo: 'desconhecido',
    categoria: 'desconhecida',
    quantidade: null,
    valor: null,
    pesoKg: null,
    confianca: 'baixa',
    faltando: [],
    avisos: [],
  };
  const avisos = resultado.avisos;
  const normal = normalizar(texto);
  if (!normal) {
    resultado.faltando = ['tipo', 'categoria', 'quantidade'];
    avisos.push('Não recebi nenhuma frase.');
    return resultado;
  }
  const tokens = normal.split(' ');
  let incerto = false;

  // 1. O que aconteceu
  const tipos = new Set();
  tokens.forEach((t, i) => {
    if (TIPO_POR_PALAVRA.has(t)) tipos.add(TIPO_POR_PALAVRA.get(t));
    if (t === 'cria' && tokens[i - 1] === 'deu') tipos.add('nascimento');
  });
  if (tipos.size === 0 && tokens.some((t) => PALAVRAS_PESAGEM.has(t) || UNIDADES_PESO.has(t))) tipos.add('pesagem');
  if (tipos.size === 1) {
    resultado.tipo = [...tipos][0];
  } else if (tipos.size > 1) {
    incerto = true;
    avisos.push('A frase fala de mais de um acontecimento. Registre um de cada vez.');
  }
  const tipo = resultado.tipo;

  // 2. Qual animal
  const mencoes = [];
  tokens.forEach((t, i) => {
    if (CATEGORIA_POR_PALAVRA.has(t)) mencoes.push({ categoria: CATEGORIA_POR_PALAVRA.get(t), indice: i, plural: FORMAS_PLURAIS.has(t) });
  });
  const falaDeParto = tokens.some((t) => PALAVRAS_PARTO.has(t));
  const escolhida = escolherCategoria(mencoes, tipo, falaDeParto);
  if (escolhida === 'conflito') {
    incerto = true;
    avisos.push('A frase fala de mais de um tipo de animal. Registre um de cada vez.');
  } else if (escolhida === 'mae') {
    avisos.push('Os filhotes são cabritos, cabritas ou borregos?');
  } else if (escolhida) {
    resultado.categoria = escolhida.categoria;
  }

  // 3. Quantidade, valor e peso
  let quantidade = null;
  let quantidadeCerta = false;
  let valor = null;
  let valorCerto = false;
  let valorInvalido = false;
  let porCabeca = false;
  let peso = null;
  let pesoCerto = false;
  const numeros = extrairNumeros(tokens);
  const usados = new Set();
  numeros.forEach((numero, n) => {
    if (usados.has(n)) return;
    const depois = tokens[numero.fim + 1];
    const antes = tokens[numero.inicio - 1];
    const marcaCada = (indice) => { if (tokens[indice] === 'cada') porCabeca = true; };

    if (depois === 'reais' || depois === 'real') {
      if (valor === null) { valor = numero.valor; valorCerto = true; }
      marcaCada(numero.fim + 2);
    } else if (depois === 'conto' || depois === 'contos') {
      // "um conto" = R$ 1.000,00. "Quinhentos conto" não existe: seria R$ 500.000,00.
      if (!Number.isInteger(numero.valor) || numero.valor < 1 || numero.valor > 99) {
        valorInvalido = true;
        avisos.push(`"${tokens.slice(numero.inicio, numero.fim + 2).join(' ')}" não é um valor que eu entenda. Diga em reais, por exemplo "quinhentos reais".`);
        return;
      }
      let total = numero.valor * 1000;
      let ultimo = numero.fim + 1;
      if (tokens[ultimo + 1] === 'e' && tokens[ultimo + 2] === 'meio') {
        total += 500;
        ultimo += 2;
      } else if (tokens[ultimo + 1] === 'e' && numeros[n + 1]?.inicio === ultimo + 2 && numeros[n + 1].valor < 1000) {
        total += numeros[n + 1].valor;
        ultimo = numeros[n + 1].fim;
        usados.add(n + 1);
      }
      if (valor === null) { valor = total; valorCerto = true; }
      marcaCada(ultimo + 1);
    } else if (UNIDADES_PESO.has(depois)) {
      if (peso === null) { peso = numero.valor; pesoCerto = true; }
    } else if (TEMPO.has(depois) || antes === 'dia') {
      avisos.push('Idade e datas faladas não entram no registro. A data fica como hoje; corrija se precisar.');
    } else if (CATEGORIA_POR_PALAVRA.has(palavraApos(tokens, numero.fim + 1))) {
      if (quantidade === null) { quantidade = numero.valor; quantidadeCerta = true; }
    } else if (ANTES_DE_VALOR.has(antes)) {
      if (valor === null) valor = numero.valor;
      marcaCada(numero.fim + 1);
    } else if (ANTES_DE_PESO.has(antes)) {
      if (peso === null) peso = numero.valor;
    } else if (quantidade === null) {
      quantidade = numero.valor;
      quantidadeCerta = true;
    } else {
      avisos.push(`Não entendi o que é o número ${numero.valor}.`);
    }
  });

  if (quantidade === null) {
    const gemeos = tokens.find((t) => GEMEOS.has(t));
    if (gemeos) {
      quantidade = GEMEOS.get(gemeos);
      quantidadeCerta = true;
    } else if (tokens.some((t) => VAGOS.has(t))) {
      avisos.push('Quantos animais? A frase não diz o número.');
    } else if (escolhida && typeof escolhida === 'object' && !escolhida.plural) {
      quantidade = 1;
      quantidadeCerta = tipo === 'pesagem' || ARTIGOS.has(tokens[escolhida.indice - 1]);
    }
  }
  if (quantidade !== null && (!Number.isInteger(quantidade) || quantidade <= 0)) {
    avisos.push('A quantidade precisa ser um número inteiro maior que zero.');
    quantidade = null;
  }
  resultado.quantidade = quantidade;

  const negocio = tipo === 'compra' || tipo === 'venda';
  if (negocio) {
    if (valor !== null && porCabeca && quantidade) {
      avisos.push(`Valor total: ${quantidade} × ${formatarReais(valor)}.`);
      valor *= quantidade;
    }
    resultado.valor = valor;
  }
  if (tipo === 'pesagem') resultado.pesoKg = peso;

  // 4. O que falta confirmar
  const faltando = resultado.faltando;
  if (resultado.tipo === 'desconhecido') faltando.push('tipo');
  if (resultado.categoria === 'desconhecida') faltando.push('categoria');
  if (quantidade === null || !quantidadeCerta) faltando.push('quantidade');
  if (negocio && (resultado.valor === null || !valorCerto)) faltando.push('valor');
  if (tipo === 'pesagem' && (peso === null || !pesoCerto)) faltando.push('pesoKg');

  const baixa = incerto || valorInvalido || resultado.tipo === 'desconhecido'
    || resultado.categoria === 'desconhecida' || quantidade === null;
  resultado.confianca = baixa ? 'baixa' : faltando.length > 0 ? 'media' : 'alta';
  return resultado;
}
