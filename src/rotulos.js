// Nomes, espécies, categorias e frases que a interface e o interpretador compartilham.
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

// Cada espécie tem quatro categorias: fêmea adulta, macho adulto, filhote macho, filhote fêmea.
// O nome da categoria já diz a espécie, então os registros guardam só a categoria.
export const ESPECIES = ['caprino', 'ovino', 'bovino'];

export const NOMES_ESPECIE = {
  caprino: 'Cabras e bodes',
  ovino: 'Ovelhas e carneiros',
  bovino: 'Vacas e bois',
};

export const CATEGORIAS_POR_ESPECIE = {
  caprino: ['cabra', 'bode', 'cabrito', 'cabrita'],
  ovino: ['ovelha', 'carneiro', 'borrego', 'borrega'],
  bovino: ['vaca', 'boi', 'bezerro', 'bezerra'],
};

export const CATEGORIAS = ESPECIES.flatMap((especie) => CATEGORIAS_POR_ESPECIE[especie]);

export const ESPECIE_DA_CATEGORIA = Object.fromEntries(
  ESPECIES.flatMap((especie) => CATEGORIAS_POR_ESPECIE[especie].map((categoria) => [categoria, especie])),
);

const NOMES = {
  cabra: ['cabra', 'cabras'],
  bode: ['bode', 'bodes'],
  cabrito: ['cabrito', 'cabritos'],
  cabrita: ['cabrita', 'cabritas'],
  ovelha: ['ovelha', 'ovelhas'],
  carneiro: ['carneiro', 'carneiros'],
  borrego: ['borrego', 'borregos'],
  borrega: ['borrega', 'borregas'],
  vaca: ['vaca', 'vacas'],
  boi: ['boi', 'bois'],
  bezerro: ['bezerro', 'bezerros'],
  bezerra: ['bezerra', 'bezerras'],
};

// Explicação curta para quem não conhece o termo técnico.
export const EXPLICACOES = {
  cabra: 'fêmea adulta',
  bode: 'macho adulto',
  cabrito: 'filhote macho',
  cabrita: 'filhote fêmea',
  ovelha: 'fêmea adulta',
  carneiro: 'macho adulto',
  borrego: 'filhote macho (cordeiro)',
  borrega: 'filhote fêmea (cordeira)',
  vaca: 'fêmea adulta',
  boi: 'macho adulto (boi ou touro)',
  bezerro: 'filhote macho',
  bezerra: 'filhote fêmea',
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
