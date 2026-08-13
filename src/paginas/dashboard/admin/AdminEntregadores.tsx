import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  Calendar,
  CarFront,
  Eye,
  FileText,
  MapPin,
  Phone,
  ShieldAlert,
  Truck,
  UserRound,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/contextos/AuthContexto';
import { useAtualizacaoTempoReal } from '@/hooks/useAtualizacaoTempoReal';
import { useToast } from '@/hooks/use-toast';
import {
  atualizarEstadoParceiroEntrega,
  atualizarEstadoDocumentoParceiro,
  EstadoParceiroAdmin,
  fetchParceirosEntregaAdmin,
  obterUrlDocumentoParceiro,
} from '@/services/api';

type Parceiro = Record<string, any>;

const rotuloEstado: Record<EstadoParceiroAdmin, string> = {
  rascunho: 'Em análise',
  documentos_pendentes: 'Documentos pendentes',
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
  suspenso: 'Suspenso',
  documentacao_expirada: 'Documentação expirada',
};

const estiloEstado: Record<EstadoParceiroAdmin, string> = {
  rascunho: 'border-amber-500/40 bg-amber-500/10 text-amber-800',
  documentos_pendentes: 'border-amber-500/40 bg-amber-500/10 text-amber-800',
  em_analise: 'border-amber-500/40 bg-amber-500/10 text-amber-800',
  aprovado: 'border-primary/35 bg-primary/10 text-primary',
  rejeitado: 'border-destructive/35 bg-destructive/10 text-destructive',
  suspenso: 'border-orange-500/40 bg-orange-500/10 text-orange-700',
  documentacao_expirada: 'border-orange-500/40 bg-orange-500/10 text-orange-700',
};

const nomesDocumento: Record<string, string> = {
  bi: 'Bilhete de Identidade',
  carta_conducao: 'Carta de condução',
  livrete_veiculo: 'Livrete / título do veículo',
  seguro_automovel: 'Seguro automóvel',
  inspecao_tecnica: 'Inspeção técnica',
  licenca_transporte_mercadorias: 'Licença de transporte de mercadorias',
};

function estadoPendente(estado: EstadoParceiroAdmin) {
  return ['rascunho', 'documentos_pendentes', 'em_analise'].includes(estado);
}

