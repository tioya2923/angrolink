import { useEffect, useRef, useState } from 'react';
import type { Utilizador } from '@/tipos';
import { supabase } from '@/services/supabase';

export const EVENTO_SINCRONIZAR_PERFIL_PARCEIRO = 'angrolink:sincronizar-perfil-parceiro';

type PerfilParceiro = Pick<Utilizador, 'id' | 'papel'> | null;

type EventoParceiro = {
  new: { atualizado_em?: unknown };
};

export function useSincronizacaoPerfilParceiro(
  utilizador: PerfilParceiro,
  recarregarPerfil: () => Promise<boolean>,
) {
  const [sincronizando, setSincronizando] = useState(false);
  const recarregarPerfilRef = useRef(recarregarPerfil);

  useEffect(() => {
    recarregarPerfilRef.current = recarregarPerfil;
  }, [recarregarPerfil]);

  useEffect(() => {
    if (utilizador?.papel !== 'parceiro_entrega' || !utilizador.id) {
      setSincronizando(false);
      return;
    }

    setSincronizando(false);
    let ativo = true;
    let emCurso = false;
    let recarregamentoPendente = false;
    let ultimaVersao: string | null = null;

    const sincronizar = async () => {
      if (emCurso) {
        recarregamentoPendente = true;
        return;
      }

      setSincronizando(true);
      do {
        recarregamentoPendente = false;
        emCurso = true;
        try {
          await recarregarPerfilRef.current();
        } catch {
        // Mantém o último estado conhecido até à próxima sincronização segura.
        } finally {
          emCurso = false;
        }
      } while (ativo && recarregamentoPendente);

      if (ativo) setSincronizando(false);
    };

    const processarAtualizacao = (evento: EventoParceiro) => {
      const versao = typeof evento.new.atualizado_em === 'string'
        ? evento.new.atualizado_em
        : null;

      if (versao && versao === ultimaVersao) return;
      ultimaVersao = versao;
      void sincronizar();
    };

    const canal = supabase
      .channel(`perfil-parceiro-entrega-${utilizador.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'parceiros_entrega',
          filter: `user_id=eq.${utilizador.id}`,
        },
        processarAtualizacao,
      )
      .subscribe((estado) => {
        if (estado === 'SUBSCRIBED') void sincronizar();
      });

    const aoFocar = () => void sincronizar();
    const aoRetomarPagina = () => void sincronizar();
    const aoReceberAtualizacaoGlobal = () => {
      void sincronizar();
    };
    const aoFicarVisivel = () => {
      if (document.visibilityState === 'visible') void sincronizar();
    };

    window.addEventListener('focus', aoFocar);
    window.addEventListener('online', aoFocar);
    window.addEventListener('pageshow', aoRetomarPagina);
    window.addEventListener(EVENTO_SINCRONIZAR_PERFIL_PARCEIRO, aoReceberAtualizacaoGlobal);
    document.addEventListener('visibilitychange', aoFicarVisivel);

    return () => {
      ativo = false;
      recarregamentoPendente = false;
      window.removeEventListener('focus', aoFocar);
      window.removeEventListener('online', aoFocar);
      window.removeEventListener('pageshow', aoRetomarPagina);
      window.removeEventListener(EVENTO_SINCRONIZAR_PERFIL_PARCEIRO, aoReceberAtualizacaoGlobal);
      document.removeEventListener('visibilitychange', aoFicarVisivel);
      void supabase.removeChannel(canal);
    };
  }, [utilizador?.id, utilizador?.papel]);

  return sincronizando;
}
