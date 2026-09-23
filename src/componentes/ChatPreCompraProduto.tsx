import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronUp, MessageCircle, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AcoesCompraProduto } from '@/componentes/carrinho/AcoesCompraProduto';
import { useAuth } from '@/contextos/AuthContexto';
import { useToast } from '@/hooks/use-toast';
import { gerarUuidV4 } from '@/lib/uuid';
import { supabase } from '@/services/supabase';
import type { Produto } from '@/tipos';
import {
  abrirOuObterConversaPreCompra,
  enviarMensagemPreCompra,
  listarMensagensPreCompra,
  marcarConversaPreCompraComoLida,
  obterConversaPreCompra,
  type ConversaPreCompra,
  type MensagemPreCompra,
} from '@/services/chatPreCompra';

type Props = {
  produtoId?: string;
  produtoNome: string;
  vendedorId?: string;
  produto?: Produto;
  conversaIdInicial?: string;
  abrirAutomaticamente?: boolean;
  semBotao?: boolean;
  className?: string;
  aoFechar?: () => void;
  aoLer?: (conversaId: string) => void;
};

const LIMITE_MENSAGENS = 40;

function unirMensagens(atual: MensagemPreCompra[], nova: MensagemPreCompra) {
  return atual.some(mensagem => mensagem.id === nova.id) ? atual : [...atual, nova];
}

function ordenarMensagens(mensagens: MensagemPreCompra[]) {
  return [...mensagens].sort((a, b) => a.criado_em.localeCompare(b.criado_em) || a.id.localeCompare(b.id));
}

