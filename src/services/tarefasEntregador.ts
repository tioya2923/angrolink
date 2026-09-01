import { supabase } from '@/services/supabase';
import type { Json } from '@/types/database.types';

export type EstadoTarefaEntrega = 'atribuida' | 'aceite' | 'chegou_origem' | 'recolhida' | 'chegou_destino' | 'recusada' | 'cancelada' | 'concluida';
export type OperacaoTarefaEntrega = 'carregar' | 'aceitar' | 'recusar' | 'chegada' | 'chegadaDestino' | 'pagamento' | 'codigoEntrega';

export interface TarefaEntregaResumo {
  id: string; encomenda_id: string; codigo_publico: string; estado: EstadoTarefaEntrega;
  atribuido_em: string; aceite_em: string | null; chegou_origem_em: string | null; recolhida_em: string | null; chegou_destino_em?: string | null; recusado_em: string | null; motivo_recusa: string | null;
  tipo_veiculo: string; matricula: string; origem: Json; destino: Json; quantidade_itens: number; requisitos_logisticos: Json;
}
export interface TarefaEntregaDetalhe {
  tarefa: Pick<TarefaEntregaResumo, 'id' | 'estado' | 'atribuido_em' | 'aceite_em' | 'chegou_origem_em' | 'recolhida_em' | 'chegou_destino_em' | 'recusado_em' | 'motivo_recusa'>;
  encomenda: { id: string; codigo_publico: string; estado: string; modalidade: string };
  veiculo: { tipo: string; matricula: string };
  pagamento?: { metodo?: string; estado?: string };
  origem: Record<string, string | null>; destino: Record<string, string | null>;
  itens: Array<{ nome: string; quantidade: number; unidade: string }>;
  requisitos_logisticos: Record<string, Json>;
}

const mensagensSeguras: Record<OperacaoTarefaEntrega, string> = {
  carregar: 'Não foi possível carregar a tarefa.',
  aceitar: 'Não foi possível aceitar a tarefa. Tenta novamente.',
  recusar: 'Não foi possível recusar a tarefa. Tenta novamente.',
  chegada: 'Não foi possível confirmar a chegada. Tenta novamente.',
  chegadaDestino: 'Não foi possível confirmar a chegada ao destino. Tenta novamente.',
  pagamento: 'Não foi possível registar o pagamento. Tenta novamente.',
  codigoEntrega: 'Não foi possível validar o código de entrega. Tenta novamente.',
};

type ErroRpc = { code?: unknown; message?: unknown };

/** Erro de domínio que passou pela lista branca do serviço. Mantido privado ao módulo. */
class ErroTarefaSeguro extends Error {
  readonly seguro = true;

  constructor(message: string, readonly operacao: OperacaoTarefaEntrega) {
    super(message);
    this.name = 'ErroTarefaSeguro';
  }
}

const mensagensDominioPorOperacao: Record<OperacaoTarefaEntrega, readonly string[]> = {
  carregar: [
    'Sessão inválida.',
    'Tarefa não encontrada ou sem permissão.',
  ],
  aceitar: [
    'Sessão inválida.',
    'Tarefa não encontrada ou sem permissão.',
    'Esta tarefa já não está disponível para aceite.',
    'A encomenda já não é uma entrega válida.',
    'A conta ou veículo já não está elegível para esta tarefa.',
    'Esta tarefa foi atualizada por outra operação.',
  ],
  recusar: [
    'Sessão inválida.',
    'Indique um motivo entre 3 e 500 caracteres.',
    'Tarefa não encontrada ou sem permissão.',
    'Esta tarefa já não está disponível para recusa.',
    'Esta tarefa foi atualizada por outra operação.',
  ],
  chegada: [
    'Sessão inválida.',
    'Tarefa não encontrada ou sem permissão.',
    'A encomenda já não está disponível para recolha.',
    'A tarefa precisa estar aceite antes de confirmar a chegada.',
    'Inconsistência de integridade na recolha.',
  ],
  chegadaDestino: [
    'Sessão inválida.',
    'Tarefa não encontrada ou sem permissão.',
    'A chegada ao destino não pode ser confirmada no estado atual.',
    'Inconsistência de integridade na chegada ao destino.',
  ],
  pagamento: [
    'Sessão inválida.',
    'Tarefa não encontrada ou sem permissão.',
    'O pagamento só pode ser registado depois da chegada ao destino.',
    'Pagamento não encontrado.',
    'Não existe pagamento na entrega pendente para esta encomenda.',
    'O pagamento não pode ser confirmado no estado atual.',
  ],
  codigoEntrega: [
    'Sessão inválida.',
    'Tarefa não encontrada ou sem permissão.',
    'Introduza o código de entrega de seis dígitos.',
    'A entrega não pode ser confirmada no estado atual.',
    'Registe primeiro o pagamento aplicável antes de confirmar a entrega.',
  ],
};

