import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, ShoppingCart } from 'lucide-react';
import Cabecalho from '@/componentes/Cabecalho';
import Rodape from '@/componentes/Rodape';
import { ListaItensCarrinho } from '@/componentes/carrinho/ListaItensCarrinho';
import { useCarrinho } from '@/hooks/useCarrinho';
import { agruparItensPorVendedor, assinaturaRevalidacaoCarrinho, itensCarrinhoEquivalentes, subtotalCarrinhoCentimos, type ItemCarrinho } from '@/dominio/carrinho';
import { formatarCentimosAoa } from '@/dominio/encomendas';
import { useAuth } from '@/contextos/AuthContexto';
import { useAtualizacaoTempoReal } from '@/hooks/useAtualizacaoTempoReal';
import { atualizarEstadoItensCarrinho } from '@/services/carrinho';
import { useToast } from '@/hooks/use-toast';

export default function PaginaCarrinho() {
  const { utilizador } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { itens, atualizarItens, atualizarQuantidade, removerItem } = useCarrinho();
  const [aValidar, setAValidar] = useState(false);
  const [erroValidacao, setErroValidacao] = useState(false);
  const itensRef = useRef<ItemCarrinho[]>(itens);
  const pedidoEmCursoRef = useRef(false);

  useEffect(() => { itensRef.current = itens; }, [itens]);
  const assinatura = useMemo(() => assinaturaRevalidacaoCarrinho(itens), [itens]);

  const revalidar = useCallback(async () => {
    if (pedidoEmCursoRef.current || itensRef.current.length === 0) return { alterado: false, concluido: true };
    pedidoEmCursoRef.current = true;
    setAValidar(true);
    setErroValidacao(false);
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
      pedidoEmCursoRef.current = false;
      setAValidar(false);
    }
  }, [atualizarItens, toast]);

  useEffect(() => { void revalidar(); }, [assinatura, revalidar]);
  useAtualizacaoTempoReal(['produtos', 'vendedores'], () => { void revalidar(); });

  const grupos = useMemo(() => agruparItensPorVendedor(itens), [itens]);
  const total = subtotalCarrinhoCentimos(itens.filter((item) => item.disponivel));
  const temIndisponivel = itens.some((item) => !item.disponivel);

  const continuar = async () => {
    if (!utilizador) {
      navigate('/login', { state: { destino: '/checkout' } });
      return;
    }
    if (utilizador.papel !== 'cliente' && utilizador.papel !== 'vendedor') {
      toast({ title: 'A finalização está disponível apenas para contas de cliente ou vendedor.', variant: 'destructive' });
      return;
    }
    const resultado = await revalidar();
    if (!resultado.concluido) return;
    if (resultado.alterado) {
      toast({ title: 'O carrinho foi atualizado. Reveja os produtos antes de continuar.' });
      return;
    }
    if (itensRef.current.some((item) => !item.disponivel)) {
      toast({ title: 'Remova ou atualize os produtos indisponíveis antes de continuar.', variant: 'destructive' });
      return;
    }
    navigate('/checkout');
  };

  return <div className="flex min-h-screen flex-col">
    <Cabecalho />
    <main className="container flex-1 py-6">
      <Link to="/pesquisa" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-green-800"><ArrowLeft className="size-4" />Continuar a comprar</Link>
      <header className="mt-4 flex items-center gap-3">
        <span className="rounded-xl bg-green-100 p-3 text-green-800"><ShoppingCart className="size-6" /></span>
        <div><h1 className="font-titulo text-3xl font-bold">Carrinho</h1><p className="text-sm text-muted-foreground">Organizado por vendedor para criar encomendas separadas no checkout.</p></div>
      </header>
      {itens.length === 0 ? <section className="mt-8 rounded-2xl border-2 border-dashed border-border p-10 text-center">
        <ShoppingCart className="mx-auto size-10 text-muted-foreground" />
        <h2 className="mt-3 font-titulo text-xl font-bold">O seu carrinho está vazio</h2>
        <Link to="/pesquisa" className="mt-4 inline-block rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white">Ver produtos</Link>
      </section> : <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_320px]">
        <ListaItensCarrinho grupos={grupos} atualizarQuantidade={atualizarQuantidade} removerItem={removerItem} />
        <aside className="h-fit rounded-2xl border-2 border-green-200 bg-green-50 p-5 shadow-sm">
          <h2 className="font-titulo text-xl font-bold text-green-950">Resumo</h2>
          <div className="mt-5 flex justify-between border-b pb-3 text-sm"><span>Subtotal estimado</span><strong>{formatarCentimosAoa(total)}</strong></div>
          <p className="mt-4 text-xs text-muted-foreground">O valor final é confirmado no checkout.</p>
          {temIndisponivel && <p className="mt-3 text-xs font-medium text-red-700">Há produtos que precisam ser removidos ou atualizados.</p>}
          {erroValidacao && <button type="button" disabled={aValidar} onClick={() => void revalidar()} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-green-800 hover:underline"><RefreshCw className="size-3.5" />Tentar novamente</button>}
          <button type="button" disabled={aValidar} onClick={() => void continuar()} className="mt-5 w-full rounded-lg bg-green-800 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{aValidar ? 'A atualizar…' : 'Continuar para checkout'}</button>
        </aside>
      </div>}
    </main>
    <Rodape />
  </div>;
}
