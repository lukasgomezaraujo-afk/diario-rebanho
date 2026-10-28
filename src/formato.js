// Formatação e leitura de valores, números e datas no padrão brasileiro.
// Datas circulam internamente como texto ISO "aaaa-mm-dd".

export function formatarReais(valor) {
  const centavos = Math.round(Number(valor) * 100);
  const absoluto = Math.abs(centavos);
  const inteiro = String(Math.floor(absoluto / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const resto = String(absoluto % 100).padStart(2, '0');
  return `${centavos < 0 ? '-' : ''}R$ ${inteiro},${resto}`;
}

// Sem `casas`: até duas casas, sem zeros sobrando (32 → "32", 18.5 → "18,5").
export function formatarNumero(numero, casas) {
  const texto = casas === undefined
    ? String(Math.round(Number(numero) * 100) / 100)
    : Number(numero).toFixed(casas);
  return texto.replace('.', ',');
}

// Lê o que a pessoa digitou: "1.234,56", "700", "R$ 1.500", "18,5".
// Retorna null para campo vazio e NaN para texto que não é número.
export function lerValorDigitado(texto) {
  if (texto === null || texto === undefined) return null;
  let limpo = String(texto).replace(/r\$/i, '').replace(/\s/g, '');
  if (limpo === '') return null;
  if (limpo.includes(',')) limpo = limpo.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) limpo = limpo.replace(/\./g, '');
  return /^-?\d+(\.\d+)?$/.test(limpo) ? Number(limpo) : NaN;
}

export function dataValida(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [ano, mes, dia] = iso.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

export function formatarData(iso) {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

// "31/12/2025" → "2025-12-31"; data inexistente → null.
export function lerData(texto) {
  const partes = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(texto).trim());
  if (!partes) return null;
  const iso = `${partes[3]}-${partes[2].padStart(2, '0')}-${partes[1].padStart(2, '0')}`;
  return dataValida(iso) ? iso : null;
}

// Data local do aparelho (não UTC), para "hoje" bater com o calendário do produtor.
export function isoDeData(data) {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

export function adicionarDias(iso, dias) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}
