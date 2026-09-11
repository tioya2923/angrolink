import { supabase } from '@/services/supabase';

export interface MensagemEncomenda {
  id: string;
  encomendaId: string;
  remetenteUserId: string;
  corpo: string;
  criadoEm: string;
}

export interface CursorMensagensEncomenda {
  criadoEm: string;
  id: string;
}

export interface PaginaMensagensEncomenda {
  mensagens: MensagemEncomenda[];
  haAnteriores: boolean;
  cursorAnterior: CursorMensagensEncomenda | null;
}

export interface ResumoMensagensEncomenda {
  totalMensagens: number;
  naoLidas: number;
  ultimaLeituraEm: string | null;
}
export type CanalMensagemEncomenda = 'comprador_vendedor' | 'vendedor_entregador' | 'comprador_entregador';
export type ContextoMensagensEncomenda = { canal?: CanalMensagemEncomenda; atribuicaoEntregaId?: string | null };

function eObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function eTexto(valor: unknown): valor is string {
  return typeof valor === 'string';
}

function eNumero(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor);
}

function normalizarMensagem(valor: unknown): MensagemEncomenda | null {
  if (!eObjeto(valor)
    || !eTexto(valor.mensagem_id)
    || !eTexto(valor.encomenda_id)
    || !eTexto(valor.remetente_user_id)
    || !eTexto(valor.corpo)
    || !eTexto(valor.criado_em)) {
    return null;
  }

  return {
    id: valor.mensagem_id,
    encomendaId: valor.encomenda_id,
    remetenteUserId: valor.remetente_user_id,
    corpo: valor.corpo,
    criadoEm: valor.criado_em,
  };
}

function erroSeguro(padrao: string, erro: { message: string } | null): Error {
  const mensagensPermitidas = [
    'Sessão inválida.',
    'Sem permissão para consultar as mensagens desta encomenda.',
    'Sem permissão para enviar mensagens nesta encomenda.',
    'Sem permissão para marcar as mensagens desta encomenda.',
    'A mensagem não pode estar vazia.',
    'A mensagem não pode exceder 1000 caracteres.',
    'Esta encomenda está encerrada e não aceita novas mensagens.',
  ];

  return new Error(erro && mensagensPermitidas.includes(erro.message) ? erro.message : padrao);
}

export async function listarMensagensEncomenda(
  encomendaId: string,
  cursor: CursorMensagensEncomenda | null = null,
  limite = 40,
  contexto: ContextoMensagensEncomenda = {},
): Promise<PaginaMensagensEncomenda> {
  const limiteSeguro = Math.min(Math.max(limite, 1), 50);
  const { data, error } = await supabase.rpc('listar_mensagens_encomenda', {
    p_encomenda_id: encomendaId,
    p_limite: limiteSeguro,
    p_antes_de: cursor?.criadoEm ?? null,
    p_antes_id: cursor?.id ?? null,
    p_canal: contexto.canal ?? 'comprador_vendedor',
    p_atribuicao_entrega_id: contexto.atribuicaoEntregaId ?? null,
  });
  if (error) throw erroSeguro('Não foi possível carregar as mensagens desta encomenda.', error);

  const decrescentes = (data ?? []).map(normalizarMensagem).filter((mensagem): mensagem is MensagemEncomenda => mensagem !== null);
  const maisAntiga = decrescentes.at(-1) ?? null;
  return {
    mensagens: [...decrescentes].reverse(),
    haAnteriores: decrescentes.length === limiteSeguro,
    cursorAnterior: maisAntiga ? { criadoEm: maisAntiga.criadoEm, id: maisAntiga.id } : null,
  };
}

export async function enviarMensagemEncomenda(encomendaId: string, corpo: string, contexto: ContextoMensagensEncomenda = {}): Promise<string> {
  const { data, error } = await supabase.rpc('enviar_mensagem_encomenda', {
    p_encomenda_id: encomendaId,
    p_corpo: corpo,
    p_canal: contexto.canal ?? 'comprador_vendedor',
    p_atribuicao_entrega_id: contexto.atribuicaoEntregaId ?? null,
  });
  if (error || !eTexto(data)) throw erroSeguro('Não foi possível enviar a mensagem.', error);
  return data;
}

export async function marcarMensagensEncomendaComoLidas(encomendaId: string, contexto: ContextoMensagensEncomenda = {}): Promise<void> {
  const { error } = await supabase.rpc('marcar_mensagens_encomenda_como_lidas', {
    p_encomenda_id: encomendaId,
    p_canal: contexto.canal ?? 'comprador_vendedor',
    p_atribuicao_entrega_id: contexto.atribuicaoEntregaId ?? null,
  });
  if (error) throw erroSeguro('Não foi possível atualizar a leitura das mensagens.', error);
}

export async function obterResumoMensagensEncomenda(encomendaId: string, contexto: ContextoMensagensEncomenda = {}): Promise<ResumoMensagensEncomenda> {
  const { data, error } = await supabase.rpc('obter_resumo_mensagens_encomenda', {
    p_encomenda_id: encomendaId,
    p_canal: contexto.canal ?? 'comprador_vendedor',
    p_atribuicao_entrega_id: contexto.atribuicaoEntregaId ?? null,
  });
  if (error || !eObjeto(data)
    || !eNumero(data.total_mensagens)
    || !eNumero(data.nao_lidas)
    || !(data.ultima_leitura_em === null || eTexto(data.ultima_leitura_em))) {
    if (error) throw erroSeguro('Não foi possível carregar o resumo das mensagens.', error);
    throw new Error('Não foi possível carregar o resumo das mensagens.');
  }

  return {
    totalMensagens: data.total_mensagens,
    naoLidas: data.nao_lidas,
    ultimaLeituraEm: data.ultima_leitura_em === null ? null : data.ultima_leitura_em as string,
  };
}
