import { CircleAlert, MapPin, Package, Phone, Store, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { classeEstadoEncomenda, formatarCentimosAoa, formatarDataEncomenda, formatarQuantidadeEncomenda, obterMotivoEncerramentoEncomenda, rotuloEstadoDisputaEncomenda, rotuloEstadoEncomenda, rotuloEventoEncomenda, rotuloTipoProblemaEncomenda, type ContextoDetalheEncomenda } from '@/dominio/encomendas';
import type { DetalheEncomenda, DisputaEncomenda, EntregaParticipante } from '@/services/encomendas';

export function EncomendaDetalheConteudo({ encomenda, contexto, disputa }: { encomenda: DetalheEncomenda; contexto: ContextoDetalheEncomenda; disputa?: DisputaEncomenda | null }) {
  const motivo = obterMotivoEncerramentoEncomenda(contexto, encomenda);
  const entrega = encomenda.modalidade_recebimento === 'entrega';
  const destino = encomenda.enderecos_entrega_encomenda;

  return <div className="space-y-5">
    <header className="painel-dashboard-cabecalho"><div className="relative z-10 flex flex-wrap items-center gap-3"><div><p className="font-corpo text-sm text-primary-foreground/80">Encomenda</p><h1 className="font-titulo text-2xl font-bold text-primary-foreground">{encomenda.codigo_publico}</h1></div><Badge variant="outline" className={classeEstadoEncomenda(encomenda.estado)}>{rotuloEstadoEncomenda(encomenda.estado)}</Badge></div><p className="relative z-10 mt-2 font-corpo text-sm text-primary-foreground/80">Criada em {formatarDataEncomenda(encomenda.criado_em)}</p></header>
    {motivo && <section className="rounded-2xl border-2 border-red-200 bg-red-50 p-5"><h2 className="flex items-center gap-2 font-titulo text-lg font-bold text-red-900"><CircleAlert className="size-5" />{motivo.titulo}</h2><p className="mt-2 text-sm font-medium text-red-900">{motivo.descricao}</p><p className="mt-1 rounded-lg border border-red-100 bg-white/70 p-3 text-sm text-red-900">{motivo.motivo}</p></section>}
    {disputa && <section className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5"><h2 className="flex items-center gap-2 font-titulo text-lg font-bold text-amber-950"><CircleAlert className="size-5" />{contexto === 'vendedor' ? 'Cliente reportou um problema' : 'Problema reportado'}</h2><div className="mt-3 flex gap-5 text-sm text-amber-950"><p><span className="font-semibold">Estado:</span> {rotuloEstadoDisputaEncomenda(disputa.estado)}</p><p><span className="font-semibold">Tipo:</span> {rotuloTipoProblemaEncomenda(disputa.tipo_problema)}</p></div><p className="mt-3 rounded-lg border border-amber-100 bg-white/70 p-3 text-sm text-amber-950">{disputa.descricao}</p></section>}
    <section className="painel-dashboard-form space-y-3"><h2 className="flex items-center gap-2 font-titulo text-lg font-bold"><Package className="size-5 text-green-700" />Itens da encomenda</h2>{encomenda.itens_encomenda.map(item => <div key={item.id} className="flex gap-3 border-t border-border pt-3 first:border-0 first:pt-0"><div className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted">{item.imagem_principal_snapshot && <img src={item.imagem_principal_snapshot} alt="" className="size-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="font-semibold">{item.nome_produto_snapshot}</p><p className="text-sm text-muted-foreground">{formatarQuantidadeEncomenda(item.quantidade, item.unidade)} · {item.tipo_preco_snapshot === 'grosso' ? 'Preço de grosso' : item.tipo_preco_snapshot === 'promocional' ? 'Preço promocional' : 'Preço normal'}</p><p className="text-sm text-muted-foreground">{formatarCentimosAoa(item.valor_unitario_centimos)} por {item.unidade}</p></div><strong className="text-sm">{formatarCentimosAoa(item.subtotal_centimos)}</strong></div>)}</section>
    <section className="grid gap-5 lg:grid-cols-2"><div className="painel-dashboard-form space-y-2"><h2 className="font-titulo text-lg font-bold">Valores</h2><Linha rotulo={entrega ? 'Total dos produtos' : 'Subtotal'} valor={formatarCentimosAoa(encomenda.subtotal_centimos)} /><Linha rotulo="Desconto" valor={formatarCentimosAoa(encomenda.desconto_centimos)} />{entrega ? <Linha rotulo="Custo da entrega" valor="Gratuito durante o piloto" /> : <Linha rotulo="Entrega" valor={formatarCentimosAoa(encomenda.entrega_centimos)} />}<Linha rotulo={entrega ? 'Total atual dos produtos' : 'Total'} valor={formatarCentimosAoa(encomenda.total_centimos)} forte /></div><div className="painel-dashboard-form space-y-2"><h2 className="flex items-center gap-2 font-titulo text-lg font-bold"><MapPin className="size-5 text-green-700" />{entrega ? 'Destino de entrega' : 'Levantamento'}</h2>{entrega ? <><p className="text-sm font-semibold">{destino?.destinatario_nome || encomenda.destinatario_nome}</p><p className="text-sm text-muted-foreground">{[destino?.provincia, destino?.municipio, destino?.bairro].filter(Boolean).join(', ') || 'Destino por confirmar'}</p><p className="text-sm">{destino?.endereco_detalhado || 'Endereço não indicado'}</p>{destino?.ponto_referencia && <p className="text-sm text-muted-foreground">Referência: {destino.ponto_referencia}</p>}{destino?.instrucoes_entrega && <p className="text-sm text-muted-foreground">Instruções: {destino.instrucoes_entrega}</p>}</> : <><p className="text-sm text-muted-foreground">{[encomenda.provincia, encomenda.municipio, encomenda.bairro].filter(Boolean).join(', ') || 'Localização por confirmar'}</p><p className="text-sm">{encomenda.endereco_levantamento || 'Endereço não indicado'}</p></>}</div></section>
    <section className="grid gap-5 lg:grid-cols-2"><div className="painel-dashboard-form"><h2 className="flex items-center gap-2 font-titulo text-lg font-bold"><Store className="size-5 text-green-700" />{entrega ? 'Contacto de entrega' : 'Contacto'}</h2><p className="mt-2 text-sm">{destino?.destinatario_nome || encomenda.destinatario_nome}</p><p className="flex items-center gap-1 text-sm text-muted-foreground"><Phone className="size-3" />{destino?.destinatario_telefone || encomenda.destinatario_telefone}</p></div>{entrega ? <EntregaResumo entrega={encomenda.entrega_participante} contexto={contexto} /> : encomenda.observacoes_cliente && <div className="painel-dashboard-form"><h2 className="font-titulo text-lg font-bold">Observações</h2><p className="mt-2 text-sm text-muted-foreground">{encomenda.observacoes_cliente}</p></div>}</section>
    <section className="painel-dashboard-form"><h2 className="font-titulo text-lg font-bold">Histórico</h2><ol className="mt-4 space-y-3 border-l-2 border-green-200 pl-4">{[...encomenda.eventos_encomenda].sort((a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime()).map(evento => <li key={evento.id}><p className="font-semibold text-sm">{rotuloEventoEncomenda(evento.tipo_evento)}</p><p className="text-xs text-muted-foreground">{formatarDataEncomenda(evento.criado_em)}</p></li>)}</ol></section>
  </div>;
}

function EntregaResumo({ entrega, contexto }: { entrega: EntregaParticipante | null; contexto: ContextoDetalheEncomenda }) {
  const estado = entrega?.estado ?? 'nao_atribuido';
  if (contexto === 'cliente') return <ProgressoEntregaComprador entrega={entrega} estado={estado} />;
  const mensagem = estado === 'recolhida'
    ? 'Em transporte. A encomenda está agora com o entregador.'
    : estado === 'chegou_destino'
      ? 'O entregador chegou ao destino da encomenda.'
    : estado === 'chegou_origem'
      ? 'Entregador chegou para recolher a encomenda.'
      : estado === 'cancelada'
        ? 'A entrega foi cancelada.'
        : estado === 'concluida'
          ? 'Encomenda concluída.'
      : estado === 'aceite'
        ? 'Entregador confirmado.'
        : estado === 'recusada'
          ? 'Entregador recusou a tarefa; a procurar outro entregador.'
          : estado === 'atribuida'
            ? 'Entregador atribuído — a aguardar aceite.'
            : 'A aguardar atribuição de entregador.';
  const veiculo = entrega?.veiculo;
  return <div className="painel-dashboard-form">
    <h2 className="flex items-center gap-2 font-titulo text-lg font-bold"><Truck className="size-5 text-green-700" />Entrega</h2>
    <p className="mt-2 text-sm text-muted-foreground">{mensagem}</p>
    {estado === 'aceite' && <div className="mt-3 space-y-1 rounded-xl border border-green-100 bg-green-50/60 p-3 text-sm">
      <p className="font-semibold text-green-950">{entrega?.nome_entregador}</p>
      <p className="text-muted-foreground">{[veiculo?.tipo_veiculo, veiculo?.marca, veiculo?.modelo].filter(Boolean).join(' · ')}</p>
      <p className="text-muted-foreground">Matrícula: {veiculo?.matricula || 'Por confirmar'}</p>
      {entrega?.aceite_em && <p className="text-xs text-muted-foreground">Aceite em {formatarDataEncomenda(entrega.aceite_em)}</p>}
    </div>}
    {estado === 'recusada' && entrega?.motivo_recusa && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Motivo da recusa: {entrega.motivo_recusa}</p>}
  </div>;
}

function ProgressoEntregaComprador({ entrega, estado }: { entrega: EntregaParticipante | null; estado: EntregaParticipante['estado'] }) {
  const veiculo = entrega?.veiculo;
  const progresso = obterProgressoEntregaComprador(estado, entrega);
  const identidadeDisponivel = ['aceite', 'chegou_origem', 'recolhida', 'chegou_destino', 'concluida'].includes(estado);
  const descricaoVeiculo = [veiculo?.tipo_veiculo, veiculo?.marca, veiculo?.modelo].filter(Boolean).join(' · ');

  return <div className="painel-dashboard-form">
    <h2 className="flex items-center gap-2 font-titulo text-lg font-bold"><Truck className="size-5 text-green-700" />Acompanhamento da entrega</h2>
    <p className="mt-2 font-semibold text-green-950">{progresso.titulo}</p>
    <p className="mt-1 text-sm text-muted-foreground">{progresso.descricao}</p>
    {progresso.data && <p className="mt-2 text-xs text-muted-foreground">{progresso.rotuloData} {formatarDataEncomenda(progresso.data)}</p>}
    {identidadeDisponivel && <div className="mt-3 space-y-1 rounded-xl border border-green-100 bg-green-50/60 p-3 text-sm">
      {entrega?.nome_entregador && <p className="font-semibold text-green-950">{entrega.nome_entregador}</p>}
      {descricaoVeiculo && <p className="text-muted-foreground">{descricaoVeiculo}</p>}
      {veiculo?.matricula && <p className="text-muted-foreground">Matrícula: {veiculo.matricula}</p>}
    </div>}
  </div>;
}

function obterProgressoEntregaComprador(
  estado: EntregaParticipante['estado'],
  entrega: EntregaParticipante | null,
) {
  switch (estado) {
    case 'atribuida':
      return { titulo: 'Entregador atribuído', descricao: 'A aguardar confirmação do entregador.', rotuloData: 'Atribuído em', data: entrega?.atribuido_em };
    case 'aceite':
      return { titulo: 'Entregador confirmado', descricao: 'O entregador confirmou que irá recolher a encomenda.', rotuloData: 'Confirmado em', data: entrega?.aceite_em };
    case 'chegou_origem':
      return { titulo: 'Entregador chegou para recolher a encomenda', descricao: 'O entregador encontra-se no vendedor e aguarda a entrega da encomenda.', rotuloData: 'Chegou em', data: entrega?.chegou_origem_em };
    case 'recolhida':
      return { titulo: 'Encomenda em transporte', descricao: 'A tua encomenda está agora com o entregador.', rotuloData: 'Recolhida em', data: entrega?.recolhida_em };
    case 'chegou_destino':
      return { titulo: 'Entregador chegou ao destino', descricao: 'O entregador chegou. Prepare-se para receber a encomenda e partilhar o código de entrega.', rotuloData: 'Chegou em', data: entrega?.chegou_destino_em };
    case 'recusada':
      return { titulo: 'A procurar outro entregador', descricao: 'Estamos a reorganizar a entrega para encontrar outro entregador quando aplicável.', rotuloData: 'Atualizado em', data: entrega?.recusado_em };
    case 'cancelada':
      return { titulo: 'Estamos a reorganizar a entrega', descricao: 'Estamos a preparar uma nova disponibilidade de entrega quando aplicável.', rotuloData: 'Atualizado em', data: undefined };
    case 'concluida':
      return { titulo: 'Encomenda concluída', descricao: 'A encomenda encontra-se concluída.', rotuloData: 'Concluída em', data: undefined };
    default:
      return { titulo: 'A aguardar entregador', descricao: 'A entrega ainda não possui um entregador atribuído.', rotuloData: 'Atribuído em', data: undefined };
  }
}

function Linha({ rotulo, valor, forte = false }: { rotulo: string; valor: string; forte?: boolean }) { return <div className={`flex justify-between text-sm ${forte ? 'border-t border-border pt-2 font-bold text-green-800' : 'text-muted-foreground'}`}><span>{rotulo}</span><span>{valor}</span></div>; }
