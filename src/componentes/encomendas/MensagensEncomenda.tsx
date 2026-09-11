import { FormEvent, useEffect, useRef, useState } from 'react';
import { Loader2, MessageCircle, Send } from 'lucide-react';
import { useAuth } from '@/contextos/AuthContexto';
import { useMensagensEncomenda } from '@/hooks/useMensagensEncomenda';
import type { CanalMensagemEncomenda } from '@/services/mensagensEncomenda';

type MensagensEncomendaProps = {
  encomendaId: string;
  estadoEncomenda: string;
  canal?: CanalMensagemEncomenda;
  atribuicaoEntregaId?: string | null;
  ativo?: boolean;
  bloquearEnvio?: boolean;
};

const ESTADOS_TERMINAIS = new Set(['concluida', 'cancelada', 'recusada']);

function formatarData(data: string) {
  const valor = new Date(data);
  return Number.isNaN(valor.getTime()) ? '' : valor.toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });
}

export function MensagensEncomenda({ encomendaId, estadoEncomenda, canal = 'comprador_vendedor', atribuicaoEntregaId = null, ativo = true, bloquearEnvio = false }: MensagensEncomendaProps) {
  const { utilizador } = useAuth();
  const [corpo, setCorpo] = useState('');
  const [visivel, setVisivel] = useState(false);
  const secaoRef = useRef<HTMLElement | null>(null);
  const terminal = bloquearEnvio || ESTADOS_TERMINAIS.has(estadoEncomenda);
  const {
    mensagens, resumo, aCarregar, aCarregarAnteriores, aEnviar, erro, haAnteriores, carregar, carregarAnteriores, enviar, marcarComoLidas,
  } = useMensagensEncomenda({ encomendaId, ativo, canal, atribuicaoEntregaId });

  useEffect(() => {
    const secao = secaoRef.current;
    if (!secao || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entrada]) => {
      setVisivel(Boolean(entrada?.isIntersecting && entrada.intersectionRatio >= 0.25));
    }, { threshold: 0.25 });
    observer.observe(secao);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (visivel && (resumo?.naoLidas ?? 0) > 0) void marcarComoLidas();
  }, [marcarComoLidas, resumo?.naoLidas, visivel]);

  const submeter = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!corpo.trim()) return;
    if (await enviar(corpo)) setCorpo('');
  };

  return (
    <section ref={secaoRef} aria-labelledby="mensagens-encomenda-titulo" className="mt-6 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageCircle aria-hidden="true" className="h-5 w-5 text-green-800" />
          <h2 id="mensagens-encomenda-titulo" className="text-lg font-bold text-stone-900">Mensagens</h2>
        </div>
        {(resumo?.naoLidas ?? 0) > 0 && <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-900">{resumo?.naoLidas} não lida{resumo?.naoLidas === 1 ? '' : 's'}</span>}
      </div>

      {aCarregar ? <div role="status" className="py-8 text-sm text-stone-600">A carregar mensagens…</div> : (
        <>
          {erro && <div role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{erro} <button type="button" onClick={() => void carregar()} className="ml-2 font-semibold underline">Tentar novamente</button></div>}
          {haAnteriores && <button type="button" onClick={() => void carregarAnteriores()} disabled={aCarregarAnteriores} className="mt-4 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 disabled:opacity-50">{aCarregarAnteriores ? 'A carregar…' : 'Carregar anteriores'}</button>}
          {mensagens.length === 0 ? <p className="py-8 text-sm text-stone-600">Ainda não existem mensagens nesta encomenda.</p> : (
            <ol className="mt-4 space-y-3" aria-label="Histórico de mensagens">
              {mensagens.map((mensagem) => {
                const propria = mensagem.remetenteUserId === utilizador?.id;
                return <li key={mensagem.id} className={`flex ${propria ? 'justify-end' : 'justify-start'}`}>
                  <article className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${propria ? 'bg-green-800 text-white' : 'bg-stone-100 text-stone-900'}`}>
                    <p className="whitespace-pre-wrap break-words">{mensagem.corpo}</p>
                    <time className={`mt-1 block text-[11px] ${propria ? 'text-green-100' : 'text-stone-500'}`} dateTime={mensagem.criadoEm}>{formatarData(mensagem.criadoEm)}</time>
                  </article>
                </li>;
              })}
            </ol>
          )}
        </>
      )}

      {terminal ? <p className="mt-5 rounded-lg bg-stone-100 p-3 text-sm text-stone-700">Esta encomenda está encerrada. O histórico de mensagens continua disponível.</p> : (
        <form onSubmit={(evento) => void submeter(evento)} className="mt-5 border-t border-stone-200 pt-4">
          <label htmlFor={`mensagem-${encomendaId}`} className="sr-only">Nova mensagem</label>
          <textarea id={`mensagem-${encomendaId}`} value={corpo} maxLength={1000} onChange={(evento) => setCorpo(evento.target.value)} disabled={aEnviar} rows={3} placeholder="Escreva uma mensagem…" className="w-full rounded-xl border border-stone-300 p-3 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200 disabled:bg-stone-100" />
          <div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-stone-500">{corpo.length}/1000</span><button type="submit" disabled={aEnviar || !corpo.trim()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:bg-green-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">{aEnviar ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}{aEnviar ? 'A enviar…' : 'Enviar'}</button></div>
        </form>
      )}
    </section>
  );
}
