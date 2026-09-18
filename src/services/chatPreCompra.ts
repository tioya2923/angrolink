import { supabase } from '@/services/supabase';
import type { Database } from '@/types/database.types';

type ConversaPreCompra = Database['public']['Functions']['obter_conversa_pre_compra']['Returns'][number];
type ItemCaixaEntradaPreCompra = Database['public']['Functions']['listar_caixa_entrada_pre_compra']['Returns'][number];
type MensagemPreCompra = Database['public']['Functions']['listar_mensagens_pre_compra']['Returns'][number];
type CursorPreCompra = { antesDe?: string; antesId?: string; limite?: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function exigirUuid(valor: string, campo: string) {
  if (!UUID.test(valor)) throw new Error(`${campo} inválido.`);
}

function erroSeguro() {
  return new Error('Não foi possível concluir esta operação. Tente novamente.');
}

function parametrosCursor(cursor: CursorPreCompra) {
  return {
    p_antes_de: cursor.antesDe,
    p_antes_id: cursor.antesId,
    p_limite: cursor.limite,
  };
}

export type { ConversaPreCompra, ItemCaixaEntradaPreCompra, MensagemPreCompra, CursorPreCompra };

export async function abrirOuObterConversaPreCompra(produtoId: string): Promise<ConversaPreCompra> {
  exigirUuid(produtoId, 'Produto');
  const { data, error } = await supabase.rpc('abrir_ou_obter_conversa_pre_compra', { p_produto_id: produtoId });
  if (error || !data?.[0]) throw erroSeguro();
  return data[0];
}

export async function listarCaixaEntradaPreCompra(cursor: CursorPreCompra = {}): Promise<ItemCaixaEntradaPreCompra[]> {
  const { data, error } = await supabase.rpc('listar_caixa_entrada_pre_compra', parametrosCursor(cursor));
  if (error) throw erroSeguro();
  return data ?? [];
}

export async function obterConversaPreCompra(conversaId: string): Promise<ConversaPreCompra> {
  exigirUuid(conversaId, 'Conversa');
  const { data, error } = await supabase.rpc('obter_conversa_pre_compra', { p_conversa_id: conversaId });
  if (error || !data?.[0]) throw erroSeguro();
  return data[0];
}

export async function listarMensagensPreCompra(
  conversaId: string,
  cursor: CursorPreCompra = {},
): Promise<MensagemPreCompra[]> {
  exigirUuid(conversaId, 'Conversa');
  const { data, error } = await supabase.rpc('listar_mensagens_pre_compra', {
    p_conversa_id: conversaId,
    ...parametrosCursor(cursor),
  });
  if (error) throw erroSeguro();
  return data ?? [];
}

export async function enviarMensagemPreCompra(input: {
  conversaId: string;
  corpo: string;
  idempotencyKey: string;
}): Promise<string> {
  exigirUuid(input.conversaId, 'Conversa');
  exigirUuid(input.idempotencyKey, 'Chave de idempotência');
  const { data, error } = await supabase.rpc('enviar_mensagem_pre_compra', {
    p_conversa_id: input.conversaId,
    p_corpo: input.corpo.trim(),
    p_idempotency_key: input.idempotencyKey,
  });
  if (error || typeof data !== 'string') throw erroSeguro();
  return data;
}

export async function marcarConversaPreCompraComoLida(conversaId: string): Promise<void> {
  exigirUuid(conversaId, 'Conversa');
  const { error } = await supabase.rpc('marcar_conversa_pre_compra_como_lida', { p_conversa_id: conversaId });
  if (error) throw erroSeguro();
}

export async function obterTelefoneContraparteEncomenda(encomendaId: string): Promise<string> {
  exigirUuid(encomendaId, 'Encomenda');
  const { data, error } = await supabase.rpc('obter_telefone_contraparte_encomenda', { p_encomenda_id: encomendaId });
  if (error || !data?.[0] || typeof data[0].telefone !== 'string') throw erroSeguro();
  return data[0].telefone;
}
