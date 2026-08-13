import { ReactNode, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contextos/AuthContexto';
import { supabase } from '@/services/supabase';
import {
  AlteracaoTempoReal,
  EVENTO_ATUALIZACAO_TEMPO_REAL,
} from '@/hooks/useAtualizacaoTempoReal';

const TABELAS_TEMPO_REAL = [
  'clientes',
  'vendedores',
  'produtos',
  'servicos',
  'favoritos',
  'historico_contactos',
  'historico_contactos_servicos',
  'parceiros_entrega',
  'veiculos_entrega',
  'documentos_parceiro_entrega',
  'documentos_vendedor',
  'areas_cobertura_entrega',
  'categorias',
] as const;

function pertenceAoUtilizador(alteracao: AlteracaoTempoReal, utilizadorId?: string) {
  if (!utilizadorId) return false;
  const registo = Object.keys(alteracao.novo).length ? alteracao.novo : alteracao.anterior;
  if (alteracao.tabela === 'clientes') return registo.id === utilizadorId;
  return registo.user_id === utilizadorId;
}

export default function AtualizacoesTempoReal({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { utilizador, recarregarPerfil } = useAuth();
  const recarregarPerfilRef = useRef(recarregarPerfil);
  const ultimoRecarregamentoRef = useRef(0);

  useEffect(() => {
    recarregarPerfilRef.current = recarregarPerfil;
  }, [recarregarPerfil]);

  useEffect(() => {
    const canal = supabase
      .channel('angrolink-atualizacoes-globais')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          const alteracao: AlteracaoTempoReal = {
            tabela: payload.table,
            evento: payload.eventType,
            novo: (payload.new || {}) as Record<string, unknown>,
            anterior: (payload.old || {}) as Record<string, unknown>,
          };

          queryClient.invalidateQueries();
          window.dispatchEvent(new CustomEvent(EVENTO_ATUALIZACAO_TEMPO_REAL, { detail: alteracao }));

          const alteraPerfil = ['clientes', 'vendedores', 'parceiros_entrega'].includes(alteracao.tabela);
          const agora = Date.now();
          if (alteraPerfil && pertenceAoUtilizador(alteracao, utilizador?.id) && agora - ultimoRecarregamentoRef.current > 500) {
            ultimoRecarregamentoRef.current = agora;
            void recarregarPerfilRef.current();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [queryClient, utilizador?.id]);

  return <>{children}</>;
}
