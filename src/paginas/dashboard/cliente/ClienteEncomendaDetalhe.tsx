import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EncomendaDetalheConteudo } from '@/componentes/encomendas/EncomendaDetalheConteudo';
import { PagamentoClienteEncomenda } from '@/componentes/encomendas/PagamentoClienteEncomenda';
import { useAuth } from '@/contextos/AuthContexto';
import { useEncomendasTempoReal } from '@/hooks/useEncomendasTempoReal';
import { useToast } from '@/hooks/use-toast';
import { abrirDisputaEncomenda, fetchDetalheEncomenda, fetchDisputaEncomenda, obterCodigoEntrega, obterCodigoLevantamento, TIPOS_PROBLEMA_ENCOMENDA, transicionarEncomendaLevantamento, type CodigoEntrega, type CodigoLevantamento, type DetalheEncomenda, type DisputaEncomenda, type TipoProblemaEncomenda } from '@/services/encomendas';
import { obterPagamentoEncomendaCliente, type PagamentoEncomendaCliente } from '@/services/pagamentos';

export default function ClienteEncomendaDetalhe({ rotaVoltar = '/dashboard/encomendas' }: { rotaVoltar?: string }) {
  const { id } = useParams();
  const nav = useNavigate();
  const { toast } = useToast();
  const { utilizador } = useAuth();
  const [encomenda, setEncomenda] = useState<DetalheEncomenda | null>(null);
  const [disputa, setDisputa] = useState<DisputaEncomenda | null>(null);
  const [pagamento, setPagamento] = useState<PagamentoEncomendaCliente | null>(null);
  const [pagamentoCarregando, setPagamentoCarregando] = useState(false);
  const [pagamentoErro, setPagamentoErro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [codigo, setCodigo] = useState<(CodigoLevantamento | CodigoEntrega) | null>(null);
  const [acao, setAcao] = useState(false);
  const [problemaAberto, setProblemaAberto] = useState(false);
  const [tipoProblema, setTipoProblema] = useState<TipoProblemaEncomenda>('produto_danificado');
  const [descricaoProblema, setDescricaoProblema] = useState('');

  const carregar = useCallback(async () => {
    if (!id) { setErroCarregamento(true); setLoading(false); return; }
    try {
      setLoading(true); setErroCarregamento(false);
      const detalhe = await fetchDetalheEncomenda(id);
      setEncomenda(detalhe);
      setDisputa(detalhe ? await fetchDisputaEncomenda(detalhe.id) : null);
      if (detalhe) {
        try {
          setPagamentoCarregando(true); setPagamentoErro(false);
          setPagamento(await obterPagamentoEncomendaCliente(detalhe.id));
        } catch { setPagamento(null); setPagamentoErro(true); } finally { setPagamentoCarregando(false); }
      }
    } catch {
      setErroCarregamento(true);
      toast({ title: 'Não foi possível carregar a encomenda.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { void carregar(); return () => setCodigo(null); }, [carregar]);
  useEncomendasTempoReal({ ativo: utilizador?.papel === 'cliente' || utilizador?.papel === 'vendedor', encomendaId: id }, carregar);

  const cancelar = async () => {
    if (!encomenda) return;
    try {
      setAcao(true);
      await transicionarEncomendaLevantamento(encomenda.id, 'cancelada', motivo);
      setDialog(false);
      toast({ title: 'Encomenda cancelada.' });
      await carregar();
    } catch {
      toast({ title: 'Não foi possível cancelar a encomenda.', variant: 'destructive' });
    } finally {
      setAcao(false);
    }
  };

  const gerar = async () => {
    if (!encomenda) return;
    try {
      setAcao(true);
      setCodigo(await obterCodigoLevantamento(encomenda.id));
    } catch {
      toast({ title: 'Não foi possível gerar o código.', description: 'Verifique se o prazo ou o limite de renovações foi atingido.', variant: 'destructive' });
    } finally {
      setAcao(false);
    }
  };
  const gerarCodigoEntrega = async () => {
    if (!encomenda) return;
    try { setAcao(true); setCodigo(await obterCodigoEntrega(encomenda.id)); }
    catch { toast({ title: 'Não foi possível gerar o código de entrega.', description: 'Verifique se o prazo ou o limite de renovações foi atingido.', variant: 'destructive' }); }
    finally { setAcao(false); }
  };

  const enviarProblema = async () => {
    if (!encomenda) return;
    try {
      setAcao(true);
      await abrirDisputaEncomenda(encomenda.id, tipoProblema, descricaoProblema);
      setProblemaAberto(false);
      setDescricaoProblema('');
      toast({ title: 'Problema reportado.', description: 'A situação será analisada pela ANGROLINK.' });
      await carregar();
    } catch (erro) {
      toast({ title: 'Não foi possível reportar o problema.', description: erro instanceof Error ? erro.message : 'Tente novamente.', variant: 'destructive' });
    } finally {
      setAcao(false);
    }
  };

  if (loading) return <p className="painel-dashboard-form text-sm text-muted-foreground">A carregar encomenda…</p>;
  if (erroCarregamento) return <div className="painel-dashboard-form text-sm text-destructive"><p>Não foi possível carregar a encomenda.</p><button type="button" onClick={() => void carregar()} className="mt-3 font-semibold underline">Tentar novamente</button></div>;
  if (!encomenda) return <p className="painel-dashboard-form text-sm text-muted-foreground">Encomenda não encontrada.</p>;

  return <div className="space-y-5">
    <button onClick={() => nav(rotaVoltar)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-green-800"><ArrowLeft className="size-4" />Voltar às encomendas</button>
    <EncomendaDetalheConteudo encomenda={encomenda} contexto="cliente" disputa={disputa} />
    <PagamentoClienteEncomenda pagamento={pagamento} carregando={pagamentoCarregando} erro={pagamentoErro} />
    {encomenda.estado === 'aguardando_confirmacao' && <button onClick={() => setDialog(true)} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Cancelar encomenda</button>}
    {encomenda.modalidade_recebimento === 'levantamento' && encomenda.estado === 'pronta_para_levantamento' && (encomenda.estado_levantamento?.codigo_validado ? <section className="rounded-2xl border-2 border-green-200 bg-green-50 p-5"><h2 className="font-titulo text-lg font-bold text-green-950">Código validado</h2><p className="mt-2 text-sm text-green-900">Aguarde a confirmação do pagamento pelo vendedor.</p></section> : <section className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5"><h2 className="flex items-center gap-2 font-titulo text-lg font-bold text-amber-900"><KeyRound className="size-5" />Código de levantamento</h2>{codigo ? <><p className="mt-3 font-mono text-3xl font-bold tracking-[.25em] text-green-800">{codigo.codigo.slice(0, 3)} {codigo.codigo.slice(3)}</p><p className="mt-2 text-sm text-amber-900">Expira em {new Intl.DateTimeFormat('pt-AO', { timeStyle: 'short' }).format(new Date(codigo.expira_em))}. Apresente este código ao vendedor no momento do levantamento.</p><button disabled={acao} onClick={() => void gerar()} className="mt-4 rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Gerar novo código</button></> : <button disabled={acao} onClick={() => void gerar()} className="mt-4 rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{acao ? 'A gerar…' : 'Gerar código'}</button>}</section>)}
    {encomenda.modalidade_recebimento === 'entrega' && encomenda.estado === 'chegou_destino' && (encomenda.entrega_participante?.codigo_entrega_validado ? <section className="rounded-2xl border-2 border-green-200 bg-green-50 p-5"><h2 className="font-titulo text-lg font-bold text-green-950">Código validado</h2><p className="mt-2 text-sm text-green-900">Aguarde a confirmação do pagamento pelo entregador.</p></section> : <section className="rounded-2xl border-2 border-sky-200 bg-sky-50 p-5"><h2 className="flex items-center gap-2 font-titulo text-lg font-bold text-sky-900"><KeyRound className="size-5" />Código de entrega</h2><p className="mt-2 text-sm text-sky-900">O entregador chegou. Partilhe este código apenas depois de confirmar a entrega presencial.</p>{codigo ? <><p className="mt-3 font-mono text-3xl font-bold tracking-[.25em] text-green-800">{codigo.codigo.slice(0, 3)} {codigo.codigo.slice(3)}</p><p className="mt-2 text-sm text-sky-900">Expira em {new Intl.DateTimeFormat('pt-AO', { timeStyle: 'short' }).format(new Date(codigo.expira_em))}.</p><button disabled={acao} onClick={() => void gerarCodigoEntrega()} className="mt-4 rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Gerar novo código</button></> : <button disabled={acao} onClick={() => void gerarCodigoEntrega()} className="mt-4 rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{acao ? 'A gerar…' : 'Gerar código de entrega'}</button>}</section>)}
    {encomenda.estado === 'concluida' && <section className="rounded-2xl border-2 border-green-200 bg-green-50 p-5"><h2 className="font-titulo text-lg font-bold text-green-950">Encomenda concluída</h2><p className="mt-2 text-sm text-green-900">Receção confirmada em {encomenda.concluido_em ? new Intl.DateTimeFormat('pt-AO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(encomenda.concluido_em)) : 'data por confirmar'}.</p>{!disputa && <button disabled={acao} onClick={() => setProblemaAberto(true)} className="mt-4 rounded-lg border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-900">Reportar problema</button>}</section>}
    <Dialog open={dialog} onOpenChange={setDialog}><DialogContent><DialogHeader><DialogTitle>Cancelar encomenda?</DialogTitle><DialogDescription>O vendedor será informado. Indique o motivo do cancelamento.</DialogDescription></DialogHeader><textarea value={motivo} onChange={evento => setMotivo(evento.target.value)} placeholder="Motivo do cancelamento" className="min-h-24 w-full rounded-lg border p-3 text-sm" /><DialogFooter><button onClick={() => setDialog(false)} className="rounded-lg border px-4 py-2 text-sm">Voltar</button><button disabled={acao || !motivo.trim()} onClick={() => void cancelar()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">{acao ? 'A cancelar…' : 'Cancelar encomenda'}</button></DialogFooter></DialogContent></Dialog>
    <Dialog open={problemaAberto} onOpenChange={setProblemaAberto}><DialogContent><DialogHeader><DialogTitle>Reportar problema</DialogTitle><DialogDescription>O envio deste problema não significa reembolso automático. A situação será analisada pela ANGROLINK.</DialogDescription></DialogHeader><label className="grid gap-2 text-sm font-medium">Tipo de problema<select value={tipoProblema} onChange={evento => setTipoProblema(evento.target.value as TipoProblemaEncomenda)} className="rounded-lg border bg-background px-3 py-2 font-normal">{TIPOS_PROBLEMA_ENCOMENDA.map(tipo => <option key={tipo} value={tipo}>{tipo.replace(/_/g, ' ')}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">Descrição<textarea value={descricaoProblema} onChange={evento => setDescricaoProblema(evento.target.value)} maxLength={1000} placeholder="Explique o que aconteceu" className="min-h-28 rounded-lg border p-3 text-sm font-normal" /></label><p className="text-xs text-muted-foreground">{descricaoProblema.trim().length}/1000 caracteres</p><DialogFooter><button onClick={() => setProblemaAberto(false)} className="rounded-lg border px-4 py-2 text-sm">Voltar</button><button disabled={acao || descricaoProblema.trim().length < 3} onClick={() => void enviarProblema()} className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{acao ? 'A enviar…' : 'Enviar problema'}</button></DialogFooter></DialogContent></Dialog>
  </div>;
}
