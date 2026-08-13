import { useEffect, useRef } from 'react';

export const EVENTO_ATUALIZACAO_TEMPO_REAL = 'angrolink:atualizacao-tempo-real';

export type AlteracaoTempoReal = {
  tabela: string;
  evento: 'INSERT' | 'UPDATE' | 'DELETE';
  novo: Record<string, unknown>;
  anterior: Record<string, unknown>;
};

/**
 * Atualiza páginas que ainda usam estado local quando chega uma alteração do
 * Supabase Realtime. As consultas com React Query são atualizadas pelo
 * fornecedor global; este hook cobre os ecrãs legados durante a transição.
 */
export function useAtualizacaoTempoReal(
  tabelas: readonly string[],
  aoAtualizar: () => void | Promise<void>,
) {
  const callbackRef = useRef(aoAtualizar);
  const tabelasRef = useRef(tabelas);

  useEffect(() => {
    callbackRef.current = aoAtualizar;
    tabelasRef.current = tabelas;
  }, [aoAtualizar, tabelas]);

  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    const receberAlteracao = (event: Event) => {
      const alteracao = (event as CustomEvent<AlteracaoTempoReal>).detail;
      if (!alteracao || !tabelasRef.current.includes(alteracao.tabela)) return;

      // Agrupa alterações relacionadas, como veículo + documentos submetidos
      // na mesma operação, numa única leitura da página.
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        void callbackRef.current();
      }, 150);
    };

    window.addEventListener(EVENTO_ATUALIZACAO_TEMPO_REAL, receberAlteracao);
    return () => {
      if (temporizador) clearTimeout(temporizador);
      window.removeEventListener(EVENTO_ATUALIZACAO_TEMPO_REAL, receberAlteracao);
    };
  }, []);
}
