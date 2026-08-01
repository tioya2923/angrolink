/**
 * ========================================
 * TIPOS — Definições TypeScript
 * ========================================
 */

// =======================
// ENUMERAÇÕES
// =======================

export type TipoVendedor =
  | 'ambulante'
  | 'quitandeira'
  | 'taxista'
  | 'produtor'
  | 'mini_mercado'
  | 'mercado'
  | 'supermercado'
  | 'hipermercado'
  | 'grossista'
  | 'prestador_servico';

export type StatusVendedorAprovacao =
  | 'pendente'
  | 'aprovado'
  | 'rejeitado'
  | 'suspenso';

export type TipoVenda = 'grosso' | 'retalho' | 'ambos';

export type PlanoVendedor = 'gratuito' | 'destaque' | 'premium';

export type StatusProduto = 'ativo' | 'inativo' | 'pendente';

export type UnidadeProduto =
  | 'kg'
  | 'saco'
  | 'caixa'
  | 'litro'
  | 'unidade'
  | 'animal';

export type PapelUtilizador = 'admin' | 'cliente' | 'vendedor';

export type TipoComprador = 'casa' | 'negocio';

// =======================
// LOCALIZAÇÃO
// =======================

export interface Provincia {
  id: string;
  nome: string;
}

export interface Municipio {
  id: string;
  nome: string;
  provincia_id: string;
}

// =======================
// CATEGORIA
// =======================

export interface Categoria {
  id: string;

  nome_categoria?: string; // legacy
  nome?: string; // supabase

  icone?: string;
  ordem_exibicao?: number;
}

// =======================
// VENDEDOR
// =======================

export interface Vendedor {
  id: string;

  nome_comercial: string;
  nome_responsavel?: string | null;

  email?: string | null;
  telefone_whatsapp?: string | null;
  whatsapp?: string | null;

  provincia: string;
  municipio: string;

  mercado_bairro?: string | null;
  bairro?: string | null;
  endereco_detalhado?: string | null;

  tipo_vendedor: TipoVendedor;

  descricao?: string | null;

  foto_perfil?: string | null;
  capa_loja?: string | null;
  fotos_local?: string[];

  verificado: boolean;

  plano: PlanoVendedor;
  data_inicio_plano?: string | null;
  data_fim_plano?: string | null;

  status_aprovacao?: StatusVendedorAprovacao;

  criado_em?: string;

  // INFO ADICIONAL
  ano_inicio?: number | null;
  data_inicio_atividade?: string | null;
  entrega_disponivel?: boolean;
  horario_atendimento?: string | null;
  tempo_resposta?: string | null;

  // CAMPOS ESPECÍFICOS
  tipo_producao?: string | null;
  area_cultivada?: number | null;
  principais_culturas?: string | null;
  producao_mensal?: string | null;

  venda_grosso?: boolean;
  venda_retalho?: boolean;

  tipos_produtos?: string | null;
  compra_produtores?: boolean;

  volume_minimo?: string | null;
  entrega_outras_provincias?: boolean;

  tipo_loja?: string | null;
  mercado_localizado?: string | null;
  venda_presencial?: boolean;
}

// =======================
// HELPERS
// =======================

export function getEstadoVisual(v: Vendedor) {
  if (v.status_aprovacao === 'aprovado') return 'ativo';
  if (v.status_aprovacao === 'pendente') return 'pendente';
  if (v.status_aprovacao === 'suspenso') return 'suspenso';
  if (v.status_aprovacao === 'rejeitado') return 'rejeitado';
  return 'pendente';
}

// =======================
// PRODUTO
// =======================

export interface Produto {
  id: string;

  nome_produto: string;
  descricao?: string | null;

  categoria_id?: string | null;
  categoria?: Categoria | string | null;
  categoria_nome?: string;
  subcategoria?: string | null;

  preco_aproximado?: number | null;
  preco_grosso?: number | null;
  preco_promocional?: number | null;

  unidade?: UnidadeProduto | string | null;

  tipo_venda?: TipoVenda;

  quantidade_minima?: number | null;
  quantidade_minima_grosso?: number | null;

  imagem_url?: string | null;
  imagem_principal?: string;
  imagens_secundarias?: string[];

  disponivel?: boolean;
  destaque?: boolean;

  status?: StatusProduto;

  vendedor_id?: string | null;
  vendedor?: Vendedor | null;

  provincia?: string | null;
  municipio?: string | null;

  criado_em?: string;
  atualizado_em?: string;
  data_contacto?: string;

  visualizacoes?: number;
  cliques_whatsapp?: number;
}

// =======================
// SERVIÇO
// =======================

export interface Servico {
  id: string;

  vendedor_id?: string | null;
  vendedor?: Vendedor | null;

  nome_servico: string;
  tipo_servico?: string | null;
  descricao?: string | null;

  preco_estimado?: number | null;

  provincia?: string | null;
  municipio?: string | null;
  zona_atuacao?: string | null;

  imagem_url?: string | null;

  disponivel?: boolean;
  destaque?: boolean;

  criado_em?: string;
  data_contacto?: string;

  nome_prestador?: string | null;
  telefone_whatsapp?: string | null;

  visualizacoes?: number;
  cliques_whatsapp?: number;
}

// =======================
// UTILIZADOR
// =======================

export interface Utilizador {
  id: string;
  nome: string;
  email: string;
  telefone: string;

  provincia: string;
  municipio: string;

  papel: PapelUtilizador;

  vendedor_id?: string;

  tipo_comprador?: TipoComprador;

  bairro?: string;
  endereco_detalhado?: string;
  whatsapp?: string;

  foto_perfil?: string | null;

  criado_em?: string;
  atualizado_em?: string;

  termos_aceites?: boolean;

  status_aprovacao?: StatusVendedorAprovacao;
  verificado?: boolean;
  pode_destacar?: boolean;
  conta_ativa?: boolean;
}

// =======================
// CONTACTOS
// =======================

export interface ContactoRecebido {
  id: string;
  produto_id: string;
  nome_produto: string;
  telefone_cliente: string;
  data: string;
}

export interface HistoricoContacto {
  id: string;
  cliente_id: string;
  produto_id: string;
  vendedor_id: string | null;
  nome_produto: string;
  nome_vendedor: string;
  criado_em: string;
  atualizado_em?: string | null;
}

// =======================
// FORMULÁRIOS
// =======================

export interface FormularioVendedor {
  nome_comercial: string;
  nome_responsavel: string;
  telefone_whatsapp: string;
  email: string;
  senha: string;
  provincia: string;
  municipio: string;
  mercado_bairro: string;
  tipo_vendedor: TipoVendedor;
  descricao: string;
  foto_perfil?: File;
  foto_capa?: File;
}

export interface FormularioComprador {
  nome: string;
  telefone: string;
  email: string;
  senha: string;
  provincia: string;
  municipio: string;
}

// =======================
// PEDIDOS (FASE 2)
// =======================

export interface Pedido {
  id: string;
  produto_id: string;
  vendedor_id: string;

  comprador_nome: string;
  comprador_telefone: string;

  quantidade: number;
  valor_estimado: number;

  status: string;
  comissao_calculada: number;

  criado_em: string;
}