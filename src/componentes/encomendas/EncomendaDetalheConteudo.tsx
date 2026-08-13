import { CircleAlert, MapPin, Package, Phone, Store } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  classeEstadoEncomenda,
  formatarCentimosAoa,
  formatarDataEncomenda,
  formatarQuantidadeEncomenda,
  obterMotivoEncerramentoEncomenda,
  rotuloEstadoEncomenda,
  rotuloEventoEncomenda,
  type ContextoDetalheEncomenda,
} from '@/dominio/encomendas';
import type { DetalheEncomenda } from '@/services/encomendas';

export function EncomendaDetalheConteudo({
  encomenda,
  contexto,
}: {
  encomenda: DetalheEncomenda;
  contexto: ContextoDetalheEncomenda;
}) {
  const motivoEncerramento = obterMotivoEncerramentoEncomenda(contexto, encomenda);

  return <div className="space-y-5">
    <header className="painel-dashboard-cabecalho">
      <div className="relative z-10 flex flex-wrap items-center gap-3">
        <div><p className="font-corpo text-sm text-primary-foreground/80">Encomenda</p><h1 className="font-titulo text-2xl font-bold text-primary-foreground">{encomenda.codigo_publico}</h1></div>
        <Badge variant="outline" className={classeEstadoEncomenda(encomenda.estado)}>{rotuloEstadoEncomenda(encomenda.estado)}</Badge>
      </div>
      <p className="relative z-10 mt-2 font-corpo text-sm text-primary-foreground/80">Criada em {formatarDataEncomenda(encomenda.criado_em)}</p>
    </header>

    {motivoEncerramento && <section className="rounded-2xl border-2 border-red-200 bg-red-50 p-5">
      <h2 className="flex items-center gap-2 font-titulo text-lg font-bold text-red-900"><CircleAlert className="size-5" />{motivoEncerramento.titulo}</h2>
      <p className="mt-2 text-sm font-medium text-red-900">{motivoEncerramento.descricao}</p>
      <p className="mt-1 rounded-lg border border-red-100 bg-white/70 p-3 text-sm text-red-900">{motivoEncerramento.motivo}</p>
      {motivoEncerramento.data && <p className="mt-3 text-xs text-red-800">Registado em {formatarDataEncomenda(motivoEncerramento.data)}</p>}
    </section>}

    <section className="painel-dashboard-form space-y-3">
      <h2 className="flex items-center gap-2 font-titulo text-lg font-bold"><Package className="size-5 text-green-700" />Itens da encomenda</h2>
      {encomenda.itens_encomenda.map(item => <div key={item.id} className="flex gap-3 border-t border-border pt-3 first:border-0 first:pt-0">
        <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted">{item.imagem_principal_snapshot && <img src={item.imagem_principal_snapshot} alt="" className="size-full object-cover" />}</div>
        <div className="min-w-0 flex-1"><p className="font-semibold">{item.nome_produto_snapshot}</p><p className="text-sm text-muted-foreground">{formatarQuantidadeEncomenda(item.quantidade, item.unidade)} · {item.tipo_preco_snapshot === 'grosso' ? 'Preço de grosso' : item.tipo_preco_snapshot === 'promocional' ? 'Preço promocional' : 'Preço normal'}</p><p className="text-sm text-muted-foreground">{formatarCentimosAoa(item.valor_unitario_centimos)} por {item.unidade}</p></div>
        <strong className="text-sm">{formatarCentimosAoa(item.subtotal_centimos)}</strong>
      </div>)}
    </section>

    <section className="grid gap-5 lg:grid-cols-2">
      <div className="painel-dashboard-form space-y-2"><h2 className="font-titulo text-lg font-bold">Valores</h2><Linha rotulo="Subtotal" valor={formatarCentimosAoa(encomenda.subtotal_centimos)} /><Linha rotulo="Desconto" valor={formatarCentimosAoa(encomenda.desconto_centimos)} /><Linha rotulo="Entrega" valor={formatarCentimosAoa(encomenda.entrega_centimos)} /><Linha rotulo="Total" valor={formatarCentimosAoa(encomenda.total_centimos)} forte /></div>
      <div className="painel-dashboard-form space-y-2"><h2 className="flex items-center gap-2 font-titulo text-lg font-bold"><MapPin className="size-5 text-green-700" />Levantamento</h2><p className="text-sm text-muted-foreground">{[encomenda.provincia, encomenda.municipio, encomenda.bairro].filter(Boolean).join(', ') || 'Localização por confirmar'}</p><p className="text-sm">{encomenda.endereco_levantamento || 'Endereço não indicado'}</p>{encomenda.ponto_referencia && <p className="text-sm text-muted-foreground">Referência: {encomenda.ponto_referencia}</p>}</div>
    </section>

    <section className="grid gap-5 lg:grid-cols-2"><div className="painel-dashboard-form"><h2 className="flex items-center gap-2 font-titulo text-lg font-bold"><Store className="size-5 text-green-700" />Contacto</h2><p className="mt-2 text-sm">{encomenda.destinatario_nome}</p><p className="flex items-center gap-1 text-sm text-muted-foreground"><Phone className="size-3" />{encomenda.destinatario_telefone}</p></div>{encomenda.observacoes_cliente && <div className="painel-dashboard-form"><h2 className="font-titulo text-lg font-bold">Observações</h2><p className="mt-2 text-sm text-muted-foreground">{encomenda.observacoes_cliente}</p></div>}</section>

    <section className="painel-dashboard-form"><h2 className="font-titulo text-lg font-bold">Histórico</h2><ol className="mt-4 space-y-3 border-l-2 border-green-200 pl-4">{[...encomenda.eventos_encomenda].sort((a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime()).map(evento => <li key={evento.id}><p className="font-semibold text-sm">{rotuloEventoEncomenda(evento.tipo_evento)}</p><p className="text-xs text-muted-foreground">{formatarDataEncomenda(evento.criado_em)}</p></li>)}</ol></section>
  </div>;
}

function Linha({ rotulo, valor, forte = false }: { rotulo: string; valor: string; forte?: boolean }) {
  return <div className={`flex justify-between text-sm ${forte ? 'border-t border-border pt-2 font-bold text-green-800' : 'text-muted-foreground'}`}><span>{rotulo}</span><span>{valor}</span></div>;
}
