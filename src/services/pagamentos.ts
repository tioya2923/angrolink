import { supabase } from '@/services/supabase';
import type { Database } from '@/types/database.types';

type CriarPagamentoRpc = Database['public']['Functions']['criar_pagamento_encomenda']['Returns'];
type CriarTentativaPagamentoRpc = Database['public']['Functions']['criar_tentativa_pagamento']['Returns'];
type PagamentoClienteRpc = Database['public']['Functions']['listar_pagamentos_cliente']['Returns'][number];
type ResumoFinanceiroVendedorRpc = Database['public']['Functions']['listar_resumo_financeiro_vendedor']['Returns'][number];
type PagamentoEncomendaClienteRpc = Database['public']['Functions']['obter_pagamento_encomenda_cliente']['Returns'][number];
type ResumoEncomendaVendedorRpc = Database['public']['Functions']['obter_resumo_financeiro_encomenda_vendedor']['Returns'][number];

export type PagamentoEncomenda = CriarPagamentoRpc;
export type TentativaPagamento = CriarTentativaPagamentoRpc;
export type PagamentoCliente = PagamentoClienteRpc;
export type ResumoFinanceiroVendedor = ResumoFinanceiroVendedorRpc;
export type PagamentoEncomendaCliente = PagamentoEncomendaClienteRpc;
export type ResumoFinanceiroEncomendaVendedor = ResumoEncomendaVendedorRpc;

function criarChaveIdempotencia(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('O navegador não suporta a chave de segurança necessária para iniciar o pagamento.');
  }

  return globalThis.crypto.randomUUID();
}

export async function criarPagamentoEncomenda(encomendaId: string): Promise<PagamentoEncomenda> {
  const { data, error } = await supabase.rpc('criar_pagamento_encomenda', {
    p_encomenda_id: encomendaId,
    p_chave_idempotencia: criarChaveIdempotencia(),
  });

  if (error) throw error;
  if (!data) throw new Error('Não foi possível criar a obrigação financeira da encomenda.');
  return data;
}

export async function criarTentativaPagamento(
  pagamentoId: string,
  metodo: 'pagamento_no_levantamento',
): Promise<TentativaPagamento> {
  const { data, error } = await supabase.rpc('criar_tentativa_pagamento', {
    p_pagamento_id: pagamentoId,
    p_metodo: metodo,
    p_chave_idempotencia: criarChaveIdempotencia(),
  });

  if (error) throw error;
  if (!data) throw new Error('Não foi possível registar a forma de pagamento.');
  return data;
}

/**
 * Cria somente a obrigação financeira pendente e a tentativa de pagamento no
 * levantamento. Não confirma pagamento nem envia valores calculados no browser.
 */
export async function criarObrigacaoPagamentoNoLevantamento(encomendaId: string) {
  const pagamento = await criarPagamentoEncomenda(encomendaId);
  const tentativa = await criarTentativaPagamento(pagamento.id, 'pagamento_no_levantamento');
  return { pagamento, tentativa };
}

export async function listarPagamentosCliente(): Promise<PagamentoCliente[]> {
  const { data, error } = await supabase.rpc('listar_pagamentos_cliente');
  if (error) throw error;
  return data ?? [];
}

export async function obterPagamentoEncomendaCliente(
  encomendaId: string,
): Promise<PagamentoEncomendaCliente | null> {
  const { data, error } = await supabase.rpc('obter_pagamento_encomenda_cliente', {
    p_encomenda_id: encomendaId,
  });
  if (error) throw error;
  return data[0] ?? null;
}

export async function listarResumoFinanceiroVendedor(): Promise<ResumoFinanceiroVendedor[]> {
  const { data, error } = await supabase.rpc('listar_resumo_financeiro_vendedor');
  if (error) throw error;
  return data ?? [];
}

export async function obterResumoFinanceiroEncomendaVendedor(
  encomendaId: string,
): Promise<ResumoFinanceiroEncomendaVendedor | null> {
  const { data, error } = await supabase.rpc('obter_resumo_financeiro_encomenda_vendedor', {
    p_encomenda_id: encomendaId,
  });
  if (error) throw error;
  return data[0] ?? null;
}
