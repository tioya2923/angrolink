import { useEffect, useRef } from 'react';
import { supabase } from '@/services/supabase';

type OpcoesEncomendasTempoReal = {
  ativo: boolean;
  encomendaId?: string;
};

/**
 * Escuta apenas as tabelas transacionais no ecrã que delas necessita.
 * A entrega de linhas continua limitada pela RLS do Supabase; este hook só
 * agrupa alterações próximas para evitar vários refetches da mesma transação.
 */
export function useEncomendasTempoReal(
  { ativo, encomendaId }: OpcoesEncomendasTempoReal,
  aoAtualizar: () => void | Promise<void>,
) {
  const callbackRef = useRef(aoAtualizar);

  useEffect(() => {
    callbackRef.current = aoAtualizar;
  }, [aoAtualizar]);

  useEffect(() => {
    if (!ativo) return;

    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const atualizar = () => {
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        void callbackRef.current();
      }, 150);
    };

    const sufixo = encomendaId ?? 'lista';
    let canal = supabase.channel(`encomendas-${sufixo}`);

    canal = canal.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'encomendas',
        ...(encomendaId ? { filter: `id=eq.${encomendaId}` } : {}),
      },
      atualizar,
    );

    canal = canal.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'eventos_encomenda',
        ...(encomendaId ? { filter: `encomenda_id=eq.${encomendaId}` } : {}),
      },
      atualizar,
    );

    canal.subscribe();

    return () => {
      if (temporizador) clearTimeout(temporizador);
      void supabase.removeChannel(canal);
    };
  }, [ativo, encomendaId]);
}
