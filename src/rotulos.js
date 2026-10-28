// Nomes, categorias e frases que a interface e o interpretador compartilham.
import { formatarNumero, formatarReais } from './formato.js';

export const TIPOS = ['nascimento', 'morte', 'compra', 'venda', 'pesagem'];
// "custo" só entra pelo registro rápido: não é acontecimento com animal.
export const TIPOS_REGISTRO = [...TIPOS, 'custo'];

export const ROTULOS_TIPO = {
  nascimento: 'Nascimento',
  morte: 'Morte',
  compra: 'Compra',
  venda: 'Venda',
  pesagem: 'Pesagem',
  custo: 'Custo',
};

export const CATEGORIAS = ['cabra', 'bode', 'cabrito', 'cabrita', 'ovelha', 'carneiro', 'borrego', 'matriz', 'reprodutor'];

const NOMES = {
  cabra: ['cabra', 'cabras'],
  bode: ['bode', 'bodes'],
  cabrito: ['cabrito', 'cabritos'],
  cabrita: ['cabrita', 'cabritas'],
  ovelha: ['ovelha', 'ovelhas'],
  carneiro: ['carneiro', 'carneiros'],
  borrego: ['borrego', 'borregos'],
  matriz: ['matriz', 'matrizes'],
  reprodutor: ['reprodutor', 'reprodutores'],
};

// Explicação curta para quem não conhece o termo técnico.
export const EXPLICACOES = {
  cabra: 'fêmea adulta (caprino)',
  bode: 'macho adulto (caprino)',
  cabrito: 'filhote macho de cabra',
  cabrita: 'filhote fêmea de cabra',
  ovelha: 'fêmea adulta (ovino)',
  carneiro: 'macho adulto (ovino)',
  borrego: 'filhote de ovelha (cordeiro)',
  matriz: 'fêmea separada para dar cria',
  reprodutor: 'macho usado para cobrir as fêmeas',
};

export function nomeCategoria(categoria, quantidade) {
  const formas = NOMES[categoria];
  if (!formas) return quantidade === 1 ? 'animal' : 'animais';
  return quantidade === 1 ? formas[0] : formas[1];
}

// Frase curta para mostrar um registro: "nasceram 2 cabritos".
export function descrever(registro) {
  const { tipo, quantidade, valor, pesoKg, descricao } = registro;
  const animais = `${quantidade ?? '?'} ${nomeCategoria(registro.categoria, quantidade ?? 2)}`;
  const preco = valor !== null && valor !== undefined ? ` por ${formatarReais(valor)}` : '';
  switch (tipo) {
    case 'nascimento': return `${quantidade === 1 ? 'nasceu' : 'nasceram'} ${animais}`;
    case 'morte': return `${quantidade === 1 ? 'morreu' : 'morreram'} ${animais}`;
    case 'compra': return `compra de ${animais}${preco}`;
    case 'venda': return `venda de ${animais}${preco}`;
    case 'pesagem': return `pesagem de ${animais}${pesoKg ? `: ${formatarNumero(pesoKg)} kg` : ''}`;
    case 'custo': return `gasto${descricao ? ` com ${descricao}` : ''} de ${formatarReais(valor ?? 0)}`;
    default: return 'não entendi o que aconteceu';
  }
}
