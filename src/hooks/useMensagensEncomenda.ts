import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/services/supabase';
import {
  enviarMensagemEncomenda,
  listarMensagensEncomenda,
  marcarMensagensEncomendaComoLidas,
  obterResumoMensagensEncomenda,
  type CursorMensagensEncomenda,
  type CanalMensagemEncomenda,
  type MensagemEncomenda,
  type ResumoMensagensEncomenda,
} from '@/services/mensagensEncomenda';

type OpcoesMensagensEncomenda = {
  encomendaId?: string;
  ativo: boolean;
  canal?: CanalMensagemEncomenda;
  atribuicaoEntregaId?: string | null;
};

function juntarSemDuplicados(anteriores: MensagemEncomenda[], atuais: MensagemEncomenda[]) {
  const porId = new Map<string, MensagemEncomenda>();
  [...anteriores, ...atuais].forEach((mensagem) => porId.set(mensagem.id, mensagem));
  return [...porId.values()].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm) || a.id.localeCompare(b.id));
}

export function useMensagensEncomenda({ encomendaId, ativo, canal: canalMensagem = 'comprador_vendedor', atribuicaoEntregaId = null }: OpcoesMensagensEncomenda) {
  const [mensagens, setMensagens] = useState<MensagemEncomenda[]>([]);
  const [resumo, setResumo] = useState<ResumoMensagensEncomenda | null>(null);
  const [aCarregar, setACarregar] = useState(Boolean(ativo && encomendaId));
  const [aCarregarAnteriores, setACarregarAnteriores] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cursorRef = useRef<CursorMensagensEncomenda | null>(null);
  const haAnterioresRef = useRef(false);
  const geracaoRef = useRef(0);
  const leituraEmCursoRef = useRef(false);
  const resumoRef = useRef<ResumoMensagensEncomenda | null>(null);
  const carregarRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    resumoRef.current = resumo;
  }, [resumo]);

  const carregar = useCallback(async () => {
    if (!ativo || !encomendaId) return;
    const geracao = ++geracaoRef.current;
    setACarregar(true);
    setErro(null);
    try {
      const [pagina, resumoAtual] = await Promise.all([
        listarMensagensEncomenda(encomendaId, null, 40, { canal: canalMensagem, atribuicaoEntregaId }),
        obterResumoMensagensEncomenda(encomendaId, { canal: canalMensagem, atribuicaoEntregaId }),
      ]);
      if (geracao !== geracaoRef.current) return;
      setMensagens(pagina.mensagens);
      cursorRef.current = pagina.cursorAnterior;
      haAnterioresRef.current = pagina.haAnteriores;
      setResumo(resumoAtual);
    } catch (causa) {
      if (geracao === geracaoRef.current) setErro(causa instanceof Error ? causa.message : 'Não foi possível carregar as mensagens.');
    } finally {
      if (geracao === geracaoRef.current) setACarregar(false);
    }
  }, [ativo, atribuicaoEntregaId, canalMensagem, encomendaId]);

  carregarRef.current = carregar;

  useEffect(() => {
    cursorRef.current = null;
    haAnterioresRef.current = false;
    setMensagens([]);
    setResumo(null);
    setErro(null);
  }, [atribuicaoEntregaId, canalMensagem, encomendaId]);

  useEffect(() => {
    void carregar();
    return () => {
      geracaoRef.current += 1;
    };
  }, [carregar]);

  useEffect(() => {
    if (!ativo || !encomendaId) return;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const canalRealtime = supabase
      .channel(`mensagens-encomenda-${encomendaId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'mensagens_encomenda', filter: atribuicaoEntregaId ? `atribuicao_entrega_id=eq.${atribuicaoEntregaId}` : `encomenda_id=eq.${encomendaId}`,
      }, (payload) => {
        const nova = payload.new as { canal?: string; atribuicao_entrega_id?: string | null };
        if (nova.canal !== canalMensagem || (nova.atribuicao_entrega_id ?? null) !== atribuicaoEntregaId) return;
        if (temporizador) clearTimeout(temporizador);
        temporizador = setTimeout(() => { void carregarRef.current(); }, 150);
      });
    canalRealtime.subscribe();
    return () => {
      if (temporizador) clearTimeout(temporizador);
      void supabase.removeChannel(canalRealtime);
    };
  }, [ativo, atribuicaoEntregaId, canalMensagem, encomendaId]);

  const carregarAnteriores = useCallback(async () => {
    if (!encomendaId || !cursorRef.current || !haAnterioresRef.current || aCarregarAnteriores) return;
    setACarregarAnteriores(true);
    try {
      const pagina = await listarMensagensEncomenda(encomendaId, cursorRef.current, 40, { canal: canalMensagem, atribuicaoEntregaId });
      setMensagens((atuais) => juntarSemDuplicados(pagina.mensagens, atuais));
      cursorRef.current = pagina.cursorAnterior;
      haAnterioresRef.current = pagina.haAnteriores;
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível carregar mensagens anteriores.');
    } finally {
      setACarregarAnteriores(false);
    }
  }, [aCarregarAnteriores, atribuicaoEntregaId, canalMensagem, encomendaId]);

  const enviar = useCallback(async (corpo: string) => {
    if (!encomendaId || aEnviar) return false;
    setAEnviar(true);
    setErro(null);
    try {
      await enviarMensagemEncomenda(encomendaId, corpo, { canal: canalMensagem, atribuicaoEntregaId });
      await carregarRef.current();
      return true;
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível enviar a mensagem.');
      return false;
    } finally {
      setAEnviar(false);
    }
  }, [aEnviar, atribuicaoEntregaId, canalMensagem, encomendaId]);

  const marcarComoLidas = useCallback(async () => {
    if (!encomendaId || leituraEmCursoRef.current || (resumoRef.current?.naoLidas ?? 0) <= 0) return false;
    const geracao = geracaoRef.current;
    leituraEmCursoRef.current = true;
    try {
      await marcarMensagensEncomendaComoLidas(encomendaId, { canal: canalMensagem, atribuicaoEntregaId });
      const resumoAtual = await obterResumoMensagensEncomenda(encomendaId, { canal: canalMensagem, atribuicaoEntregaId });
      if (geracao !== geracaoRef.current) return false;
      setResumo(resumoAtual);
      return true;
    } catch (causa) {
      if (geracao === geracaoRef.current) setErro(causa instanceof Error ? causa.message : 'Não foi possível atualizar a leitura das mensagens.');
      return false;
    } finally {
      leituraEmCursoRef.current = false;
    }
  }, [atribuicaoEntregaId, canalMensagem, encomendaId]);

  return {
    mensagens,
    resumo,
    aCarregar,
    aCarregarAnteriores,
    aEnviar,
    erro,
    haAnteriores: haAnterioresRef.current,
    carregar,
    carregarAnteriores,
    enviar,
    marcarComoLidas,
  };
}
