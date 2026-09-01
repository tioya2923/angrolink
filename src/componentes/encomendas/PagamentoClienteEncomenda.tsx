import { CreditCard } from 'lucide-react';
import { formatarCentimosAoa, formatarDataEncomenda } from '@/dominio/encomendas';
import { rotuloEstadoPagamento, rotuloMetodoPagamento } from '@/dominio/pagamentos';
import type { PagamentoEncomendaCliente } from '@/services/pagamentos';

export function PagamentoClienteEncomenda({ pagamento, carregando, erro }: {
  pagamento: PagamentoEncomendaCliente | null;
  carregando: boolean;
  erro: boolean;
}) {
  return <section className="painel-dashboard-form">
    <h2 className="flex items-center gap-2 font-titulo text-lg font-bold"><CreditCard className="size-5 text-green-700" />Pagamento</h2>
    {carregando ? <p className="mt-3 text-sm text-muted-foreground">A carregar dados do pagamento…</p>
      : erro ? <p className="mt-3 text-sm text-red-700">Não foi possível carregar os dados financeiros.</p>
        : !pagamento ? <p className="mt-3 text-sm text-muted-foreground">Ainda não existe uma obrigação financeira para esta encomenda.</p>
          : <div className="mt-4 space-y-2 text-sm">
            <Linha rotulo="Método" valor={pagamento.metodo_pagamento ? rotuloMetodoPagamento(pagamento.metodo_pagamento) : 'Método ainda não disponível'} />
            <Linha rotulo="Estado" valor={rotuloEstadoPagamento(pagamento.estado_pagamento)} />
            <Linha rotulo="Total" valor={formatarCentimosAoa(pagamento.total_cliente_centimos)} forte />
            <Linha rotulo="Moeda" valor={pagamento.moeda} />
            <Linha rotulo="Criado em" valor={formatarDataEncomenda(pagamento.criado_em)} />
            {pagamento.confirmado_em && <Linha rotulo="Confirmado em" valor={formatarDataEncomenda(pagamento.confirmado_em)} />}
            <Linha rotulo="Referência" valor={pagamento.referencia_interna} />
          </div>}
  </section>;
}

function Linha({ rotulo, valor, forte = false }: { rotulo: string; valor: string; forte?: boolean }) {
  return <div className={`flex items-baseline justify-between gap-4 ${forte ? 'border-t border-border pt-2 font-bold text-green-800' : 'text-muted-foreground'}`}><span>{rotulo}</span><span className="text-right text-foreground">{valor}</span></div>;
}
