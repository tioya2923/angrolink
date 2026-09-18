import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatPreCompraProduto } from '@/componentes/ChatPreCompraProduto';
import {
  listarCaixaEntradaPreCompra,
  type ItemCaixaEntradaPreCompra,
} from '@/services/chatPreCompra';
import { useNotificacoesSessao } from '@/contextos/NotificacoesContexto';

const LIMITE = 20;

export default function ConversasPreCompra() {
  const { conversaId } = useParams<{ conversaId?: string }>();
  const { atualizar: atualizarNotificacoes } = useNotificacoesSessao();
  const [conversas, setConversas] = useState<ItemCaixaEntradaPreCompra[]>([]);
  const [selecionada, setSelecionada] = useState<ItemCaixaEntradaPreCompra | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erro, setErro] = useState(false);
  const [temMais, setTemMais] = useState(false);
  const [erroDeepLink, setErroDeepLink] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(false);
    try {
      const lista = await listarCaixaEntradaPreCompra({ limite: LIMITE });
      setConversas(lista); setTemMais(lista.length === LIMITE);
    } catch { setErro(true); } finally { setCarregando(false); }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    if (!conversaId) return;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(conversaId)) { setErroDeepLink(true); return; }
    setSelecionada({ id: conversaId, produto_nome: 'produto', contraparte_nome: '', mensagens_nao_lidas: 0, estado: 'aberta', atualizado_em: '', produto_id: '', vendedor_id: '', criado_em: '', encerrada_em: '', encomenda_id: '', ultima_mensagem_em: '', ultima_mensagem_previa: '' });
  }, [conversaId]);

  const marcarLida = useCallback((id: string) => {
    setConversas(atual => atual.map(conversa => conversa.id === id ? { ...conversa, mensagens_nao_lidas: 0 } : conversa));
    void atualizarNotificacoes();
  }, [atualizarNotificacoes]);

  const carregarMais = async () => {
    const ultima = conversas[conversas.length - 1];
    if (!ultima || !temMais || carregandoMais) return;
    setCarregandoMais(true);
    try {
      const lista = await listarCaixaEntradaPreCompra({ limite: LIMITE, antesDe: ultima.atualizado_em, antesId: ultima.id });
      setConversas(atual => [...atual, ...lista.filter(item => !atual.some(existente => existente.id === item.id))]);
      setTemMais(lista.length === LIMITE);
    } catch { setErro(true); } finally { setCarregandoMais(false); }
  };

  return <main className="mx-auto max-w-4xl p-4 sm:p-6">
    <header className="mb-6"><h1 className="flex items-center gap-2 font-titulo text-2xl font-bold"><MessageCircle className="size-6 text-green-700" />Conversas sobre produtos</h1><p className="mt-1 text-sm text-muted-foreground">Dúvidas pré-compra separadas das mensagens operacionais de encomendas.</p></header>
    {erroDeepLink ? <p role="alert" className="rounded-xl border border-destructive/30 p-6 text-center text-sm text-destructive">A conversa indicada não é válida.</p> : carregando ? <p role="status" className="py-10 text-center text-sm text-muted-foreground">A carregar conversas…</p>
      : erro ? <div className="py-10 text-center"><p role="alert" className="text-sm text-destructive">Não foi possível carregar as conversas.</p><Button className="mt-3" variant="outline" onClick={() => void carregar()}>Tentar novamente</Button></div>
        : conversas.length === 0 ? <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">Ainda não existem conversas sobre produtos.</p>
          : <div className="space-y-3">
            {conversas.map(conversa => <button key={conversa.id} type="button" onClick={() => setSelecionada(conversa)} className="w-full rounded-xl border p-4 text-left transition hover:border-green-500 hover:bg-green-50/50">
              <div className="flex items-start justify-between gap-4"><div><p className="font-semibold">{conversa.produto_nome}</p><p className="text-sm text-muted-foreground">{conversa.contraparte_nome}</p></div><div className="text-right text-xs text-muted-foreground"><p>{new Date(conversa.atualizado_em).toLocaleString('pt-PT')}</p>{conversa.mensagens_nao_lidas > 0 && <span className="mt-1 inline-block rounded-full bg-green-700 px-2 py-0.5 font-semibold text-white">{conversa.mensagens_nao_lidas} não lida(s)</span>}</div></div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{conversa.ultima_mensagem_previa || 'Sem mensagens.'}</p><p className="mt-2 text-xs font-medium text-green-800">{conversa.estado === 'somente_leitura' ? 'Conversa ligada a uma encomenda' : 'Conversa aberta'}</p>
            </button>)}
            {temMais && <div className="text-center"><Button type="button" variant="outline" disabled={carregandoMais} onClick={() => void carregarMais()}>{carregandoMais ? 'A carregar…' : 'Carregar mais conversas'}</Button></div>}
          </div>}
    {selecionada && <ChatPreCompraProduto conversaIdInicial={selecionada.id} produtoNome={selecionada.produto_nome} semBotao abrirAutomaticamente aoLer={marcarLida} aoFechar={() => { setSelecionada(null); void carregar(); }} />}
  </main>;
}
