import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EncomendaDetalheConteudo } from '@/componentes/encomendas/EncomendaDetalheConteudo';
import { useAuth } from '@/contextos/AuthContexto';
import { useEncomendasTempoReal } from '@/hooks/useEncomendasTempoReal';
import { useToast } from '@/hooks/use-toast';
import { fetchDetalheEncomenda, obterCodigoLevantamento, transicionarEncomendaLevantamento, type CodigoLevantamento, type DetalheEncomenda } from '@/services/encomendas';

export default function ClienteEncomendaDetalhe() {
  const { id } = useParams();
  const nav = useNavigate();
  const { toast } = useToast();
  const { utilizador } = useAuth();
  const [encomenda, setEncomenda] = useState<DetalheEncomenda | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [codigo, setCodigo] = useState<CodigoLevantamento | null>(null);
  const [acao, setAcao] = useState(false);

  const carregar = useCallback(async () => {
    if (!id) return;
    try { setEncomenda(await fetchDetalheEncomenda(id)); } catch { toast({ title: 'Não foi possível carregar a encomenda.', variant: 'destructive' }); } finally { setLoading(false); }
  }, [id, toast]);

  useEffect(() => { void carregar(); return () => setCodigo(null); }, [carregar]);
  useEncomendasTempoReal({ ativo: utilizador?.papel === 'cliente', encomendaId: id }, carregar);

  const cancelar = async () => {
    if (!encomenda) return;
    try { setAcao(true); await transicionarEncomendaLevantamento(encomenda.id, 'cancelada', motivo); setDialog(false); toast({ title: 'Encomenda cancelada.' }); await carregar(); } catch { toast({ title: 'Não foi possível cancelar a encomenda.', variant: 'destructive' }); } finally { setAcao(false); }
  };
  const gerar = async () => {
    if (!encomenda) return;
    try { setAcao(true); setCodigo(await obterCodigoLevantamento(encomenda.id)); } catch { toast({ title: 'Não foi possível gerar o código.', description: 'Verifique se o prazo ou o limite de renovações foi atingido.', variant: 'destructive' }); } finally { setAcao(false); }
  };

  if (loading) return <p className="painel-dashboard-form text-sm text-muted-foreground">A carregar encomenda…</p>;
  if (!encomenda) return <p className="painel-dashboard-form text-sm text-muted-foreground">Encomenda não encontrada.</p>;

  return <div className="space-y-5">
    <button onClick={() => nav('/dashboard/encomendas')} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-green-800"><ArrowLeft className="size-4" />Voltar às encomendas</button>
    <EncomendaDetalheConteudo encomenda={encomenda} contexto="cliente" />
    {encomenda.estado === 'aguardando_confirmacao' && <button onClick={() => setDialog(true)} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Cancelar encomenda</button>}
    {encomenda.estado === 'pronta_para_levantamento' && <section className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5"><h2 className="flex items-center gap-2 font-titulo text-lg font-bold text-amber-900"><KeyRound className="size-5" />Código de levantamento</h2>{codigo ? <><p className="mt-3 font-mono text-3xl font-bold tracking-[.25em] text-green-800">{codigo.codigo.slice(0, 3)} {codigo.codigo.slice(3)}</p><p className="mt-2 text-sm text-amber-900">Expira em {new Intl.DateTimeFormat('pt-AO', { timeStyle: 'short' }).format(new Date(codigo.expira_em))}. Apresente este código ao vendedor no momento do levantamento.</p><button disabled={acao} onClick={() => void gerar()} className="mt-4 rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Gerar novo código</button></> : <button disabled={acao} onClick={() => void gerar()} className="mt-4 rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{acao ? 'A gerar…' : 'Gerar código'}</button>}</section>}
    <Dialog open={dialog} onOpenChange={setDialog}><DialogContent><DialogHeader><DialogTitle>Cancelar encomenda?</DialogTitle><DialogDescription>O vendedor será informado. Indique o motivo do cancelamento.</DialogDescription></DialogHeader><textarea value={motivo} onChange={(evento) => setMotivo(evento.target.value)} placeholder="Motivo do cancelamento" className="min-h-24 w-full rounded-lg border p-3 text-sm" /><DialogFooter><button onClick={() => setDialog(false)} className="rounded-lg border px-4 py-2 text-sm">Voltar</button><button disabled={acao || !motivo.trim()} onClick={() => void cancelar()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">{acao ? 'A cancelar…' : 'Cancelar encomenda'}</button></DialogFooter></DialogContent></Dialog>
  </div>;
}
