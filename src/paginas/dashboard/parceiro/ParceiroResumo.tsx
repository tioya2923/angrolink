import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Clock3, FileCheck2, MapPin, ShieldAlert, Truck, CircleHelp, Phone, MessageCircle } from 'lucide-react';
import { useAuth } from '@/contextos/AuthContexto';
import { useToast } from '@/hooks/use-toast';
import { atualizarDisponibilidadeParceiroEntrega, fetchMeuParceiroEntrega, reenviarDocumentoParceiro } from '@/services/api';

type SecaoParceiro = 'resumo' | 'pedidos' | 'veiculo' | 'areas' | 'documentos' | 'apoio';

const TITULOS: Record<SecaoParceiro, [string, string]> = {
  resumo: ['Painel do entregador', 'Acompanhe a sua conta, disponibilidade e preparação para receber pedidos.'],
  pedidos: ['Pedidos de entrega', 'Aqui aparecerão os pedidos compatíveis com a sua zona, veículo e capacidade.'],
  veiculo: ['Veículo e disponibilidade', 'Mantenha o veículo validado e indique quando está pronto para entregar.'],
  areas: ['Áreas de cobertura', 'Consulte as zonas em que poderá receber pedidos de entrega.'],
  documentos: ['Documentos e verificação', 'Acompanhe o estado da documentação enviada para análise.'],
  apoio: ['Apoio ANGROLINK', 'Encontre orientações para trabalhar na plataforma e resolver situações da conta.'],
};

const NOME_DOCUMENTO: Record<string, string> = {
  bi: 'Bilhete de Identidade',
  carta_conducao: 'Carta de condução',
  livrete_veiculo: 'Livrete / título do veículo',
  seguro_automovel: 'Seguro automóvel',
  inspecao_tecnica: 'Inspeção técnica',
  licenca_transporte_mercadorias: 'Licença de transporte de mercadorias',
};

export default function ParceiroResumo({ secao = 'resumo' }: { secao?: SecaoParceiro }) {
  const { utilizador } = useAuth();
  const { toast } = useToast();
  const [parceiro, setParceiro] = useState<any>(null);
  const [aGuardar, setAGuardar] = useState(false);

  useEffect(() => {
    if (!utilizador?.id) return;
    fetchMeuParceiroEntrega(utilizador.id)
      .then(setParceiro)
      .catch(() => toast({ title: 'Não foi possível carregar os seus dados.', variant: 'destructive' }));
  }, [utilizador?.id]);

  const aprovado = parceiro?.estado === 'aprovado';
  const veiculo = parceiro?.veiculos_entrega?.[0];
  const documentos = useMemo(() => parceiro?.documentos_parceiro_entrega || [], [parceiro]);
  const [titulo, descricao] = TITULOS[secao];

  const mudarDisponibilidade = async (disponibilidade: boolean) => {
    if (!parceiro) return;
    try {
      setAGuardar(true);
      await atualizarDisponibilidadeParceiroEntrega(parceiro.id, disponibilidade);
      setParceiro((atual: any) => ({ ...atual, disponibilidade }));
      toast({ title: disponibilidade ? 'Disponibilidade ativada' : 'Disponibilidade desativada' });
    } catch (erro: any) {
      toast({ title: 'Não foi possível atualizar', description: erro.message || 'Tente novamente.', variant: 'destructive' });
    } finally { setAGuardar(false); }
  };

  const reenviarDocumento = async (documento: any, frente: File, verso: File) => {
    try {
      setAGuardar(true);
      await reenviarDocumentoParceiro(documento.id, frente, verso);
      setParceiro((atual: any) => ({
        ...atual,
        estado: 'em_analise',
        documentos_parceiro_entrega: atual.documentos_parceiro_entrega.map((item: any) => item.id === documento.id ? { ...item, estado: 'pendente', motivo_rejeicao: null } : item),
      }));
      toast({ title: 'Documento reenviado', description: 'O documento voltou para análise.' });
    } catch (erro: any) {
      toast({ title: 'Não foi possível reenviar', description: erro.message || 'Tente novamente.', variant: 'destructive' });
    } finally { setAGuardar(false); }
  };

  if (!parceiro) return <p className="py-10 text-center font-corpo text-sm text-muted-foreground">A carregar painel de entregador…</p>;

  return <div className="space-y-6">
    <header className="painel-dashboard-cabecalho"><h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">{titulo}</h1><p className="relative z-10 mt-1 font-corpo text-sm text-primary-foreground/80">{descricao}</p></header>
    {secao === 'resumo' && <Resumo parceiro={parceiro} documentos={documentos} veiculo={veiculo} aprovado={aprovado} mudarDisponibilidade={mudarDisponibilidade} aGuardar={aGuardar}/>} 
    {secao === 'pedidos' && <Pedidos parceiro={parceiro} aprovado={aprovado}/>} 
    {secao === 'veiculo' && <Veiculo parceiro={parceiro} veiculo={veiculo} aprovado={aprovado} mudarDisponibilidade={mudarDisponibilidade} aGuardar={aGuardar}/>} 
    {secao === 'areas' && <Areas parceiro={parceiro}/>} 
    {secao === 'documentos' && <Documentos documentos={documentos} reenviar={reenviarDocumento} aGuardar={aGuardar}/>} 
    {secao === 'apoio' && <Apoio parceiro={parceiro}/>} 
  </div>;
}

