import { Landmark } from 'lucide-react';
import { formatarCentimosAoa } from '@/dominio/encomendas';
import { rotuloEstadoPagamento, rotuloEstadoRepasse } from '@/dominio/pagamentos';
import type { ResumoFinanceiroEncomendaVendedor } from '@/services/pagamentos';

export function ResumoFinanceiroVendedorEncomenda({ resumo, carregando, erro }: {
  resumo: ResumoFinanceiroEncomendaVendedor | null;
  carregando: boolean;
  erro: boolean;
}) {
  return <section className="painel-dashboard-form">
    <h2 className="flex items-center gap-2 font-titulo text-lg font-bold"><Landmark className="size-5 text-green-700" />Resumo financeiro</h2>
    {carregando ? <p className="mt-3 text-sm text-muted-foreground">A carregar resumo financeiro…</p>
      : erro ? <p className="mt-3 text-sm text-red-700">Não foi possível carregar os dados financeiros.</p>
        : !resumo ? <p className="mt-3 text-sm text-muted-foreground">Ainda não existe uma obrigação financeira para esta encomenda.</p>
          : <div className="mt-4 space-y-2 text-sm">
            <Linha rotulo="Produtos" valor={formatarCentimosAoa(resumo.subtotal_centimos)} />
            <Linha rotulo="Descontos" valor={formatarCentimosAoa(resumo.desconto_centimos)} />
            <Linha rotulo="Base comercial" valor={formatarCentimosAoa(resumo.base_comercial_centimos)} />
            <Linha rotulo="Comissão ANGROLINK" valor={formatarCentimosAoa(resumo.comissao_angrolink_centimos)} />
            {resumo.entrega_centimos > 0 && <Linha rotulo="Entrega" valor={formatarCentimosAoa(resumo.entrega_centimos)} />}
            <Linha rotulo="Valor líquido estimado" valor={formatarCentimosAoa(resumo.valor_vendedor_centimos)} forte />
            <Linha rotulo="Pagamento" valor={rotuloEstadoPagamento(resumo.estado_pagamento)} />
            {resumo.estado_repasse && <Linha rotulo="Repasse" valor={rotuloEstadoRepasse(resumo.estado_repasse)} />}
            {(resumo.base_comercial_centimos !== resumo.subtotal_centimos - resumo.desconto_centimos) && <p className="pt-2 text-xs text-muted-foreground">Valores atualizados após ajustes ou reembolsos.</p>}
          </div>}
  </section>;
}

function Linha({ rotulo, valor, forte = false }: { rotulo: string; valor: string; forte?: boolean }) {
  return <div className={`flex items-baseline justify-between gap-4 ${forte ? 'border-t border-border pt-2 font-bold text-green-800' : 'text-muted-foreground'}`}><span>{rotulo}</span><span className="text-right text-foreground">{valor}</span></div>;
}
