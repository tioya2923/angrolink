import { useCallback, useEffect, useRef, useState } from 'react';
import {
  contarNotificacoesNaoLidas,
  listarNotificacoes,
  marcarNotificacaoComoLida,
  marcarTodasNotificacoesComoLidas,
  subscreverNotificacoes,
  type Notificacao,
} from '@/services/notificacoes';

function ordenarEEliminarDuplicados(notificacoes: Notificacao[]): Notificacao[] {
  const porId = new Map<string, Notificacao>();
  for (const notificacao of notificacoes) porId.set(notificacao.id, notificacao);
  return [...porId.values()].sort((a, b) => Date.parse(b.criado_em) - Date.parse(a.criado_em));
}

export function useNotificacoes(utilizadorId?: string, ativo = true) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [realtimeConectado, setRealtimeConectado] = useState(false);
  const [ultimaRealtime, setUltimaRealtime] = useState<Notificacao | null>(null);
  const versaoRef = useRef(0);
  const notificacoesRef = useRef<Notificacao[]>([]);

  const limpar = useCallback(() => {
    versaoRef.current += 1;
    notificacoesRef.current = [];
    setNotificacoes([]);
    setNaoLidas(0);
    setLoading(false);
    setErro(null);
    setRealtimeConectado(false);
    setUltimaRealtime(null);
  }, []);

  const atualizar = useCallback(async () => {
    if (!utilizadorId || !ativo) return;
    const versao = versaoRef.current;
    setLoading(true);
    setErro(null);
    try {
      const [recentes, totalNaoLidas] = await Promise.all([
        listarNotificacoes(20),
        contarNotificacoesNaoLidas(),
      ]);
      if (versao !== versaoRef.current) return;

      const combinadas = ordenarEEliminarDuplicados([...recentes, ...notificacoesRef.current]);
      notificacoesRef.current = combinadas;
      setNotificacoes(combinadas);
      setNaoLidas(atual => Math.max(atual, totalNaoLidas));
    } catch (causa) {
      if (versao === versaoRef.current) {
        setErro(causa instanceof Error ? causa.message : 'Não foi possível carregar as notificações.');
      }
    } finally {
      if (versao === versaoRef.current) setLoading(false);
    }
  }, [ativo, utilizadorId]);

  const marcarLida = useCallback(async (notificacaoId: string): Promise<boolean> => {
    const existente = notificacoesRef.current.find(notificacao => notificacao.id === notificacaoId);
    if (!existente || existente.lida) return true;

    try {
      await marcarNotificacaoComoLida(notificacaoId);
      const atualizadas = notificacoesRef.current.map(notificacao => (
        notificacao.id === notificacaoId
          ? { ...notificacao, lida: true, lida_em: notificacao.lida_em ?? new Date().toISOString() }
          : notificacao
      ));
      notificacoesRef.current = atualizadas;
      setNotificacoes(atualizadas);
      setNaoLidas(atual => Math.max(0, atual - 1));
      return true;
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível atualizar a notificação.');
      return false;
    }
  }, []);

  const marcarTodas = useCallback(async (): Promise<boolean> => {
    try {
      await marcarTodasNotificacoesComoLidas();
      const atualizadas = notificacoesRef.current.map(notificacao => ({
        ...notificacao,
        lida: true,
        lida_em: notificacao.lida_em ?? new Date().toISOString(),
      }));
      notificacoesRef.current = atualizadas;
      setNotificacoes(atualizadas);
      setNaoLidas(0);
      return true;
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível atualizar as notificações.');
      return false;
    }
  }, []);

  useEffect(() => {
    limpar();
    if (!utilizadorId || !ativo) return undefined;

    const versao = versaoRef.current;
    let aHidratar = true;
    const unsubscribe = subscreverNotificacoes(
      utilizadorId,
      (notificacao) => {
        if (versao !== versaoRef.current) return;
        if (notificacoesRef.current.some(item => item.id === notificacao.id)) return;
        const atualizadas = ordenarEEliminarDuplicados([notificacao, ...notificacoesRef.current]);
        notificacoesRef.current = atualizadas;
        setNotificacoes(atualizadas);
        if (!notificacao.lida) setNaoLidas(atual => atual + 1);
        if (!aHidratar) setUltimaRealtime(notificacao);
      },
      setRealtimeConectado,
    );

    void atualizar().finally(() => {
      if (versao === versaoRef.current) aHidratar = false;
    });

    return () => {
      aHidratar = true;
      unsubscribe();
    };
  }, [ativo, atualizar, limpar, utilizadorId]);

  return {
    notificacoes,
    naoLidas,
    loading,
    erro,
    realtimeConectado,
    ultimaRealtime,
    atualizar,
    marcarLida,
    marcarTodas,
  };
}
