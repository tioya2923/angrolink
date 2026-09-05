import type { CriarEncomendaEntregaInput, CriarEncomendaLevantamentoInput, ItemEncomendaSolicitado } from '@/dominio/encomendas';
import { validarItemEncomendaSolicitado } from '@/dominio/encomendas';
import { supabase } from '@/services/supabase';
import type { Database, Json } from '@/types/database.types';

type CodigoLevantamentoRpc = Database['public']['Functions']['obter_codigo_levantamento_cliente']['Returns'][number];
type ValidacaoCodigoLevantamentoRpc = Database['public']['Functions']['validar_codigo_levantamento_vendedor']['Returns'][number];
type EncomendaRow = Database['public']['Tables']['encomendas']['Row'];
type ItemEncomenda = Database['public']['Tables']['itens_encomenda']['Row'];
type EventoEncomenda = Database['public']['Tables']['eventos_encomenda']['Row'];
type DisputaEncomendaRow = Database['public']['Tables']['disputas_encomenda']['Row'];
type EnderecoEntregaEncomenda = Database['public']['Tables']['enderecos_entrega_encomenda']['Row'];

export type CodigoLevantamento = CodigoLevantamentoRpc;
export interface CodigoEntrega { codigo: string; expira_em: string; geracoes: number; }
export type ResultadoValidacaoCodigoLevantamento = Omit<ValidacaoCodigoLevantamentoRpc, 'motivo'> & {
  motivo: string | null;
};
export type EncomendaResumo = EncomendaRow & { itens_encomenda: ItemEncomenda[]; vendedor: { nome_comercial: string } | null };
export type DetalheEncomenda = EncomendaResumo & {
  eventos_encomenda: EventoEncomenda[];
  enderecos_entrega_encomenda: EnderecoEntregaEncomenda | null;
  entrega_participante: EntregaParticipante | null;
};
export type DisputaEncomenda = DisputaEncomendaRow;

export interface EntregaParticipante {
  atribuicao_id?: string;
  estado: 'nao_aplicavel' | 'nao_atribuido' | 'atribuida' | 'aceite' | 'chegou_origem' | 'recolhida' | 'chegou_destino' | 'recusada' | 'cancelada' | 'concluida';
  atribuido_em?: string;
  aceite_em?: string | null;
  chegou_origem_em?: string | null;
  recolhida_em?: string | null;
  chegou_destino_em?: string | null;
  concluido_em?: string | null;
  recusado_em?: string | null;
  motivo_recusa?: string | null;
  parceiro_entrega_id?: string;
  nome_entregador?: string;
  veiculo?: {
    tipo_veiculo: string | null;
    marca: string | null;
    modelo: string | null;
    matricula: string | null;
    capacidade_kg: number | null;
    capacidade_volume_m3: number | null;
  };
}

function comoEntregaParticipante(valor: Json): EntregaParticipante {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
    throw new Error('Não foi possível interpretar o estado da entrega.');
  }
  if (typeof valor.estado !== 'string') throw new Error('O estado da entrega é inválido.');
  return valor as unknown as EntregaParticipante;
}

export const TIPOS_PROBLEMA_ENCOMENDA = [
  'produto_danificado', 'produto_incorreto', 'quantidade_incorreta',
  'qualidade_inadequada', 'produto_em_falta', 'outro',
] as const;

export type TipoProblemaEncomenda = typeof TIPOS_PROBLEMA_ENCOMENDA[number];

/**
 * Contrato de entrada da RPC `criar_encomenda_levantamento`. Preços, totais
 * e descontos nunca entram neste contrato: são calculados no servidor.
 */
export function prepararItensEncomenda(
  itens: ItemEncomendaSolicitado[],
): ItemEncomendaSolicitado[] {
  if (itens.length === 0) throw new Error('Indique pelo menos um produto para a encomenda.');

  const produtos = new Set<string>();
  return itens.map(item => {
    const erro = validarItemEncomendaSolicitado(item);
    if (erro) throw new Error(erro);
    if (produtos.has(item.produto_id)) throw new Error('Não repita o mesmo produto na encomenda.');
    produtos.add(item.produto_id);
    return { produto_id: item.produto_id, quantidade: item.quantidade };
  });
}

