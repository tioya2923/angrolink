/**
 * ========================================
 * CONSTANTES — Dados estáticos
 * ========================================
 */

import { Categoria, TipoVendedor } from '@/tipos';

// --- Categorias de Produtos ---
export const CATEGORIAS: Categoria[] = [
  { id: 'frescos', nome_categoria: 'Produtos Frescos', icone: 'Leaf', ordem_exibicao: 1 },
  { id: 'graos', nome_categoria: 'Grãos e Cereais', icone: 'Wheat', ordem_exibicao: 2 },
  { id: 'pecuaria', nome_categoria: 'Pecuária', icone: 'Beef', ordem_exibicao: 3 },
  { id: 'bebidas', nome_categoria: 'Bebidas', icone: 'Wine', ordem_exibicao: 4 },
  { id: 'alimentos', nome_categoria: 'Alimentos', icone: 'UtensilsCrossed', ordem_exibicao: 5 },
];

// --- Tipos de vendedor ---
// Reflete os vários níveis do comércio angolano, do informal ao grande retalho.
// Os documentos exigidos por tipo estão definidos em @/dados/documentosVendedor.
export const TIPOS_VENDEDOR: {
  valor: TipoVendedor;
  rotulo: string;
  icone: string;
  descricao: string;
  exemplos: string;
}[] = [
  {
    valor: 'ambulante',
    rotulo: 'Vendedora Ambulante / Zungueira',
    icone: '🧺',
    descricao: 'Vende de forma ambulante, na rua ou de porta em porta, sem local fixo.',
    exemplos: 'Zungueiras, vendedores de rua, venda ambulante de produtos',
  },
  {
    valor: 'quitandeira',
    rotulo: 'Quitandeira',
    icone: '🥬',
    descricao: 'Vende produtos frescos ou variados numa banca informal, dentro ou fora de um mercado.',
    exemplos: 'Banca de fruta e verdura, quitanda de bairro',
  },
  {
    valor: 'produtor',
    rotulo: 'Produtor',
    icone: '🌾',
    descricao: 'Produz diretamente da terra ou cria animais, com ou sem propriedade agrícola formal.',
    exemplos: 'Milho, hortaliças, frutas, gado, galinhas, quintas e fazendas',
  },
  {
    valor: 'mini_mercado',
    rotulo: 'Mini Mercado / Mercearia',
    icone: '🏪',
    descricao: 'Loja pequena e fixa, geralmente de bairro, com produtos variados.',
    exemplos: 'Mercearia, loja de bairro, mini-mercado',
  },
  {
    valor: 'revendedor',
    rotulo: 'Revendedor / Banca de Mercado',
    icone: '🥕',
    descricao: 'Tem uma banca fixa dentro de um mercado municipal ou informal.',
    exemplos: 'Banca no mercado do bairro, banca de talho ou de secos e molhados',
  },
  {
    valor: 'supermercado',
    rotulo: 'Supermercado',
    icone: '🛒',
    descricao: 'Loja de médio ou grande porte, formalizada, com várias secções de produtos.',
    exemplos: 'Supermercados de bairro ou de cadeia local',
  },
  {
    valor: 'hipermercado',
    rotulo: 'Hipermercado / Grande Distribuidor',
    icone: '🏬',
    descricao: 'Grande superfície comercial ou cadeia de distribuição em várias províncias.',
    exemplos: 'Hipermercados, grandes cadeias de distribuição',
  },
  {
    valor: 'grossista',
    rotulo: 'Venda por Grosso',
    icone: '📦',
    descricao: 'Vende grandes quantidades para lojas, mercados ou revendedores.',
    exemplos: 'Paletes de bebidas, sacos de arroz, caixas de frango',
  },
];

/** Helper: obter badge do tipo de vendedor */
export function obterBadgeVendedor(tipo: TipoVendedor): { icone: string; rotulo: string } {
  const t = TIPOS_VENDEDOR.find(tv => tv.valor === tipo);

  if (!t) {
    return { icone: '🏷️', rotulo: 'Vendedor' };
  }

  const rotuloCurto: Record<TipoVendedor, string> = {
    ambulante: 'Ambulante',
    quitandeira: 'Quitandeira',
    produtor: 'Produtor',
    mini_mercado: 'Mini Mercado',
    revendedor: 'Revendedor',
    supermercado: 'Supermercado',
    hipermercado: 'Hipermercado',
    grossista: 'Grosso',
    prestador_servico: 'Serviços',
  };

  return {
    icone: t.icone,
    rotulo: rotuloCurto[tipo],
  };
}

/** Serviços anunciáveis por perfis profissionais. A plataforma não inclui transporte de passageiros. */
export const TIPOS_SERVICO = [
  'Entrega de mercadorias',
  'Transporte de mercadorias',
  'Moagem',
  'Limpeza',
  'Reparação',
  'Aluguer de Equipamento',
  'Mão de obra agrícola',
  'Consultoria',
  'Outros',
] as const;

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
