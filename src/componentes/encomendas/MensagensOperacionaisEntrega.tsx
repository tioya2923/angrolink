import { useState } from 'react';
import { MensagensEncomenda } from '@/componentes/encomendas/MensagensEncomenda';
import type { CanalMensagemEncomenda } from '@/services/mensagensEncomenda';

type Aba = { id: CanalMensagemEncomenda; titulo: string; atribuicaoEntregaId?: string | null; bloquearEnvio?: boolean };
export function MensagensOperacionaisEntrega({ encomendaId, estadoEncomenda, abas }: { encomendaId: string; estadoEncomenda: string; abas: Aba[] }) {
  const [ativa, setAtiva] = useState<CanalMensagemEncomenda>(abas[0]?.id ?? 'comprador_vendedor');
  const aba = abas.find((item) => item.id === ativa) ?? abas[0];
  if (!aba) return null;
  return <section className="mt-6"><div className="flex gap-2 overflow-x-auto border-b" role="tablist" aria-label="Conversas operacionais">{abas.map((item) => <button key={item.id} type="button" role="tab" aria-selected={item.id === aba.id} onClick={() => setAtiva(item.id)} className={`shrink-0 border-b-2 px-3 py-2 text-sm font-semibold ${item.id === aba.id ? 'border-green-800 text-green-800' : 'border-transparent text-muted-foreground'}`}>{item.titulo}</button>)}</div><MensagensEncomenda key={`${aba.id}:${aba.atribuicaoEntregaId ?? 'base'}`} encomendaId={encomendaId} estadoEncomenda={estadoEncomenda} canal={aba.id} atribuicaoEntregaId={aba.atribuicaoEntregaId} bloquearEnvio={Boolean(aba.bloquearEnvio)} ativo /></section>;
}