export function prepararCriacaoEncomenda(input: CriarEncomendaLevantamentoInput) {
  const itens: Json[] = prepararItensEncomenda(input.itens).map(item => ({
    produto_id: item.produto_id,
    quantidade: item.quantidade,
  }));

  return {
    p_itens: itens,
    p_modalidade: input.modalidade ?? 'levantamento',
    p_nome_destinatario: input.nomeDestinatario?.trim() || null,
    p_telefone_destinatario: input.telefoneDestinatario?.trim() || null,
    p_observacoes_cliente: input.observacoesCliente?.trim() || null,
    p_idempotency_key: input.idempotencyKey,
  };
}

type RespostaRpcTemporaria<Retorno> = {
  data: Retorno | null;
  error: { message: string } | null;
};

type RpcCheckoutTemporaria = <Args, Retorno>(
  nome: 'criar_encomenda_levantamento' | 'criar_encomenda_entrega',
  argumentos: Args,
) => Promise<RespostaRpcTemporaria<Retorno>>;

// TEMPORÁRIO: remover após aplicar a migration de fecho da Fase 1 e regenerar
// database.types.ts, quando ambas as RPCs passarem a expor p_idempotency_key.
const rpcCheckoutTemporaria =
  supabase.rpc.bind(supabase) as unknown as RpcCheckoutTemporaria;

export async function criarEncomendaLevantamento(input: CriarEncomendaLevantamentoInput) {
  const parametros = prepararCriacaoEncomenda(input);
  const { data, error } = await rpcCheckoutTemporaria<typeof parametros, EncomendaRow>(
    'criar_encomenda_levantamento',
    parametros,
  );

  if (error) throw error;
  if (!data || typeof data.id !== 'string' || typeof data.codigo_publico !== 'string') {
    throw new Error('Não foi possível interpretar a encomenda criada.');
  }
  return data;
}

type EntregaCriada = {
  id: string;
  codigo_publico: string;
  total_centimos: number;
  vendedor_id: string;
  pagamento_id: string;
  estado_pagamento: string;
};

type CriarEncomendaEntregaParametros = Database['public']['Functions']['criar_encomenda_entrega']['Args'];
type CriarEncomendaEntregaParametrosTemporarios = CriarEncomendaEntregaParametros & {
  p_idempotency_key: string;
};

function eEntregaCriada(valor: Json): valor is EntregaCriada {
  return typeof valor === 'object'
    && valor !== null
    && !Array.isArray(valor)
    && typeof valor.id === 'string'
    && typeof valor.codigo_publico === 'string'
    && typeof valor.total_centimos === 'number'
    && typeof valor.vendedor_id === 'string'
    && typeof valor.pagamento_id === 'string'
    && typeof valor.estado_pagamento === 'string';
}

export async function criarEncomendaEntrega(input: CriarEncomendaEntregaInput): Promise<EntregaCriada> {
  const parametros: CriarEncomendaEntregaParametrosTemporarios = {
    p_itens: prepararItensEncomenda(input.itens).map(item => ({
      produto_id: item.produto_id,
      quantidade: item.quantidade,
    })),
    p_destinatario_nome: input.nomeDestinatario.trim(),
    p_destinatario_telefone: input.telefoneDestinatario.trim(),
    p_provincia: input.provincia,
    p_municipio: input.municipio,
    p_bairro: input.bairro.trim(),
    p_endereco_detalhado: input.enderecoDetalhado.trim(),
    p_ponto_referencia: input.pontoReferencia?.trim() || null,
    p_instrucoes_entrega: input.instrucoesEntrega?.trim() || null,
    p_observacoes: input.observacoesCliente?.trim() || null,
    p_idempotency_key: input.idempotencyKey,
  };

  const { data, error } = await rpcCheckoutTemporaria<CriarEncomendaEntregaParametrosTemporarios, Json>('criar_encomenda_entrega', parametros);
  if (error) throw error;
  if (!data || !eEntregaCriada(data)) throw new Error('Não foi possível interpretar a encomenda de entrega criada.');
  return data;
}

export async function fetchEncomendasCliente(): Promise<EncomendaResumo[]> {
  const { data, error } = await supabase.from('encomendas').select('*, itens_encomenda(*), vendedor:vendedores(nome_comercial)').order('criado_em', { ascending: false });
  if (error) throw error;
  return (data ?? []) as EncomendaResumo[];
}

export async function fetchEncomendasVendedor(): Promise<EncomendaResumo[]> {
  const { data, error } = await supabase.from('encomendas').select('*, itens_encomenda(*), vendedor:vendedores(nome_comercial)').order('criado_em', { ascending: false });
  if (error) throw error;
  return (data ?? []) as EncomendaResumo[];
}

