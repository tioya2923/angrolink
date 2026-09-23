import { Minus, PackageX, Plus, Trash2 } from 'lucide-react';
import { formatarCentimosAoa } from '@/dominio/encomendas';
import {
  precoUnitarioEstimadoCentimos,
  quantidadeMinimaItem,
  subtotalEstimadoCentimos,
  type GrupoCarrinho,
} from '@/dominio/carrinho';

type Props = {
  grupos: GrupoCarrinho[];
  atualizarQuantidade: (produtoId: string, quantidade: number) => void;
  removerItem: (produtoId: string) => void;
  compacto?: boolean;
};

/** Apresentação compartilhada pela página integral e pelo painel móvel. */
export function ListaItensCarrinho({ grupos, atualizarQuantidade, removerItem, compacto = false }: Props) {
  return <div className="space-y-5">
    {grupos.map((grupo) => <section key={grupo.vendedor_id} className="rounded-2xl border bg-card p-4 shadow-sm">
      <h2 className="font-titulo text-lg font-bold text-green-900">{grupo.vendedor_nome}</h2>
      <p className="mt-1 text-xs text-muted-foreground">Este grupo será uma encomenda independente.</p>
      <div className="mt-4 divide-y">
        {grupo.itens.map((item) => {
          const minimo = quantidadeMinimaItem(item);
          const unitario = precoUnitarioEstimadoCentimos(item);
          return <article key={item.produto_id} className="flex gap-3 py-4 first:pt-0">
            <img
              src={item.imagem || '/placeholder.png'}
              alt=""
              className={`${compacto ? 'size-14' : 'size-16'} rounded-lg border object-cover`}
              onError={(evento) => { evento.currentTarget.src = '/placeholder.png'; }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{item.nome}</h3>
                  <p className="text-xs text-muted-foreground">{formatarCentimosAoa(unitario)} / {item.unidade}</p>
                  {item.tipo_venda === 'ambos' && item.quantidade_minima_grosso && <p className="mt-1 text-xs text-amber-700">{item.quantidade >= item.quantidade_minima_grosso ? 'Preço de grosso aplicável' : `Preço de grosso a partir de ${item.quantidade_minima_grosso} ${item.unidade}`}</p>}
                </div>
                <button type="button" onClick={() => removerItem(item.produto_id)} aria-label={`Remover ${item.nome}`} className="text-red-600 hover:text-red-800"><Trash2 className="size-4" /></button>
              </div>
              {!item.disponivel && <p className="mt-2 flex items-center gap-1 text-xs font-medium text-red-700"><PackageX className="size-3.5" />Produto indisponível ou vendedor não elegível para compra.</p>}
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center rounded-lg border">
                  <button type="button" onClick={() => atualizarQuantidade(item.produto_id, item.quantidade - minimo)} className="p-2" aria-label={`Diminuir quantidade de ${item.nome}`}><Minus className="size-4" /></button>
                  <input aria-label={`Quantidade de ${item.nome}`} type="number" min={minimo} step="0.001" value={item.quantidade} onChange={(evento) => atualizarQuantidade(item.produto_id, Number(evento.target.value))} className="w-16 border-x py-1 text-center text-sm" />
                  <button type="button" onClick={() => atualizarQuantidade(item.produto_id, item.quantidade + minimo)} className="p-2" aria-label={`Aumentar quantidade de ${item.nome}`}><Plus className="size-4" /></button>
                </div>
                <strong className="text-green-800">{formatarCentimosAoa(subtotalEstimadoCentimos(item))}</strong>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Mínimo: {minimo} {item.unidade}</p>
            </div>
          </article>;
        })}
      </div>
    </section>)}
  </div>;
}
