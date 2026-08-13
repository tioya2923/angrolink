import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { classeEstadoEncomenda, formatarCentimosAoa, formatarDataEncomenda, rotuloEstadoEncomenda } from '@/dominio/encomendas';
import type { EncomendaResumo } from '@/services/encomendas';

export function EncomendaCard({ encomenda, vendedor }: { encomenda: EncomendaResumo; vendedor: boolean }) {
  const primeiroItem = encomenda.itens_encomenda[0];
  return <article className="painel-dashboard-item flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
    <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
      {primeiroItem?.imagem_principal_snapshot ? <img src={primeiroItem.imagem_principal_snapshot} alt="" className="size-full object-cover" /> : <Package className="m-5 size-6 text-muted-foreground" />}
    </div>
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex flex-wrap items-center gap-2"><h2 className="font-titulo font-bold">{encomenda.codigo_publico}</h2><Badge variant="outline" className={classeEstadoEncomenda(encomenda.estado)}>{rotuloEstadoEncomenda(encomenda.estado)}</Badge></div>
      <p className="font-corpo text-sm text-muted-foreground">{vendedor ? encomenda.destinatario_nome : (encomenda.vendedor?.nome_comercial || 'Vendedor ANGROLINK')} · {encomenda.itens_encomenda.length} {encomenda.itens_encomenda.length === 1 ? 'item' : 'itens'}</p>
      <p className="flex items-center gap-1 font-corpo text-xs text-muted-foreground"><CalendarDays className="size-3" />{formatarDataEncomenda(encomenda.criado_em)}</p>
    </div>
    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end"><strong className="font-corpo text-green-800">{formatarCentimosAoa(encomenda.total_centimos)}</strong><Link to={`/dashboard/encomendas/${encomenda.id}`} className="inline-flex items-center gap-1 rounded-lg border border-green-200 px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-50">{vendedor ? 'Gerir encomenda' : 'Ver detalhes'} <ChevronRight className="size-4" /></Link></div>
  </article>;
}
