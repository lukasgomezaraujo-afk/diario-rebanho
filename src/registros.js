// Modelo de registro e validação. Recebe "hoje" por parâmetro para continuar pura.
import { CATEGORIAS, TIPOS_REGISTRO } from './rotulos.js';
import { dataValida } from './formato.js';

const PESO_MAXIMO_KG = 200;

function numeroOuNulo(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  return Number(valor);
}

// Retorna { ok: true, registro } ou { ok: false, erros: [...] }, com mensagens para o produtor.
export function validarRegistro(dados, hojeIso) {
  const erros = [];
  const tipo = dados.tipo;
  const comAnimal = tipo !== 'custo';
  const registro = {
    id: dados.id ?? null,
    tipo,
    categoria: comAnimal ? dados.categoria ?? null : null,
    quantidade: comAnimal ? numeroOuNulo(dados.quantidade) : null,
    valor: numeroOuNulo(dados.valor),
    pesoKg: tipo === 'pesagem' ? numeroOuNulo(dados.pesoKg) : null,
    descricao: tipo === 'custo' ? String(dados.descricao ?? '').trim().slice(0, 80) : '',
    data: dados.data,
    criadoEm: dados.criadoEm ?? null,
  };

  if (!TIPOS_REGISTRO.includes(tipo)) {
    erros.push('Escolha o que aconteceu.');
  } else if (comAnimal) {
    if (!CATEGORIAS.includes(registro.categoria)) erros.push('Escolha o animal.');
    if (!Number.isInteger(registro.quantidade) || registro.quantidade <= 0) {
      erros.push('A quantidade precisa ser um número inteiro maior que zero.');
    }
  }

  if (registro.valor !== null) {
    if (!Number.isFinite(registro.valor)) erros.push('O valor não é um número. Use, por exemplo, 700 ou 1.250,50.');
    else if (registro.valor < 0) erros.push('O valor não pode ser negativo.');
  }
  if (tipo === 'custo' && (registro.valor === null || !(registro.valor > 0))) {
    erros.push('Informe quanto foi gasto.');
  }
  if (tipo === 'compra' || tipo === 'venda' || tipo === 'custo') {
    if (Number.isFinite(registro.valor)) registro.valor = Math.round(registro.valor * 100) / 100;
  } else {
    registro.valor = null;
  }

  if (tipo === 'pesagem') {
    const peso = registro.pesoKg;
    if (peso === null) erros.push('Informe o peso em quilos.');
    else if (!Number.isFinite(peso) || peso <= 0 || peso > PESO_MAXIMO_KG) {
      erros.push(`O peso precisa ficar entre 0 e ${PESO_MAXIMO_KG} kg.`);
    }
  }

  if (!dataValida(registro.data)) erros.push('A data não é válida.');
  else if (registro.data > hojeIso) erros.push('A data não pode ser no futuro.');

  return erros.length > 0 ? { ok: false, erros } : { ok: true, registro };
}

// Mais recentes primeiro; no mesmo dia, o último lançado primeiro.
export function ordenarRegistros(registros) {
  return [...registros].sort((a, b) => b.data.localeCompare(a.data) || (b.criadoEm ?? 0) - (a.criadoEm ?? 0));
}