function Resumo({ parceiro, documentos, veiculo, aprovado, mudarDisponibilidade, aGuardar }: any) {
  const documentosAprovados = documentos.filter((d: any) => d.estado === 'aprovado').length;
  return <>
    <Estado parceiro={parceiro} aprovado={aprovado}/>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Indicador rotulo="Pedidos ativos" valor="0" descricao="Disponível na próxima fase" icone={<ClipboardList/>}/>
      <Indicador rotulo="Disponibilidade" valor={parceiro.disponibilidade ? 'Ativa' : 'Inativa'} descricao={parceiro.disponibilidade ? 'Pronto para pedidos' : 'Ative quando estiver pronto'} icone={<Clock3/>}/>
      <Indicador rotulo="Documentos" valor={`${documentosAprovados}/${documentos.length}`} descricao="Documentos validados" icone={<FileCheck2/>}/>
      <Indicador rotulo="Zona base" valor={parceiro.areas_cobertura_entrega?.length || 0} descricao="Zona(s) registada(s)" icone={<MapPin/>}/>
    </div>
    <div className="grid gap-5 lg:grid-cols-2"><Disponibilidade parceiro={parceiro} aprovado={aprovado} mudar={mudarDisponibilidade} aGuardar={aGuardar}/><ResumoVeiculo veiculo={veiculo}/></div>
  </>;
}

