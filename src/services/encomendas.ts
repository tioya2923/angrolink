import type { CriarEncomendaLevantamentoInput, ItemEncomendaSolicitado } from '@/dominio/encomendas';
import { validarItemEncomendaSolicitado } from '@/dominio/encomendas';
import { supabase } from '@/services/supabase';
import type { Database, Json } from '@/types/database.types';

type CodigoLevantamentoRpc = Database['public']['Functions']['obter_codigo_levantamento_cliente']['Returns'][number];
type ValidacaoCodigoLevantamentoRpc = Database['public']['Functions']['validar_codigo_levantamento_vendedor']['Returns'][number];
type EncomendaRow = Database['public']['Tables']['encomendas']['Row'];
type ItemEncomenda = Database['public']['Tables']['itens_encomenda']['Row'];
type EventoEncomenda = Database['public']['Tables']['eventos_encomenda']['Row'];

export type CodigoLevantamento = CodigoLevantamentoRpc;
export type ResultadoValidacaoCodigoLevantamento = Omit<ValidacaoCodigoLevantamentoRpc, 'motivo'> & {
  motivo: string | null;
};
export type EncomendaResumo = EncomendaRow & { itens_encomenda: ItemEncomenda[]; vendedor: { nome_comercial: string } | null };
export type DetalheEncomenda = EncomendaResumo & { eventos_encomenda: EventoEncomenda[] };

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
  };
}

export async function criarEncomendaLevantamento(input: CriarEncomendaLevantamentoInput) {
  const { data, error } = await supabase.rpc(
    'criar_encomenda_levantamento',
    prepararCriacaoEncomenda(input),
  );

  if (error) throw error;
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
  const { data, error } = await supabase.from('encomendas').select('*, itens_encomenda(*), eventos_encomenda(*), vendedor:vendedores(nome_comercial)').eq('id', encomendaId).maybeSingle();
  if (error) throw error;
  return data as DetalheEncomenda | null;
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