export async function fetchDetalheEncomenda(encomendaId: string): Promise<DetalheEncomenda | null> {
  const { data, error } = await supabase
    .from('encomendas')
    .select('*, itens_encomenda(*), eventos_encomenda(*), enderecos_entrega_encomenda(*), vendedor:vendedores(nome_comercial)')
    .eq('id', encomendaId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const detalhe = data as Omit<DetalheEncomenda, 'entrega_participante'>;
  if (detalhe.modalidade_recebimento !== 'entrega') {
    return { ...detalhe, entrega_participante: null };
  }

  const { data: entrega, error: erroEntrega } = await supabase.rpc(
    'obter_entrega_encomenda_participante',
    { p_encomenda_id: encomendaId },
  );
  if (erroEntrega) throw new Error(erroEntrega.message);
  if (!entrega) throw new Error('Não foi possível carregar o estado da entrega.');

  return { ...detalhe, entrega_participante: comoEntregaParticipante(entrega) };
}

export async function fetchDisputaEncomenda(encomendaId: string): Promise<DisputaEncomenda | null> {
  const { data, error } = await supabase
    .from('disputas_encomenda')
    .select('*')
    .eq('encomenda_id', encomendaId)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function abrirDisputaEncomenda(
  encomendaId: string,
  tipoProblema: TipoProblemaEncomenda,
  descricao: string,
) {
  const { data, error } = await supabase.rpc('abrir_disputa_encomenda', {
    p_encomenda_id: encomendaId,
    p_tipo_problema: tipoProblema,
    p_descricao: descricao.trim(),
    p_valor_reclamado_centimos: null,
  });
  if (error) throw error;
  return data;
}

export async function transicionarEncomendaLevantamento(
  encomendaId: string,
  proximoEstado: string,
  motivo?: string,
) {
  const { data, error } = await supabase.rpc(
    'transicionar_encomenda_levantamento',
    {
      p_encomenda_id: encomendaId,
      p_proximo_estado: proximoEstado,
      p_motivo: motivo?.trim() || null,
    },
  );

  if (error) throw error;
  return data;
}

/** Confirma a entrega física ao parceiro já chegado à origem. */
export async function confirmarRecolhaEncomendaVendedor(atribuicaoId: string): Promise<void> {
  const { error } = await supabase.rpc(
    'confirmar_recolha_encomenda_vendedor',
    { p_atribuicao_id: atribuicaoId },
  );
  if (error) throw error;
}

/**
 * Gera ou renova o OTP de levantamento para o cliente dono da encomenda.
 * O valor só deve permanecer em memória enquanto for mostrado ao cliente.
 */
export async function obterCodigoLevantamento(encomendaId: string): Promise<CodigoLevantamento> {
  const { data, error } = await supabase.rpc(
    'obter_codigo_levantamento_cliente',
    { p_encomenda_id: encomendaId },
  );

  if (error) throw error;

  const codigo = data[0];
  if (!codigo) throw new Error('Não foi possível obter o código de levantamento.');
  return codigo;
}

type RpcEntregaOtpTemporaria = (nome: 'obter_codigo_entrega_cliente', argumentos: { p_encomenda_id: string }) => Promise<{ data: CodigoEntrega[] | null; error: { message: string } | null }>;
// TEMPORÁRIO: remover após aplicar a migration de fecho da entrega e regenerar database.types.ts.
const rpcEntregaOtpTemporaria = supabase.rpc.bind(supabase) as unknown as RpcEntregaOtpTemporaria;

export async function obterCodigoEntrega(encomendaId: string): Promise<CodigoEntrega> {
  const { data, error } = await rpcEntregaOtpTemporaria('obter_codigo_entrega_cliente', { p_encomenda_id: encomendaId });
  if (error) throw error;
  if (!data?.[0]) throw new Error('Não foi possível obter o código de entrega.');
  return data[0];
}

/**
 * Valida presencialmente o OTP apresentado ao vendedor. A decisão e a
 * mudança de estado são feitas exclusivamente no servidor.
 */
export async function validarCodigoLevantamento(
  encomendaId: string,
  codigo: string,
): Promise<ResultadoValidacaoCodigoLevantamento> {
  const { data, error } = await supabase.rpc(
    'validar_codigo_levantamento_vendedor',
    {
      p_encomenda_id: encomendaId,
      p_codigo: codigo.trim(),
    },
  );

  if (error) throw error;

  const resultado = data[0];
  if (!resultado) throw new Error('Não foi possível validar o código de levantamento.');

  return {
    ...resultado,
    motivo: resultado.motivo || null,
  };
}
