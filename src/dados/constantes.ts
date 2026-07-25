/**
 * ========================================
 * CONSTANTES — Dados estáticos
 * ========================================
 */

import { Provincia, Municipio, Categoria, TipoVendedor } from '@/tipos';

// --- Províncias de Angola ---
export const PROVINCIAS: Provincia[] = [
  { id: 'luanda', nome: 'Luanda' },
  { id: 'benguela', nome: 'Benguela' },
  { id: 'huambo', nome: 'Huambo' },
  { id: 'huila', nome: 'Huíla' },
  { id: 'cabinda', nome: 'Cabinda' },
  { id: 'bie', nome: 'Bié' },
  { id: 'malanje', nome: 'Malanje' },
  { id: 'uige', nome: 'Uíge' },
  { id: 'zaire', nome: 'Zaire' },
  { id: 'kwanza-sul', nome: 'Kwanza Sul' },
  { id: 'kwanza-norte', nome: 'Kwanza Norte' },
  { id: 'bengo', nome: 'Bengo' },
  { id: 'cunene', nome: 'Cunene' },
  { id: 'namibe', nome: 'Namibe' },
  { id: 'moxico', nome: 'Moxico' },
  { id: 'lunda-norte', nome: 'Lunda Norte' },
  { id: 'lunda-sul', nome: 'Lunda Sul' },
  { id: 'cuando-cubango', nome: 'Cuando Cubango' },
];

// --- Municípios (amostra para MVP) ---
export const MUNICIPIOS: Municipio[] = [
  { id: 'viana', nome: 'Viana', provincia_id: 'luanda' },
  { id: 'cacuaco', nome: 'Cacuaco', provincia_id: 'luanda' },
  { id: 'belas', nome: 'Belas', provincia_id: 'luanda' },
  { id: 'cazenga', nome: 'Cazenga', provincia_id: 'luanda' },
  { id: 'kilamba-kiaxi', nome: 'Kilamba Kiaxi', provincia_id: 'luanda' },
  { id: 'talatona', nome: 'Talatona', provincia_id: 'luanda' },
  { id: 'lobito', nome: 'Lobito', provincia_id: 'benguela' },
  { id: 'benguela-cidade', nome: 'Benguela', provincia_id: 'benguela' },
  { id: 'catumbela', nome: 'Catumbela', provincia_id: 'benguela' },
  { id: 'huambo-cidade', nome: 'Huambo', provincia_id: 'huambo' },
  { id: 'caala', nome: 'Caála', provincia_id: 'huambo' },
  { id: 'lubango', nome: 'Lubango', provincia_id: 'huila' },
  { id: 'matala', nome: 'Matala', provincia_id: 'huila' },
  { id: 'cabinda-cidade', nome: 'Cabinda', provincia_id: 'cabinda' },
];

// --- Categorias de Produtos ---
export const CATEGORIAS: Categoria[] = [
  { id: 'frescos', nome_categoria: 'Produtos Frescos', icone: 'Leaf', ordem_exibicao: 1 },
  { id: 'graos', nome_categoria: 'Grãos e Cereais', icone: 'Wheat', ordem_exibicao: 2 },
  { id: 'pecuaria', nome_categoria: 'Pecuária', icone: 'Beef', ordem_exibicao: 3 },
  { id: 'bebidas', nome_categoria: 'Bebidas', icone: 'Wine', ordem_exibicao: 4 },
  { id: 'alimentos', nome_categoria: 'Alimentos', icone: 'UtensilsCrossed', ordem_exibicao: 5 },
];

// --- Tipos de vendedor (6 tipos) ---
// --- Tipos de vendedor ---
export const TIPOS_VENDEDOR: {
  valor: TipoVendedor;
  rotulo: string;
  icone: string;
  descricao: string;
  exemplos: string;
}[] = [
  {
    valor: 'produtor',
    rotulo: 'Produtor',
    icone: '🌾',
    descricao: 'Produz diretamente da terra ou cria animais, com ou sem propriedade agrícola formal.',
    exemplos: 'Milho, hortaliças, frutas, gado, galinhas, quintas e fazendas',
  },
  {
    valor: 'revendedor',
    rotulo: 'Revendedor',
    icone: '🔁',
    descricao: 'Compra produtos para revender, em lojas parceiras, mercados ou bancadas.',
    exemplos: 'Revenda em mercados, lojas parceiras, bancada no mercado, venda ambulante',
  },
  {
    valor: 'grossista',
    rotulo: 'Venda por Grosso',
    icone: '📦',
    descricao: 'Vende grandes quantidades para lojas, mercados ou revendedores.',
    exemplos: 'Paletes de bebidas, sacos de arroz, caixas de frango',
  },
  {
    valor: 'loja',
    rotulo: 'Loja',
    icone: '🏪',
    descricao: 'Mini-mercados, mercearias ou lojas que vendem ao consumidor final.',
    exemplos: 'Mercearia, mini-mercado, loja de bairro',
  },
  {
    valor: 'prestador_servico',
    rotulo: 'Prestador de Serviços',
    icone: '🛠️',
    descricao: 'Oferece serviços locais ligados ao transporte, entrega, reparação, mão de obra ou apoio ao comércio.',
    exemplos: 'Transporte, entregas, mecânica, trator, mão de obra',
  },
];

/** Helper: obter badge do tipo de vendedor */
export function obterBadgeVendedor(tipo: TipoVendedor): { icone: string; rotulo: string } {
  const t = TIPOS_VENDEDOR.find(tv => tv.valor === tipo);

  if (!t) {
    return { icone: '🏷️', rotulo: 'Vendedor' };
  }

  const rotuloCurto: Record<TipoVendedor, string> = {
    produtor: 'Produtor',
    grossista: 'Grosso',
    loja: 'Loja',
    revendedor: 'Revendedor',
    prestador_servico: 'Serviços',
  };

  return {
    icone: t.icone,
    rotulo: rotuloCurto[tipo],
  };
}

/** Helper: obter "ícone + rótulo completo" do tipo de vendedor (ex: para listas de admin) */
export function obterRotuloCompletoVendedor(tipo: string): string {
  const t = TIPOS_VENDEDOR.find(tv => tv.valor === tipo);
  return t ? `${t.icone} ${t.rotulo}` : tipo;
}

// --- Unidades de medida ---
export const UNIDADES = [
  { valor: 'kg', rotulo: 'Kg' },
  { valor: 'saco', rotulo: 'Saco' },
  { valor: 'caixa', rotulo: 'Caixa' },
  { valor: 'litro', rotulo: 'Litro' },
  { valor: 'unidade', rotulo: 'Unidade' },
  { valor: 'animal', rotulo: 'Animal' },
] as const;

// --- Tipos de venda ---
export const TIPOS_VENDA = [
  { valor: 'grosso', rotulo: 'Grosso' },
  { valor: 'retalho', rotulo: 'Retalho' },
  { valor: 'ambos', rotulo: 'Ambos' },
] as const;