export function ChatPreCompraProduto({ produtoId, produtoNome, vendedorId, produto, conversaIdInicial, abrirAutomaticamente = false, semBotao = false, className, aoFechar, aoLer }: Props) {
  const { utilizador } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [aberto, setAberto] = useState(abrirAutomaticamente);
  const [conversa, setConversa] = useState<ConversaPreCompra | null>(null);
  const [mensagens, setMensagens] = useState<MensagemPreCompra[]>([]);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [carregandoAnteriores, setCarregandoAnteriores] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [temMais, setTemMais] = useState(false);
  const chavePendente = useRef<string | null>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const pertoDoFimRef = useRef(true);
  const carregamentoAnteriorRef = useRef<{ altura: number; topo: number } | null>(null);
  const conversaId = conversa?.id ?? conversaIdInicial ?? null;
  const somenteLeitura = conversa?.estado === 'somente_leitura';

  const limpar = useCallback(() => {
    chavePendente.current = null;
    setConversa(null); setMensagens([]); setTexto(''); setErro(false); setTemMais(false);
  }, []);

  const carregar = useCallback(async () => {
    if (!utilizador) return;
    setCarregando(true); setErro(false);
    try {
      const conversaAtual = conversaIdInicial
        ? await obterConversaPreCompra(conversaIdInicial)
        : produtoId ? await abrirOuObterConversaPreCompra(produtoId) : null;
      if (!conversaAtual) throw new Error('Conversa indisponível.');
      const lista = await listarMensagensPreCompra(conversaAtual.id, { limite: LIMITE_MENSAGENS });
      setConversa(conversaAtual);
      setMensagens(ordenarMensagens(lista));
      setTemMais(lista.length === LIMITE_MENSAGENS);
      await marcarConversaPreCompraComoLida(conversaAtual.id);
      aoLer?.(conversaAtual.id);
    } catch { setErro(true); } finally { setCarregando(false); }
  }, [conversaIdInicial, produtoId, utilizador]);

  const abrir = () => {
    if (!utilizador) { navigate('/login', { state: { destino: location.pathname } }); return; }
    if (!conversaIdInicial && (utilizador.papel === 'admin' || (utilizador.papel === 'vendedor' && utilizador.vendedor_id === vendedorId))) {
      toast({ title: 'Não é possível iniciar conversa sobre o próprio produto.', variant: 'destructive' });
      return;
    }
    setAberto(true);
  };

  const fechar = (proximoAberto: boolean) => {
    setAberto(proximoAberto);
    if (!proximoAberto) { limpar(); aoFechar?.(); }
  };

  useEffect(() => {
    limpar();
    if (abrirAutomaticamente) setAberto(true);
  }, [abrirAutomaticamente, conversaIdInicial, produtoId, limpar]);

  useEffect(() => { if (aberto && utilizador) void carregar(); }, [aberto, carregar, utilizador]);

  useEffect(() => {
    if (!aberto || !conversaId || !utilizador?.id) return;
    const canal = supabase.channel(`pre-compra:${conversaId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens_pre_compra', filter: `conversa_id=eq.${conversaId}` }, evento => {
      const { id, conversa_id, corpo, criado_em, remetente_user_id } = evento.new;
      if (typeof id !== 'string' || typeof conversa_id !== 'string' || typeof corpo !== 'string' || typeof criado_em !== 'string' || typeof remetente_user_id !== 'string') return;
      const mensagem: MensagemPreCompra = { id, conversa_id, corpo, criado_em, remetente_user_id };
      setMensagens(atual => ordenarMensagens(unirMensagens(atual, mensagem)));
      if (mensagem.remetente_user_id !== utilizador.id && document.visibilityState === 'visible') {
        void marcarConversaPreCompraComoLida(conversaId).then(() => aoLer?.(conversaId));
      }
    }).subscribe();
    return () => { void supabase.removeChannel(canal); };
  }, [aberto, conversaId, utilizador?.id, aoLer]);

  useEffect(() => {
    const lista = listaRef.current;
    if (!lista || carregando || carregamentoAnteriorRef.current) return;
    if (pertoDoFimRef.current) lista.scrollTop = lista.scrollHeight;
  }, [carregando, mensagens.length]);

  const carregarAnteriores = async () => {
    if (!conversaId || !temMais || carregandoAnteriores || mensagens.length === 0) return;
    const primeira = mensagens[0]; const lista = listaRef.current;
    if (lista) carregamentoAnteriorRef.current = { altura: lista.scrollHeight, topo: lista.scrollTop };
    setCarregandoAnteriores(true);
    try {
      const anteriores = await listarMensagensPreCompra(conversaId, { limite: LIMITE_MENSAGENS, antesDe: primeira.criado_em, antesId: primeira.id });
      setMensagens(atual => ordenarMensagens([...anteriores, ...atual]));
      setTemMais(anteriores.length === LIMITE_MENSAGENS);
      requestAnimationFrame(() => {
        const preservacao = carregamentoAnteriorRef.current; const elemento = listaRef.current;
        if (preservacao && elemento) elemento.scrollTop = preservacao.topo + elemento.scrollHeight - preservacao.altura;
        carregamentoAnteriorRef.current = null;
      });
    } catch { toast({ title: 'Não foi possível carregar mensagens anteriores.', variant: 'destructive' }); carregamentoAnteriorRef.current = null; }
    finally { setCarregandoAnteriores(false); }
  };

  const enviar = async () => {
    if (!conversaId || somenteLeitura || !texto.trim() || texto.trim().length > 1000 || enviando || !utilizador) return;
    const chave = chavePendente.current ?? gerarUuidV4();
    chavePendente.current = chave; setEnviando(true);
    try {
      const id = await enviarMensagemPreCompra({ conversaId, corpo: texto, idempotencyKey: chave });
      setMensagens(atual => ordenarMensagens(unirMensagens(atual, { id, conversa_id: conversaId, corpo: texto.trim(), criado_em: new Date().toISOString(), remetente_user_id: utilizador.id })));
      setTexto(''); chavePendente.current = null;
      pertoDoFimRef.current = true;
    } catch { toast({ title: 'Não foi possível enviar a mensagem. Tente novamente.', variant: 'destructive' }); } finally { setEnviando(false); }
  };

  return <>
    {!semBotao && <Button type="button" variant="outline" className={className} onClick={abrir}><MessageCircle className="size-4 shrink-0" /><span className="min-w-0 break-words">Conversar com o vendedor</span></Button>}
    <Dialog open={aberto} onOpenChange={fechar}><DialogContent className="flex h-[92vh] max-w-2xl flex-col sm:h-[80vh]"><DialogHeader><DialogTitle>Conversar sobre {produtoNome}</DialogTitle><DialogDescription>Conversa privada sobre este produto. O telefone não é partilhado aqui.</DialogDescription></DialogHeader>
      {carregando ? <p className="py-8 text-center text-sm text-muted-foreground" role="status">A carregar conversa…</p> : erro ? <div className="py-8 text-center"><p className="text-sm text-destructive" role="alert">Não foi possível abrir a conversa.</p><Button className="mt-3" variant="outline" onClick={() => void carregar()}>Tentar novamente</Button></div> : <>
        {somenteLeitura && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Esta conversa foi ligada a uma encomenda e está apenas para leitura.{conversa?.encomenda_id && <a className="ml-1 font-semibold underline" href={`/dashboard/encomendas/${conversa.encomenda_id}`}>Ver encomenda</a>}</div>}
        <div ref={listaRef} onScroll={evento => { const elemento = evento.currentTarget; pertoDoFimRef.current = elemento.scrollHeight - elemento.scrollTop - elemento.clientHeight < 80; }} className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border p-3" aria-live="polite">
          {temMais && <div className="text-center"><Button type="button" size="sm" variant="ghost" disabled={carregandoAnteriores} onClick={() => void carregarAnteriores()}><ChevronUp className="size-4" />{carregandoAnteriores ? 'A carregar…' : 'Carregar mensagens anteriores'}</Button></div>}
          {mensagens.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Ainda não existem mensagens. Inicie a conversa.</p> : mensagens.map(mensagem => <div key={mensagem.id} className={mensagem.remetente_user_id === utilizador?.id ? 'ml-auto max-w-[85%] rounded-lg bg-green-800 px-3 py-2 text-sm text-white' : 'mr-auto max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm'}>{mensagem.corpo}</div>)}
        </div>
        {produto && conversa?.estado === 'aberta' && <AcoesCompraProduto produto={produto} conversaPreCompraId={conversa.id} />}
        <div className="space-y-2"><Textarea aria-label="Mensagem" value={texto} maxLength={1000} disabled={enviando || somenteLeitura} onChange={evento => setTexto(evento.target.value)} onKeyDown={evento => { if (evento.key === 'Enter' && !evento.shiftKey) { evento.preventDefault(); void enviar(); } }} placeholder={somenteLeitura ? 'Esta conversa está encerrada.' : 'Escreva uma mensagem'} /><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{texto.length}/1000</span><Button type="button" disabled={enviando || somenteLeitura || !texto.trim()} onClick={() => void enviar()}>{enviando ? 'A enviar…' : <><Send className="size-4" />Enviar</>}</Button></div></div></>}
    </DialogContent></Dialog>
  </>;
}
