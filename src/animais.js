// Acompanhamento por animal: cada animal tem uma identificação (nome ou número do brinco)
// e um histórico, formado pelos lançamentos ligados a ele. Funções puras.
import { CATEGORIAS } from './rotulos.js';
import { dataValida } from './formato.js';
import { BASE_VAZIA } from './indicadores.js';

export const ENTRADAS = {
  'ja-estava': 'Já estava no rebanho',
  nascimento: 'Nasceu aqui',
  compra: 'Comprei',
};

const normalizarNome = (texto) => texto.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function historicoDoAnimal(animalId, registros) {
  return registros
    .filter((r) => r.animalId === animalId)
    .sort((a, b) => a.data.localeCompare(b.data) || (a.criadoEm ?? 0) - (b.criadoEm ?? 0));
}

// "no-rebanho", "vendido" ou "morreu", conforme o último lançamento de saída.
export function situacaoDoAnimal(animal, registros) {
  const saida = historicoDoAnimal(animal.id, registros).filter((r) => r.tipo === 'morte' || r.tipo === 'venda').at(-1);
  if (!saida) return { situacao: 'no-rebanho', data: null };
  return { situacao: saida.tipo === 'morte' ? 'morreu' : 'vendido', data: saida.data };
}

export function ultimaPesagem(animalId, registros) {
  const pesagem = historicoDoAnimal(animalId, registros).filter((r) => r.tipo === 'pesagem').at(-1);
  return pesagem ? { pesoKg: pesagem.pesoKg, data: pesagem.data } : null;
}

export function animaisNoRebanho(animais, registros) {
  return animais.filter((a) => situacaoDoAnimal(a, registros).situacao === 'no-rebanho');
}

// Retorna { ok: true, animal } ou { ok: false, erros: [...] }.
export function validarAnimal(dados, hojeIso, animais = [], registros = []) {
  const erros = [];
  const animal = {
    id: dados.id ?? null,
    identificacao: String(dados.identificacao ?? '').trim().slice(0, 40),
    categoria: dados.categoria ?? null,
    entrada: dados.entrada ?? null,
    data: dados.data,
    observacao: String(dados.observacao ?? '').trim().slice(0, 120),
    criadoEm: dados.criadoEm ?? null,
  };
  if (!animal.identificacao) erros.push('Dê um nome ou o número do brinco.');
  if (!CATEGORIAS.includes(animal.categoria)) erros.push('Escolha o animal.');
  if (!(animal.entrada in ENTRADAS)) erros.push('Diga como o animal entrou no rebanho.');
  if (!dataValida(animal.data)) erros.push('A data não é válida.');
  else if (animal.data > hojeIso) erros.push('A data não pode ser no futuro.');
  const repetido = animaisNoRebanho(animais, registros)
    .some((a) => a.id !== animal.id && normalizarNome(a.identificacao) === normalizarNome(animal.identificacao));
  if (animal.identificacao && repetido) erros.push('Já existe um animal com esse nome no rebanho.');
  return erros.length > 0 ? { ok: false, erros } : { ok: true, animal };
}

// O lançamento que o cadastro gera: "nasceu aqui" e "comprei" aumentam o rebanho.
// "Já estava no rebanho" não gera lançamento: o animal entra na contagem inicial.
export function registroDeEntrada(animal, valor = null) {
  if (animal.entrada === 'ja-estava') return null;
  return {
    tipo: animal.entrada,
    categoria: animal.categoria,
    quantidade: 1,
    valor: animal.entrada === 'compra' ? valor : null,
    data: animal.data,
    animalId: animal.id,
  };
}

// Soma um animal que já estava no rebanho à contagem inicial (criando-a, se ainda não existe).
export function somarNaContagem(saldoBase, categoria) {
  const base = saldoBase ?? BASE_VAZIA;
  return { data: base.data, porCategoria: { ...base.porCategoria, [categoria]: (base.porCategoria[categoria] ?? 0) + 1 } };
}