export default function AdminEntregadores({ apenasPedidos = false }: { apenasPedidos?: boolean }) {
  const { utilizador } = useAuth();
  const { toast } = useToast();
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [filtro, setFiltro] = useState<'todos' | EstadoParceiroAdmin>(apenasPedidos ? 'em_analise' : 'todos');
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const [decisao, setDecisao] = useState<{ parceiro: Parceiro; estado: 'rejeitado' | 'suspenso' } | null>(null);
  const [documentoParaRejeitar, setDocumentoParaRejeitar] = useState<{ parceiroId: string; documento: any } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [motivoDocumento, setMotivoDocumento] = useState('');
  const [aGuardar, setAGuardar] = useState(false);

  const carregar = async () => {
    try {
      setACarregar(true);
      setParceiros(await fetchParceirosEntregaAdmin());
    } catch {
      toast({ title: 'Erro ao carregar entregadores', description: 'Não foi possível consultar os parceiros de entregas.', variant: 'destructive' });
    } finally {
      setACarregar(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  useAtualizacaoTempoReal(
    ['parceiros_entrega', 'veiculos_entrega', 'documentos_parceiro_entrega', 'areas_cobertura_entrega'],
    carregar,
  );

  const contadores = useMemo(() => ({
    pendentes: parceiros.filter(p => estadoPendente(p.estado)).length,
    aprovados: parceiros.filter(p => p.estado === 'aprovado').length,
    suspensos: parceiros.filter(p => p.estado === 'suspenso').length,
    rejeitados: parceiros.filter(p => p.estado === 'rejeitado').length,
  }), [parceiros]);

  const visiveis = parceiros.filter(p => filtro === 'todos' || p.estado === filtro || (filtro === 'em_analise' && estadoPendente(p.estado)));

  const atualizar = async (parceiro: Parceiro, estado: EstadoParceiroAdmin, motivoDecisao?: string) => {
    try {
      setAGuardar(true);
      await atualizarEstadoParceiroEntrega(parceiro.id, estado, motivoDecisao, utilizador?.id);
      setParceiros(lista => lista.map(item => item.id === parceiro.id ? {
        ...item,
        estado,
        disponibilidade: false,
        motivo_rejeicao: estado === 'rejeitado' ? motivoDecisao : null,
        motivo_suspensao: estado === 'suspenso' ? motivoDecisao : null,
      } : item));
      setDecisao(null);
      setMotivo('');
      toast({ title: estado === 'aprovado' ? 'Parceiro aprovado' : estado === 'suspenso' ? 'Parceiro suspenso' : estado === 'rejeitado' ? 'Pedido rejeitado' : 'Análise reaberta', description: estado === 'aprovado' ? 'O parceiro poderá ativar a disponibilidade após iniciar sessão.' : 'A decisão foi guardada e ficará visível para o parceiro.' });
    } catch (erro: any) {
      toast({ title: 'Não foi possível atualizar', description: erro.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setAGuardar(false);
    }
  };

  const abrirDocumento = async (path?: string) => {
    if (!path) return;
    try {
      window.open(await obterUrlDocumentoParceiro(path), '_blank', 'noopener,noreferrer');
    } catch {
      toast({ title: 'Documento indisponível', description: 'Não foi possível abrir este documento.', variant: 'destructive' });
    }
  };

  const analisarDocumento = async (parceiroId: string, documento: any, estado: 'aprovado' | 'rejeitado') => {
    if (estado === 'rejeitado') {
      setDocumentoParaRejeitar({ parceiroId, documento });
      setMotivoDocumento('');
      return;
    }
    await guardarAnaliseDocumento(parceiroId, documento, estado);
  };

  const guardarAnaliseDocumento = async (parceiroId: string, documento: any, estado: 'aprovado' | 'rejeitado', motivo?: string) => {
    try {
      setAGuardar(true);
      const atualizado = await atualizarEstadoDocumentoParceiro(documento.id, estado, utilizador?.id, motivo);
      setParceiros(lista => lista.map(parceiro => parceiro.id !== parceiroId ? parceiro : {
        ...parceiro,
        estado: estado === 'rejeitado' ? 'documentos_pendentes' : parceiro.estado,
        disponibilidade: estado === 'rejeitado' ? false : parceiro.disponibilidade,
        documentos_parceiro_entrega: parceiro.documentos_parceiro_entrega.map((item: any) => item.id === documento.id ? atualizado : item),
      }));
      setDocumentoParaRejeitar(null);
      setMotivoDocumento('');
      toast({ title: estado === 'aprovado' ? 'Documento aprovado' : 'Documento rejeitado' });
    } catch (erro: any) {
      toast({ title: 'Não foi possível analisar o documento', description: erro.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setAGuardar(false);
    }
  };

  return <div className="space-y-6">
    <header className="painel-dashboard-cabecalho">
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="font-titulo text-2xl font-bold text-primary-foreground">{apenasPedidos ? 'Pedidos de Parceiros de Entrega' : 'Entregadores Registados'}</h1><p className="mt-1 font-corpo text-sm text-primary-foreground/80">{apenasPedidos ? 'Analise, aprove ou rejeite os novos pedidos de parceria.' : 'Consulte e faça a gestão de todos os entregadores, respetivos veículos, documentos e zonas de cobertura.'}</p></div>
        <span className="rounded-full bg-primary-foreground/15 px-3 py-1 font-corpo text-xs font-semibold text-primary-foreground">{contadores.pendentes} em análise</span>
      </div>
    </header>

    {apenasPedidos && <>
      <nav className="grid gap-3 sm:grid-cols-2" aria-label="Tipo de pedido de cadastro">
        <Link to="/dashboard/pedidos-vendedores" className="rounded-xl border-2 border-border p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"><p className="font-titulo text-base font-bold">Pedidos de vendedores</p><p className="mt-1 font-corpo text-sm text-muted-foreground">Analise pedidos de cadastro de negócios e vendedores.</p></Link>
        <Link to="/dashboard/pedidos-entregadores" className="rounded-xl border-2 border-primary bg-primary/5 p-4"><p className="font-titulo text-base font-bold text-primary">Pedidos de entregadores</p><p className="mt-1 font-corpo text-sm text-muted-foreground">{contadores.pendentes} pedido{contadores.pendentes === 1 ? '' : 's'} pendente{contadores.pendentes === 1 ? '' : 's'} de análise.</p></Link>
      </nav>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['em_analise', contadores.pendentes, 'Pendentes'],
          ['aprovado', contadores.aprovados, 'Aprovados'],
          ['rejeitado', contadores.rejeitados, 'Rejeitados'],
          ['suspenso', contadores.suspensos, 'Suspensos'],
        ].map(([estado, total, nome]) => <button key={estado} onClick={() => setFiltro(estado as EstadoParceiroAdmin)} className={`rounded-xl border-2 p-3 text-center transition-colors ${filtro === estado ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}><p className="font-titulo text-xl font-bold">{total}</p><p className="font-corpo text-xs text-muted-foreground">{nome}</p></button>)}
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFiltro('todos')} className={`rounded-md border-2 px-3 py-1.5 font-corpo text-xs ${filtro === 'todos' ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-muted-foreground'}`}>Todos ({parceiros.length})</button>
        {[
          ['em_analise', contadores.pendentes, 'Pendente'],
          ['aprovado', contadores.aprovados, 'Aprovado'],
          ['rejeitado', contadores.rejeitados, 'Rejeitado'],
          ['suspenso', contadores.suspensos, 'Suspenso'],
        ].map(([estado, total, nome]) => <button key={estado} onClick={() => setFiltro(estado as EstadoParceiroAdmin)} className={`rounded-md border-2 px-3 py-1.5 font-corpo text-xs ${filtro === estado ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-muted-foreground'}`}>{nome} ({total})</button>)}
      </div>
    </>}

    {!apenasPedidos && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[
        ['em_analise', contadores.pendentes, 'Em análise'], ['aprovado', contadores.aprovados, 'Aprovados'], ['suspenso', contadores.suspensos, 'Suspensos'], ['rejeitado', contadores.rejeitados, 'Rejeitados'],
      ].map(([estado, total, nome]) => <button key={estado} onClick={() => setFiltro(estado as EstadoParceiroAdmin)} className={`rounded-xl border-2 p-4 text-left transition-colors ${filtro === estado ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}><p className="font-titulo text-2xl font-bold">{total}</p><p className="font-corpo text-xs text-muted-foreground">{nome}</p></button>)}
    </div>}

    {!apenasPedidos && <div className="flex flex-wrap gap-2"><button onClick={() => setFiltro('todos')} className={`rounded-full border px-3 py-1.5 font-corpo text-xs ${filtro === 'todos' ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/40'}`}>Todos ({parceiros.length})</button><button onClick={() => setFiltro('em_analise')} className={`rounded-full border px-3 py-1.5 font-corpo text-xs ${filtro === 'em_analise' ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/40'}`}>Em análise</button></div>}

    {aCarregar ? <p className="py-10 text-center font-corpo text-sm text-muted-foreground">A carregar parceiros de entregas…</p> : <div className="space-y-3">
      {visiveis.length === 0 && <p className="rounded-xl border border-dashed border-border py-10 text-center font-corpo text-sm text-muted-foreground">Não existem parceiros neste estado.</p>}
      {visiveis.map(parceiro => <article key={parceiro.id} className="painel-dashboard-item overflow-hidden p-0">
        <div className="p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 gap-3"><Avatar parceiro={parceiro}/><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-titulo text-base font-bold">{parceiro.nome_completo}</h2><span className={`rounded-full border px-2 py-0.5 font-corpo text-[11px] font-semibold ${estiloEstado[parceiro.estado]}`}>{rotuloEstado[parceiro.estado]}</span></div><p className="mt-1 flex items-center gap-1 font-corpo text-xs text-muted-foreground"><Truck className="size-3.5"/>{parceiro.veiculos_entrega?.map((v: any) => `${v.tipo_veiculo} · ${v.marca} ${v.modelo}`).join(' | ') || 'Veículo por confirmar'}</p><p className="mt-1 flex items-center gap-1 font-corpo text-xs text-muted-foreground"><MapPin className="size-3.5"/>{parceiro.municipio}, {parceiro.provincia}</p><p className="mt-1 font-corpo text-xs text-muted-foreground">{(parceiro.documentos_parceiro_entrega?.length ?? 0)} documento{(parceiro.documentos_parceiro_entrega?.length ?? 0) === 1 ? '' : 's'} enviado{(parceiro.documentos_parceiro_entrega?.length ?? 0) === 1 ? '' : 's'}</p></div></div><button onClick={() => setDetalhe(detalhe === parceiro.id ? null : parceiro.id)} className="inline-flex items-center gap-1 self-start rounded-lg border border-primary/30 px-3 py-1.5 font-corpo text-xs font-semibold text-primary hover:bg-primary/5"><Eye className="size-3.5"/>{detalhe === parceiro.id ? 'Ocultar detalhes' : 'Ver dados completos'}</button></div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">{estadoPendente(parceiro.estado) && <><Acao aprovar onClick={() => atualizar(parceiro, 'aprovado')} icon={<BadgeCheck className="size-4"/>}>Aprovar</Acao><Acao variante="danger" onClick={() => { setDecisao({ parceiro, estado: 'rejeitado' }); setMotivo(''); }} icon={<XCircle className="size-4"/>}>Rejeitar</Acao></>}{parceiro.estado === 'aprovado' && <Acao variante="warning" onClick={() => { setDecisao({ parceiro, estado: 'suspenso' }); setMotivo(''); }} icon={<ShieldAlert className="size-4"/>}>Suspender</Acao>}{['rejeitado', 'suspenso', 'documentacao_expirada'].includes(parceiro.estado) && <Acao onClick={() => atualizar(parceiro, 'em_analise')} icon={<FileText className="size-4"/>}>Reabrir análise</Acao>}</div></div>
        {detalhe === parceiro.id && <Detalhes parceiro={parceiro} abrirDocumento={abrirDocumento} analisarDocumento={analisarDocumento}/>}</article>)}
    </div>}

    {decisao && <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 p-4"><div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-xl"><div className="flex gap-3"><span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${decisao.estado === 'rejeitado' ? 'bg-destructive/10 text-destructive' : 'bg-orange-500/10 text-orange-700'}`}><ShieldAlert className="size-5"/></span><div><h2 className="font-titulo text-lg font-bold">{decisao.estado === 'rejeitado' ? 'Rejeitar pedido' : 'Suspender parceiro'}</h2><p className="mt-1 font-corpo text-sm text-muted-foreground">Indique o motivo para {decisao.parceiro.nome_completo}. A informação será apresentada no painel do parceiro.</p></div></div><label className="mt-5 block"><span className="font-corpo text-sm font-semibold">Motivo *</span><textarea autoFocus value={motivo} onChange={e => setMotivo(e.target.value)} className="mt-2 min-h-28 w-full rounded-lg border-2 border-border bg-background p-3 font-corpo text-sm focus:border-primary focus:outline-none" placeholder="Explique claramente o que deve ser corrigido ou o motivo da suspensão."/></label><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button disabled={aGuardar} onClick={() => setDecisao(null)} className="rounded-lg border border-border px-4 py-2 font-corpo text-sm font-semibold">Cancelar</button><button disabled={aGuardar || !motivo.trim()} onClick={() => atualizar(decisao.parceiro, decisao.estado, motivo)} className="rounded-lg bg-destructive px-4 py-2 font-corpo text-sm font-semibold text-destructive-foreground disabled:opacity-50">{aGuardar ? 'A guardar…' : 'Confirmar decisão'}</button></div></div></div>}

    {documentoParaRejeitar && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/45 p-4"><div className="w-full max-w-lg rounded-2xl border border-destructive/30 bg-card p-5 shadow-xl"><div className="flex gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"><FileText className="size-5"/></span><div><h2 className="font-titulo text-lg font-bold">Rejeitar documento</h2><p className="mt-1 font-corpo text-sm text-muted-foreground">Indique o motivo da rejeição de <strong>{nomesDocumento[documentoParaRejeitar.documento.tipo_documento] || documentoParaRejeitar.documento.tipo_documento}</strong>. O parceiro verá esta informação no seu painel.</p></div></div><label className="mt-5 block"><span className="font-corpo text-sm font-semibold">Motivo da rejeição *</span><textarea autoFocus value={motivoDocumento} onChange={e => setMotivoDocumento(e.target.value)} className="mt-2 min-h-28 w-full rounded-lg border-2 border-border bg-background p-3 font-corpo text-sm focus:border-destructive focus:outline-none" placeholder="Ex.: A fotografia está desfocada ou o documento não está legível."/></label><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button disabled={aGuardar} onClick={() => setDocumentoParaRejeitar(null)} className="rounded-lg border border-border px-4 py-2 font-corpo text-sm font-semibold">Cancelar</button><button disabled={aGuardar || !motivoDocumento.trim()} onClick={() => guardarAnaliseDocumento(documentoParaRejeitar.parceiroId, documentoParaRejeitar.documento, 'rejeitado', motivoDocumento)} className="rounded-lg bg-destructive px-4 py-2 font-corpo text-sm font-semibold text-destructive-foreground disabled:opacity-50">{aGuardar ? 'A guardar…' : 'Rejeitar documento'}</button></div></div></div>}
  </div>;
}

function Avatar({ parceiro }: { parceiro: Parceiro }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    if (!parceiro.foto_perfil_url) { setUrl(null); return; }
    obterUrlDocumentoParceiro(parceiro.foto_perfil_url)
      .then(imagem => { if (ativo) setUrl(imagem); })
      .catch(() => { if (ativo) setUrl(null); });
    return () => { ativo = false; };
  }, [parceiro.foto_perfil_url]);

  return url ? <img src={url} alt={`Foto de ${parceiro.nome_completo}`} className="size-12 rounded-full border-2 border-primary/20 object-cover"/> : <span className="flex size-12 items-center justify-center rounded-full bg-primary font-titulo text-base font-bold text-primary-foreground">{parceiro.nome_completo?.trim().charAt(0).toUpperCase() || '?'}</span>;
}

function ImagemPrivada({ caminho, alt, className }: { caminho?: string | null; alt: string; className: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    if (!caminho) { setUrl(null); return; }
    obterUrlDocumentoParceiro(caminho)
      .then(imagem => { if (ativo) setUrl(imagem); })
      .catch(() => { if (ativo) setUrl(null); });
    return () => { ativo = false; };
  }, [caminho]);

  if (!url) return <div className={`${className} animate-pulse bg-muted`} aria-label={`A carregar ${alt}`}/>;
  return <img src={url} alt={alt} className={className}/>;
}

function Acao({ children, onClick, icon, aprovar, variante }: { children: React.ReactNode; onClick: () => void; icon: React.ReactNode; aprovar?: boolean; variante?: 'danger' | 'warning' }) { const cor = aprovar ? 'border-primary text-primary hover:bg-primary hover:text-primary-foreground' : variante === 'danger' ? 'border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground' : variante === 'warning' ? 'border-orange-500 text-orange-700 hover:bg-orange-500 hover:text-white' : 'border-primary/50 text-primary hover:bg-primary/5'; return <button onClick={onClick} className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 font-corpo text-xs font-semibold transition-colors ${cor}`}>{icon}{children}</button>; }

function Detalhes({ parceiro, abrirDocumento, analisarDocumento }: { parceiro: Parceiro; abrirDocumento: (path?: string) => void; analisarDocumento: (parceiroId: string, documento: any, estado: 'aprovado' | 'rejeitado') => void }) {
  const veiculos = parceiro.veiculos_entrega || [];
  const documentos = parceiro.documentos_parceiro_entrega || [];
  const zonas = parceiro.areas_cobertura_entrega || [];
  return <div className="border-t border-border bg-muted/25 p-4 sm:p-5">
    <div className="grid gap-5 lg:grid-cols-2">
      <section><h3 className="mb-3 font-titulo text-sm font-bold">Dados de contacto</h3><dl className="grid grid-cols-2 gap-x-4 gap-y-3"><Info rotulo="Telefone" valor={parceiro.telefone}/><Info rotulo="E-mail" valor={parceiro.email || 'Não indicado'}/><Info rotulo="Contacto de emergência" valor={parceiro.contacto_emergencia}/><Info rotulo="Registo" valor={parceiro.criado_em ? new Date(parceiro.criado_em).toLocaleString('pt-PT') : ''}/><Info rotulo="Zona base" valor={[parceiro.bairro, parceiro.municipio, parceiro.provincia].filter(Boolean).join(', ')}/></dl></section>
      <section><h3 className="mb-3 font-titulo text-sm font-bold">Veículo e capacidade</h3>{veiculos.length ? veiculos.map((v: any) => <div key={v.id} className="rounded-xl border border-border bg-card p-3"><div className="flex gap-3">{v.foto_veiculo_path && <ImagemPrivada caminho={v.foto_veiculo_path} alt="Fotografia do veículo" className="size-20 shrink-0 rounded-lg border border-border object-cover"/>}<div><p className="font-corpo text-sm font-semibold capitalize">{v.tipo_veiculo} · {v.marca} {v.modelo}</p><p className="mt-1 font-corpo text-xs text-muted-foreground">Matrícula: {v.matricula} · {v.cor} · {v.capacidade_kg} kg{v.capacidade_volume_m3 ? ` · ${v.capacidade_volume_m3} m³` : ''}</p><p className="mt-1 font-corpo text-xs text-muted-foreground">Caixa: {v.possui_caixa_carga ? 'Sim' : 'Não'} · Paletes: {v.aceita_paletes ? 'Sim' : 'Não'} · Refrigerado: {v.possui_refrigeracao ? 'Sim' : 'Não'}</p>{v.foto_veiculo_path && <button onClick={() => abrirDocumento(v.foto_veiculo_path)} className="mt-3 rounded-md border border-primary/30 px-2 py-1 font-corpo text-xs text-primary hover:bg-primary/5">Ampliar fotografia</button>}</div></div></div>) : <p className="font-corpo text-sm text-muted-foreground">Nenhum veículo foi enviado.</p>}</section>
    </div>
    <section className="mt-5"><h3 className="mb-1 font-titulo text-sm font-bold">Documentos enviados</h3><p className="mb-3 font-corpo text-xs text-muted-foreground">Confirme a frente e o verso antes de aprovar ou rejeitar cada documento.</p>{documentos.length > 0 ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{documentos.map((d: any) => <div key={d.id} className="rounded-xl border border-border bg-card p-3"><p className="font-corpo text-xs font-semibold">{nomesDocumento[d.tipo_documento] || d.tipo_documento}</p><p className="mt-1 font-corpo text-[11px] text-muted-foreground capitalize">Estado: {d.estado}</p><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => abrirDocumento(d.frente_path)} className="text-left"><ImagemPrivada caminho={d.frente_path} alt={`Frente de ${nomesDocumento[d.tipo_documento] || d.tipo_documento}`} className="h-20 w-full rounded-md border border-border object-cover"/><span className="mt-1 block text-center font-corpo text-[11px] text-primary">Frente</span></button><button onClick={() => abrirDocumento(d.verso_path)} className="text-left"><ImagemPrivada caminho={d.verso_path} alt={`Verso de ${nomesDocumento[d.tipo_documento] || d.tipo_documento}`} className="h-20 w-full rounded-md border border-border object-cover"/><span className="mt-1 block text-center font-corpo text-[11px] text-primary">Verso</span></button></div><div className="mt-2 flex gap-2">{d.estado !== 'aprovado' && <button onClick={() => analisarDocumento(parceiro.id, d, 'aprovado')} className="rounded-md border border-primary px-2 py-1 font-corpo text-xs text-primary hover:bg-primary hover:text-primary-foreground">Aprovar</button>}<button onClick={() => analisarDocumento(parceiro.id, d, 'rejeitado')} className="rounded-md border border-destructive px-2 py-1 font-corpo text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground">{d.estado === 'aprovado' ? 'Rejeitar após revisão' : 'Rejeitar'}</button></div>{d.motivo_rejeicao && <p className="mt-2 font-corpo text-xs text-destructive">{d.motivo_rejeicao}</p>}</div>)}</div> : <p className="font-corpo text-sm text-muted-foreground">Nenhum documento foi enviado.</p>}</section>
    <section className="mt-5"><h3 className="mb-2 font-titulo text-sm font-bold">Áreas de cobertura</h3><div className="flex flex-wrap gap-2">{zonas.map((z: any) => <span key={z.id} className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 font-corpo text-xs text-primary"><MapPin className="mr-1 inline size-3"/>{[z.bairro, z.municipio, z.provincia].filter(Boolean).join(', ')}</span>)}</div></section>
    {parceiro.motivo_rejeicao && <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 font-corpo text-sm text-destructive"><strong>Motivo da rejeição:</strong> {parceiro.motivo_rejeicao}</p>}
    {parceiro.motivo_suspensao && <p className="mt-4 rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 font-corpo text-sm text-orange-700"><strong>Motivo da suspensão:</strong> {parceiro.motivo_suspensao}</p>}
  </div>;
}

function Info({ rotulo, valor }: { rotulo: string; valor?: string }) { return <div><dt className="font-corpo text-[11px] font-medium text-muted-foreground">{rotulo}</dt><dd className="font-corpo text-xs break-words">{valor || '—'}</dd></div>; }