function mensagemDominioControlada(error: unknown, operacao: OperacaoTarefaEntrega): string | null {
  const erro = error as ErroRpc | null;
  if (erro?.code !== 'P0001' || typeof erro.message !== 'string') return null;

  const mensagem = erro.message.trim();
  return mensagensDominioPorOperacao[operacao].includes(mensagem) ? mensagem : null;
}

/** Nunca deixa detalhes de PostgREST, SQL ou schema chegarem ao browser. */
export function mensagemErroTarefa(error: unknown, operacao: OperacaoTarefaEntrega): string {
  return mensagemDominioControlada(error, operacao) ?? mensagensSeguras[operacao];
}

/** Só erros marcados pelo serviço podem conservar a mensagem original no componente. */
export function mensagemApresentavelTarefa(error: unknown, operacao: OperacaoTarefaEntrega): string {
  return error instanceof ErroTarefaSeguro && error.operacao === operacao ? error.message : mensagensSeguras[operacao];
}

function erroTarefaSeguro(error: unknown, operacao: OperacaoTarefaEntrega): ErroTarefaSeguro {
  return new ErroTarefaSeguro(mensagemErroTarefa(error, operacao), operacao);
}

export async function listarTarefasEntregador(): Promise<TarefaEntregaResumo[]> {
  const { data, error } = await supabase.rpc('listar_tarefas_entregador');
  if (error) throw erroTarefaSeguro(error, 'carregar');
  return (data ?? []) as unknown as TarefaEntregaResumo[];
}

export async function obterTarefaEntregador(id: string): Promise<TarefaEntregaDetalhe> {
  const { data, error } = await supabase.rpc('obter_tarefa_entregador', { p_atribuicao_id: id });
  if (error || !data) throw erroTarefaSeguro(error, 'carregar');
  return data as unknown as TarefaEntregaDetalhe;
}

export async function aceitarTarefaEntrega(id: string): Promise<void> {
  const { error } = await supabase.rpc('aceitar_atribuicao_entrega', { p_atribuicao_id: id });
  if (error) throw erroTarefaSeguro(error, 'aceitar');
}

export async function recusarTarefaEntrega(id: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc('recusar_atribuicao_entrega', { p_atribuicao_id: id, p_motivo: motivo.trim() });
  if (error) throw erroTarefaSeguro(error, 'recusar');
}

export async function confirmarChegadaOrigemEntregador(id: string): Promise<void> {
  const { error } = await supabase.rpc('confirmar_chegada_origem_entregador', { p_atribuicao_id: id });
  if (error) throw erroTarefaSeguro(error, 'chegada');
}

type RpcEntregaNova = {
  (nome: 'confirmar_chegada_destino_entregador', args: { p_atribuicao_id: string }): Promise<{ error: { code?: string; message?: string } | null }>;
  (nome: 'registar_pagamento_na_entrega_entregador', args: { p_atribuicao_id: string }): Promise<{ error: { code?: string; message?: string } | null }>;
  (nome: 'validar_codigo_entrega_entregador', args: { p_atribuicao_id: string; p_codigo: string }): Promise<{ data: Array<{ validado: boolean; estado_encomenda: string; tentativas_restantes: number; bloqueado: boolean; motivo: string | null }> | null; error: { code?: string; message?: string } | null }>;
};

// Contrato transitório: a migration desta fase ainda não foi aplicada e os
// tipos gerados serão atualizados no pós-deploy, sem editar o ficheiro gerado.
const rpcEntregaNova = supabase.rpc.bind(supabase) as unknown as RpcEntregaNova;

export async function confirmarChegadaDestinoEntregador(id: string): Promise<void> {
  const { error } = await rpcEntregaNova('confirmar_chegada_destino_entregador', { p_atribuicao_id: id });
  if (error) throw erroTarefaSeguro(error, 'chegadaDestino');
}

export async function registarPagamentoNaEntregaEntregador(id: string): Promise<void> {
  const { error } = await rpcEntregaNova('registar_pagamento_na_entrega_entregador', { p_atribuicao_id: id });
  if (error) throw erroTarefaSeguro(error, 'pagamento');
}

export async function validarCodigoEntregaEntregador(id: string, codigo: string) {
  const { data, error } = await rpcEntregaNova('validar_codigo_entrega_entregador', { p_atribuicao_id: id, p_codigo: codigo.trim() });
  if (error) throw erroTarefaSeguro(error, 'codigoEntrega');
  if (!data?.[0]) throw erroTarefaSeguro(null, 'codigoEntrega');
  return data[0];
}
