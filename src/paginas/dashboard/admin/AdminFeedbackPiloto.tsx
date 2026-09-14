import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { atualizarEstadoFeedbackPilotoAdmin, listarFeedbackPilotoAdmin, type CategoriaFeedbackPiloto, type ContextoFeedbackPiloto, type EstadoFeedbackPiloto, type FeedbackPilotoAdmin } from '@/services/feedbackPiloto';

const LIMITE = 20;
type Todos<T extends string> = T | 'todos';

export default function AdminFeedbackPiloto() {
  const { toast } = useToast();
  const [itens, setItens] = useState<FeedbackPilotoAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [papel, setPapel] = useState<Todos<ContextoFeedbackPiloto>>('todos');
  const [categoria, setCategoria] = useState<Todos<CategoriaFeedbackPiloto>>('todos');
  const [estado, setEstado] = useState<Todos<EstadoFeedbackPiloto>>('todos');
  const [nota, setNota] = useState('todos');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [aAtualizar, setAAtualizar] = useState<string | null>(null);
  const pedidoAtual = useRef(0);
  const atualizacaoEmCurso = useRef<string | null>(null);

  const carregar = useCallback(async () => {
    const pedido = ++pedidoAtual.current;
    setCarregando(true); setErro(false);
    try {
      const resposta = await listarFeedbackPilotoAdmin({
        papel: papel === 'todos' ? undefined : papel,
        categoria: categoria === 'todos' ? undefined : categoria,
        estado: estado === 'todos' ? undefined : estado,
        nota: nota === 'todos' ? undefined : Number(nota), limite: LIMITE, offset,
      });
      if (pedido === pedidoAtual.current) { setItens(resposta.itens); setTotal(resposta.paginacao.totalResultados); }
    } catch {
      if (pedido === pedidoAtual.current) setErro(true);
    } finally {
      if (pedido === pedidoAtual.current) setCarregando(false);
    }
  }, [papel, categoria, estado, nota, offset]);

  useEffect(() => { void carregar(); }, [carregar]);
  const definirFiltro = <T extends string>(definir: (valor: T) => void, valor: T) => { definir(valor); setOffset(0); };
  const mudarEstado = async (item: FeedbackPilotoAdmin, novo: EstadoFeedbackPiloto) => {
    if (item.estado === novo || atualizacaoEmCurso.current) return;
    atualizacaoEmCurso.current = item.id; setAAtualizar(item.id);
    try { await atualizarEstadoFeedbackPilotoAdmin(item.id, novo); await carregar(); }
    catch { toast({ title: 'Não foi possível atualizar o estado do feedback. Tenta novamente.', variant: 'destructive' }); }
    finally { atualizacaoEmCurso.current = null; setAAtualizar(null); }
  };
  const filtros = [
    ['Papel', papel, setPapel, [['todos', 'Todos'], ['cliente', 'Cliente'], ['vendedor', 'Vendedor'], ['parceiro_entrega', 'Entregador']]],
    ['Categoria', categoria, setCategoria, [['todos', 'Todas'], ['compra', 'Compra'], ['vendedor', 'Venda'], ['entrega', 'Entrega'], ['pagamento', 'Pagamento'], ['aplicacao', 'Aplicação'], ['outro', 'Outro']]],
    ['Estado', estado, setEstado, [['todos', 'Todos'], ['novo', 'Novo'], ['em_analise', 'Em análise'], ['resolvido', 'Resolvido']]],
    ['Nota', nota, setNota, [['todos', 'Todas'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']]],
  ] as const;

  return <div className="space-y-6">
    <header className="painel-dashboard-cabecalho flex items-center gap-3"><MessageSquare className="relative z-10 size-6 text-primary-foreground" /><div><h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">Feedback do piloto</h1><p className="relative z-10 text-sm text-primary-foreground/80">{total} registo{total === 1 ? '' : 's'} recebidos.</p></div></header>
    <section className="painel-dashboard-form grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{filtros.map(([rotulo, valor, definir, opcoes]) => <label key={rotulo} className="text-xs font-semibold">{rotulo}<Select value={valor} onValueChange={novo => definirFiltro(definir as (v: typeof valor) => void, novo as typeof valor)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{opcoes.map(([v, texto]) => <SelectItem key={v} value={v}>{texto}</SelectItem>)}</SelectContent></Select></label>)}</section>
    {carregando && itens.length === 0 && <p role="status" className="painel-dashboard-form text-sm text-muted-foreground">A carregar feedback…</p>}
    {erro ? <div className="painel-dashboard-form text-destructive">Não foi possível carregar o feedback. <Button variant="link" onClick={() => void carregar()}>Tentar novamente</Button></div> : <>
      {carregando && itens.length > 0 && <p role="status" className="text-sm text-muted-foreground">A atualizar feedback…</p>}
      <div className="grid gap-3">{itens.map(item => <article key={item.id} className="rounded-xl border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold capitalize">{item.categoria} · {item.papel.replace('_', ' ')}</p><p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat('pt-AO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.criadoEm))}</p></div><span className="rounded-full border px-2 py-1 text-xs font-semibold">{item.estado.replace('_', ' ')}</span></div>{item.nota !== null && <p className="mt-3 text-sm">Nota: {item.nota}/5</p>}{item.comentario && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.comentario}</p>}<p className="mt-2 text-xs text-muted-foreground">{item.contactarUtilizador ? 'Autorizou contacto' : 'Não autorizou contacto'}{item.encomendaId ? ` · Encomenda: ${item.encomendaId}` : ''}{item.atribuicaoEntregaId ? ` · Atribuição: ${item.atribuicaoEntregaId}` : ''}</p><div className="mt-4 flex flex-wrap gap-2">{(['novo', 'em_analise', 'resolvido'] as EstadoFeedbackPiloto[]).map(valor => <Button key={valor} size="sm" variant={item.estado === valor ? 'default' : 'outline'} disabled={aAtualizar !== null} onClick={() => void mudarEstado(item, valor)}>{valor === 'em_analise' ? 'Em análise' : valor[0].toUpperCase() + valor.slice(1)}</Button>)}</div></article>)}</div>
      {!carregando && itens.length === 0 && <p className="painel-dashboard-form text-sm text-muted-foreground">Nenhum feedback encontrado.</p>}
      <footer className="flex justify-between"><Button variant="outline" disabled={offset === 0 || carregando} onClick={() => setOffset(valor => Math.max(0, valor - LIMITE))}><ChevronLeft />Anterior</Button><Button variant="outline" disabled={offset + LIMITE >= total || carregando} onClick={() => setOffset(valor => valor + LIMITE)}>Próxima<ChevronRight /></Button></footer>
    </>}
  </div>;
}
