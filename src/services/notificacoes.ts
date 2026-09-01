import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Json } from '@/types/database.types';
import { supabase } from '@/services/supabase';

export type ContextoNotificacao = 'compra' | 'venda' | 'entrega';

export interface Notificacao {
  id: string;
  utilizador_id: string;
  contexto: ContextoNotificacao;
  tipo: string;
  titulo: string;
  mensagem: string;
  entidade_tipo: string | null;
  entidade_id: string | null;
  url_destino: string | null;
  lida: boolean;
  lida_em: string | null;
  metadata: Json;
  criado_em: string;
}

function eObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function eTexto(valor: unknown): valor is string {
  return typeof valor === 'string';
}

function eJson(valor: unknown): valor is Json {
  return valor === null
    || typeof valor === 'string'
    || typeof valor === 'number'
    || typeof valor === 'boolean'
    || Array.isArray(valor)
    || eObjeto(valor);
}

export function normalizarNotificacao(valor: unknown): Notificacao | null {
  if (!eObjeto(valor)
    || !eTexto(valor.id)
    || !eTexto(valor.utilizador_id)
    || !eTexto(valor.tipo)
    || !eTexto(valor.titulo)
    || !eTexto(valor.mensagem)
    || !eTexto(valor.criado_em)
    || !['compra', 'venda', 'entrega'].includes(String(valor.contexto))
    || typeof valor.lida !== 'boolean'
    || !eJson(valor.metadata)) {
    return null;
  }

  const campoOpcional = (campo: unknown) => campo === null || eTexto(campo);
  if (!campoOpcional(valor.entidade_tipo)
    || !campoOpcional(valor.entidade_id)
    || !campoOpcional(valor.url_destino)
    || !campoOpcional(valor.lida_em)) {
    return null;
  }

  return {
    id: valor.id,
    utilizador_id: valor.utilizador_id,
    contexto: valor.contexto as ContextoNotificacao,
    tipo: valor.tipo,
    titulo: valor.titulo,
    mensagem: valor.mensagem,
    entidade_tipo: valor.entidade_tipo as string | null,
    entidade_id: valor.entidade_id as string | null,
    url_destino: valor.url_destino as string | null,
    lida: valor.lida,
    lida_em: valor.lida_em as string | null,
    metadata: valor.metadata,
    criado_em: valor.criado_em,
  };
}

export function eUrlDestinoInterna(url: string | null): url is string {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//');
}

export async function listarNotificacoes(limite = 20, antesDe?: string): Promise<Notificacao[]> {
  const parametros: { p_limite: number; p_antes_de?: string } = { p_limite: limite };
  if (antesDe) parametros.p_antes_de = antesDe;

  const { data, error } = await supabase.rpc('listar_notificacoes', parametros);
  if (error) throw new Error(error.message || 'Não foi possível carregar as notificações.');

  return (data ?? [])
    .map(normalizarNotificacao)
    .filter((notificacao): notificacao is Notificacao => notificacao !== null)
    .sort((a, b) => Date.parse(b.criado_em) - Date.parse(a.criado_em));
}

export async function contarNotificacoesNaoLidas(): Promise<number> {
  const { data, error } = await supabase.rpc('contar_notificacoes_nao_lidas');
  if (error) throw new Error(error.message || 'Não foi possível contar as notificações.');
  return Math.max(0, Number.isFinite(data) ? data : 0);
}

export async function marcarNotificacaoComoLida(notificacaoId: string): Promise<void> {
  const { error } = await supabase.rpc('marcar_notificacao_como_lida', { p_notificacao_id: notificacaoId });
  if (error) throw new Error(error.message || 'Não foi possível marcar a notificação como lida.');
}

export async function marcarTodasNotificacoesComoLidas(): Promise<void> {
  const { error } = await supabase.rpc('marcar_todas_notificacoes_como_lidas');
  if (error) throw new Error(error.message || 'Não foi possível marcar as notificações como lidas.');
}

export function subscreverNotificacoes(
  utilizadorId: string,
  aoReceber: (notificacao: Notificacao) => void,
  aoEstado?: (conectado: boolean) => void,
): () => void {
  const canal: RealtimeChannel = supabase
    .channel(`angrolink-notificacoes-${utilizadorId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notificacoes',
        filter: `utilizador_id=eq.${utilizadorId}`,
      },
      (payload) => {
        const notificacao = normalizarNotificacao(payload.new);
        if (notificacao && notificacao.utilizador_id === utilizadorId) aoReceber(notificacao);
      },
    )
    .subscribe((estado) => {
      aoEstado?.(estado === 'SUBSCRIBED');
    });

  return () => {
    aoEstado?.(false);
    void supabase.removeChannel(canal);
  };
}