function Estado({ parceiro, aprovado }: any) { const texto = aprovado ? 'Conta aprovada' : parceiro.estado === 'suspenso' ? 'Conta suspensa' : parceiro.estado === 'rejeitado' ? 'Pedido rejeitado' : 'Pedido em análise'; const detalhe = aprovado ? 'A sua documentação foi validada. Ative a disponibilidade quando estiver pronto para receber pedidos.' : parceiro.estado === 'suspenso' ? parceiro.motivo_suspensao || 'Contacte a equipa ANGROLINK para esclarecimentos.' : parceiro.estado === 'rejeitado' ? parceiro.motivo_rejeicao || 'Contacte a equipa ANGROLINK para saber como corrigir o pedido.' : 'A equipa ANGROLINK está a validar os seus documentos e veículo.'; return <section className={`rounded-2xl border-2 p-5 ${aprovado ? 'border-primary/30 bg-primary/5' : parceiro.estado === 'rejeitado' ? 'border-destructive/30 bg-destructive/5' : parceiro.estado === 'suspenso' ? 'border-orange-500/30 bg-orange-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}><div className="flex gap-3"><span className="mt-0.5 text-primary">{aprovado ? <CheckCircle2/> : parceiro.estado === 'suspenso' || parceiro.estado === 'rejeitado' ? <ShieldAlert/> : <Clock3/>}</span><div><h2 className="font-titulo text-lg font-bold">{texto}</h2><p className="mt-1 font-corpo text-sm text-muted-foreground">{detalhe}</p></div></div></section>; }

function Indicador({ rotulo, valor, descricao, icone }: any) { return <section className="painel-dashboard-item p-4"><span className="mb-3 block text-primary">{icone}</span><p className="font-titulo text-xl font-bold">{valor}</p><p className="font-corpo text-sm font-semibold">{rotulo}</p><p className="mt-1 font-corpo text-xs text-muted-foreground">{descricao}</p></section>; }

function Disponibilidade({ parceiro, aprovado, mudar, aGuardar }: any) { return <section className="painel-dashboard-form"><h2 className="font-titulo text-lg font-bold">Disponibilidade</h2><p className="mt-1 font-corpo text-sm text-muted-foreground">A disponibilidade só pode ser ativada depois da aprovação administrativa.</p><div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/25 p-4"><div><p className="font-corpo text-sm font-semibold">Receber pedidos de entrega</p><p className="font-corpo text-xs text-muted-foreground">{parceiro.disponibilidade ? 'Está disponível para receber pedidos.' : 'Está indisponível neste momento.'}</p></div><button disabled={!aprovado || aGuardar} onClick={() => mudar(!parceiro.disponibilidade)} className={`rounded-full px-4 py-2 font-corpo text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ${parceiro.disponibilidade ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground'}`}>{parceiro.disponibilidade ? 'Disponível' : 'Indisponível'}</button></div></section>; }

function ResumoVeiculo({ veiculo }: any) { return <section className="painel-dashboard-form"><div className="flex items-center gap-2"><Truck className="size-5 text-primary"/><h2 className="font-titulo text-lg font-bold">Veículo principal</h2></div>{veiculo ? <div className="mt-4"><p className="font-corpo text-sm font-semibold capitalize">{veiculo.tipo_veiculo} · {veiculo.marca} {veiculo.modelo}</p><p className="mt-1 font-corpo text-xs text-muted-foreground">Matrícula: {veiculo.matricula} · Capacidade: {veiculo.capacidade_kg} kg</p></div> : <p className="mt-3 font-corpo text-sm text-muted-foreground">Nenhum veículo associado.</p>}</section>; }

function Pedidos({ parceiro, aprovado }: any) { return <section className="painel-dashboard-form text-center"><span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary"><ClipboardList className="size-7"/></span><h2 className="mt-4 font-titulo text-xl font-bold">Ainda não tem pedidos de entrega</h2><p className="mx-auto mt-2 max-w-xl font-corpo text-sm text-muted-foreground">Os pedidos aparecerão aqui quando a fase de encomendas e atribuição automática de entregadores estiver ativa. {aprovado && parceiro.disponibilidade ? 'A sua conta está preparada para os receber.' : 'Mantenha a conta aprovada e a disponibilidade ativa para estar preparado.'}</p></section>; }

function Veiculo({ parceiro, veiculo, aprovado, mudarDisponibilidade, aGuardar }: any) { return <div className="space-y-5"><Disponibilidade parceiro={parceiro} aprovado={aprovado} mudar={mudarDisponibilidade} aGuardar={aGuardar}/><section className="painel-dashboard-form"><ResumoVeiculo veiculo={veiculo}/>{veiculo && <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-3"><Info rotulo="Cor" valor={veiculo.cor}/><Info rotulo="Volume" valor={veiculo.capacidade_volume_m3 ? `${veiculo.capacidade_volume_m3} m³` : 'Não indicado'}/><Info rotulo="Estado de verificação" valor={veiculo.estado_verificacao}/></div>}</section></div>; }

function Areas({ parceiro }: any) { const zonas = parceiro.areas_cobertura_entrega || []; return <section className="painel-dashboard-form"><h2 className="font-titulo text-lg font-bold">Zonas registadas</h2><p className="mt-1 font-corpo text-sm text-muted-foreground">Os pedidos futuros serão filtrados pela zona, capacidade do veículo e disponibilidade.</p>{zonas.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{zonas.map((zona: any) => <div key={zona.id} className="rounded-xl border border-primary/20 bg-primary/5 p-4"><MapPin className="mb-2 size-5 text-primary"/><p className="font-corpo text-sm font-semibold">{[zona.bairro, zona.municipio, zona.provincia].filter(Boolean).join(', ')}</p><p className="mt-1 font-corpo text-xs text-muted-foreground">{zona.ativo ? 'Zona ativa para entregas' : 'Zona temporariamente inativa'}</p></div>)}</div> : <p className="mt-5 rounded-xl border border-dashed border-border p-6 text-center font-corpo text-sm text-muted-foreground">Ainda não foi registada uma zona de cobertura.</p>}</section>; }

function Documentos({ documentos, reenviar, aGuardar }: any) { return <section className="painel-dashboard-form"><h2 className="font-titulo text-lg font-bold">Documentação enviada</h2><p className="mt-1 font-corpo text-sm text-muted-foreground">O administrador valida cada documento antes de aprovar a conta.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{documentos.map((documento: any) => <DocumentoCard key={documento.id} documento={documento} reenviar={reenviar} aGuardar={aGuardar}/>)}</div>{!documentos.length && <p className="mt-5 rounded-xl border border-dashed border-border p-6 text-center font-corpo text-sm text-muted-foreground">Ainda não há documentos associados a esta conta.</p>}</section>; }

function DocumentoCard({ documento, reenviar, aGuardar }: any) { const [frente, setFrente] = useState<File | null>(null); const [verso, setVerso] = useState<File | null>(null); const rejeitado = documento.estado === 'rejeitado'; return <div className="rounded-xl border border-border bg-muted/20 p-4"><FileCheck2 className="mb-2 size-5 text-primary"/><p className="font-corpo text-sm font-semibold">{NOME_DOCUMENTO[documento.tipo_documento] || documento.tipo_documento}</p><p className={`mt-2 inline-flex rounded-full border px-2 py-0.5 font-corpo text-xs ${documento.estado === 'aprovado' ? 'border-primary/30 bg-primary/10 text-primary' : rejeitado ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-amber-500/30 bg-amber-500/10 text-amber-700'}`}>{documento.estado === 'aprovado' ? 'Aprovado' : rejeitado ? 'Rejeitado' : 'Em análise'}</p>{documento.motivo_rejeicao && <p className="mt-2 font-corpo text-xs text-destructive">{documento.motivo_rejeicao}</p>}{rejeitado && <div className="mt-4 border-t border-border pt-3"><p className="font-corpo text-xs font-semibold">Reenviar frente e verso</p><label className="mt-2 block font-corpo text-xs text-muted-foreground">Nova foto da frente<input type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full text-xs" onChange={e => setFrente(e.target.files?.[0] || null)}/></label><label className="mt-2 block font-corpo text-xs text-muted-foreground">Nova foto do verso<input type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full text-xs" onChange={e => setVerso(e.target.files?.[0] || null)}/></label><button disabled={!frente || !verso || aGuardar} onClick={() => frente && verso && reenviar(documento, frente, verso)} className="mt-3 w-full rounded-lg bg-primary px-3 py-2 font-corpo text-xs font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">Reenviar para análise</button></div>}</div>; }

function Info({ rotulo, valor }: { rotulo: string; valor: string }) { return <div><p className="font-corpo text-xs text-muted-foreground">{rotulo}</p><p className="mt-1 font-corpo text-sm font-semibold capitalize">{valor}</p></div>; }

function Apoio({ parceiro }: any) {
  return <div className="grid gap-5 lg:grid-cols-2">
    <section className="painel-dashboard-form"><div className="flex items-center gap-2"><CircleHelp className="size-5 text-primary"/><h2 className="font-titulo text-lg font-bold">Como funciona</h2></div><ol className="mt-4 space-y-3 font-corpo text-sm text-muted-foreground"><li><strong className="text-foreground">1. Fique disponível:</strong> apenas depois da aprovação.</li><li><strong className="text-foreground">2. Receba pedidos:</strong> compatíveis com zona e veículo.</li><li><strong className="text-foreground">3. Recolha a mercadoria:</strong> antes de iniciar o trajeto.</li><li><strong className="text-foreground">4. Conclua a entrega:</strong> com confirmação do destinatário.</li></ol></section>
    <section className="painel-dashboard-form"><h2 className="font-titulo text-lg font-bold">Precisa de ajuda?</h2><p className="mt-2 font-corpo text-sm text-muted-foreground">Contacte a equipa ANGROLINK para corrigir documentos ou esclarecer a situação da conta.</p><div className="mt-5 flex flex-wrap gap-3"><a href="tel:+244000000000" className="inline-flex items-center gap-2 rounded-lg border border-primary/30 px-3 py-2 font-corpo text-sm font-semibold text-primary hover:bg-primary/5"><Phone className="size-4"/>Ligar ao apoio</a><a href="https://wa.me/244000000000" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 font-corpo text-sm font-semibold text-primary-foreground"><MessageCircle className="size-4"/>WhatsApp de apoio</a></div><p className="mt-4 font-corpo text-xs text-muted-foreground">Estado atual: <strong>{String(parceiro.estado).replace('_', ' ')}</strong>.</p></section>
  </div>;
}
