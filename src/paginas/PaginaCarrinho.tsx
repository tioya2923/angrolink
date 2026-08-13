import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, PackageX, Plus, RefreshCw, ShoppingCart, Trash2 } from 'lucide-react';
import Cabecalho from '@/componentes/Cabecalho';
import Rodape from '@/componentes/Rodape';
import { useCarrinho } from '@/hooks/useCarrinho';
import { agruparItensPorVendedor, assinaturaRevalidacaoCarrinho, itensCarrinhoEquivalentes, precoUnitarioEstimadoCentimos, quantidadeMinimaItem, subtotalCarrinhoCentimos, subtotalEstimadoCentimos, type ItemCarrinho } from '@/dominio/carrinho';
import { formatarCentimosAoa } from '@/dominio/encomendas';
import { useAuth } from '@/contextos/AuthContexto';
import { useAtualizacaoTempoReal } from '@/hooks/useAtualizacaoTempoReal';
import { atualizarEstadoItensCarrinho } from '@/services/carrinho';
import { useToast } from '@/hooks/use-toast';

export default function PaginaCarrinho() {
  const { utilizador } = useAuth(); const { toast } = useToast(); const navigate = useNavigate();
  const { itens, atualizarItens, atualizarQuantidade, removerItem } = useCarrinho();
  const [aValidar, setAValidar] = useState(false); const [erroValidacao, setErroValidacao] = useState(false);
  const itensRef = useRef<ItemCarrinho[]>(itens); const pedidoEmCursoRef = useRef(false);
  useEffect(() => { itensRef.current = itens; }, [itens]);
  const assinatura = useMemo(() => assinaturaRevalidacaoCarrinho(itens), [itens]);

  const revalidar = useCallback(async () => {
    if (pedidoEmCursoRef.current || itensRef.current.length === 0) return { alterado: false, concluido: true };
    pedidoEmCursoRef.current = true; setAValidar(true); setErroValidacao(false);
    try {
      const antes = itensRef.current;
      const depois = await atualizarEstadoItensCarrinho(antes);
      const alterado = !itensCarrinhoEquivalentes(antes, depois);
      if (alterado) atualizarItens(depois);
      return { alterado, concluido: true };
    } catch {
      setErroValidacao(true);
      toast({ title: 'Não foi possível atualizar o carrinho. Tenta novamente.', variant: 'destructive' });
      return { alterado: false, concluido: false };
    } finally {
      pedidoEmCursoRef.current = false; setAValidar(false);
    }
  }, [atualizarItens, toast]);

  // Só muda quando o conteúdo que o cliente editou muda: adição, remoção ou quantidade.
  useEffect(() => { void revalidar(); }, [assinatura, revalidar]);
  useAtualizacaoTempoReal(['produtos', 'vendedores'], () => { void revalidar(); });

  const grupos = useMemo(() => agruparItensPorVendedor(itens), [itens]);
  const total = subtotalCarrinhoCentimos(itens.filter((item) => item.disponivel));
  const temIndisponivel = itens.some((item) => !item.disponivel);
  const continuar = async () => {
    if (!utilizador) { navigate('/login', { state: { destino: '/checkout' } }); return; }
    if (utilizador.papel !== 'cliente') { toast({ title: 'A finalização está disponível apenas para contas de cliente.', variant: 'destructive' }); return; }
    const resultado = await revalidar();
    if (!resultado.concluido) return;
    if (resultado.alterado) { toast({ title: 'O carrinho foi atualizado. Reveja os produtos antes de continuar.' }); return; }
    if (itensRef.current.some((item) => !item.disponivel)) { toast({ title: 'Remova ou atualize os produtos indisponíveis antes de continuar.', variant: 'destructive' }); return; }
    navigate('/checkout');
  };

  return <div className="flex min-h-screen flex-col"><Cabecalho /><main className="container flex-1 py-6"><Link to="/pesquisa" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-green-800"><ArrowLeft className="size-4" />Continuar a comprar</Link><header className="mt-4 flex items-center gap-3"><span className="rounded-xl bg-green-100 p-3 text-green-800"><ShoppingCart className="size-6" /></span><div><h1 className="font-titulo text-3xl font-bold">Carrinho</h1><p className="text-sm text-muted-foreground">Organizado por vendedor para criar encomendas separadas no checkout.</p></div></header>{itens.length === 0 ? <section className="mt-8 rounded-2xl border-2 border-dashed border-border p-10 text-center"><ShoppingCart className="mx-auto size-10 text-muted-foreground" /><h2 className="mt-3 font-titulo text-xl font-bold">O seu carrinho está vazio</h2><Link to="/pesquisa" className="mt-4 inline-block rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white">Ver produtos</Link></section> : <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_320px]"><div className="space-y-5">{grupos.map((grupo) => <section key={grupo.vendedor_id} className="rounded-2xl border bg-card p-4 shadow-sm"><h2 className="font-titulo text-lg font-bold text-green-900">{grupo.vendedor_nome}</h2><p className="mt-1 text-xs text-muted-foreground">Este grupo será uma encomenda independente.</p><div className="mt-4 divide-y">{grupo.itens.map((item) => { const minimo = quantidadeMinimaItem(item); const unitario = precoUnitarioEstimadoCentimos(item); return <article key={item.produto_id} className="flex gap-3 py-4 first:pt-0"><img src={item.imagem || '/placeholder.png'} alt="" className="size-16 rounded-lg border object-cover" onError={(evento) => { evento.currentTarget.src = '/placeholder.png'; }} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">{item.nome}</h3><p className="text-xs text-muted-foreground">{formatarCentimosAoa(unitario)} / {item.unidade}</p>{item.tipo_venda === 'ambos' && item.quantidade_minima_grosso && <p className="mt-1 text-xs text-amber-700">{item.quantidade >= item.quantidade_minima_grosso ? 'Preço de grosso aplicável' : `Preço de grosso a partir de ${item.quantidade_minima_grosso} ${item.unidade}`}</p>}</div><button type="button" onClick={() => removerItem(item.produto_id)} aria-label={`Remover ${item.nome}`} className="text-red-600 hover:text-red-800"><Trash2 className="size-4" /></button></div>{!item.disponivel && <p className="mt-2 flex items-center gap-1 text-xs font-medium text-red-700"><PackageX className="size-3.5" />Produto indisponível ou vendedor não elegível para compra.</p>}<div className="mt-3 flex items-center justify-between gap-3"><div className="flex items-center rounded-lg border"><button type="button" onClick={() => atualizarQuantidade(item.produto_id, item.quantidade - minimo)} className="p-2" aria-label="Diminuir quantidade"><Minus className="size-4" /></button><input aria-label={`Quantidade de ${item.nome}`} type="number" min={minimo} step="0.001" value={item.quantidade} onChange={(evento) => atualizarQuantidade(item.produto_id, Number(evento.target.value))} className="w-16 border-x py-1 text-center text-sm" /><button type="button" onClick={() => atualizarQuantidade(item.produto_id, item.quantidade + minimo)} className="p-2" aria-label="Aumentar quantidade"><Plus className="size-4" /></button></div><strong className="text-green-800">{formatarCentimosAoa(subtotalEstimadoCentimos(item))}</strong></div><p className="mt-1 text-xs text-muted-foreground">Mínimo: {minimo} {item.unidade}</p></div></article>; })}</div></section>)}</div><aside className="h-fit rounded-2xl border-2 border-green-200 bg-green-50 p-5 shadow-sm"><h2 className="font-titulo text-xl font-bold text-green-950">Resumo</h2><div className="mt-5 flex justify-between border-b pb-3 text-sm"><span>Subtotal estimado</span><strong>{formatarCentimosAoa(total)}</strong></div><p className="mt-4 text-xs text-muted-foreground">O valor final é confirmado no checkout.</p>{temIndisponivel && <p className="mt-3 text-xs font-medium text-red-700">Há produtos que precisam ser removidos ou atualizados.</p>}{erroValidacao && <button type="button" disabled={aValidar} onClick={() => void revalidar()} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-green-800 hover:underline"><RefreshCw className="size-3.5" />Tentar novamente</button>}<button type="button" disabled={aValidar} onClick={() => void continuar()} className="mt-5 w-full rounded-lg bg-green-800 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{aValidar ? 'A atualizar…' : 'Continuar para checkout'}</button></aside></div>}</main><Rodape /></div>;
}
