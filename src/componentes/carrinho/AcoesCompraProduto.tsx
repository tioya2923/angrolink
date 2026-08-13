import { ShoppingCart, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCarrinho } from '@/hooks/useCarrinho';
import { useAuth } from '@/contextos/AuthContexto';
import type { Produto } from '@/tipos';
import { useElegibilidadeVendedor } from '@/hooks/useElegibilidadeVendedor';
import { useToast } from '@/hooks/use-toast';
import { produtoPodeUsarCtaTransacional } from '@/dominio/carrinho';

type Props = {
  produto: Produto;
  vendedorNome?: string | null;
  modo?: 'card' | 'detalhe';
};

function paraCentimos(valor?: number | null) {
  return Math.round(Number(valor ?? 0) * 100);
}

export function AcoesCompraProduto({ produto, vendedorNome, modo = 'detalhe' }: Props) {
  const { utilizador } = useAuth();
  const { adicionarItem } = useCarrinho();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { elegivel, aCarregar } = useElegibilidadeVendedor(produto.vendedor_id);
  const vendedorDono = utilizador?.papel === 'vendedor' && utilizador.vendedor_id === produto.vendedor_id;
  const podeComprar = produtoPodeUsarCtaTransacional(produto, elegivel, vendedorDono);

  if (!podeComprar) {
    if (aCarregar || vendedorDono || !produto.disponivel) return null;
    return modo === 'card' ? <p className="text-center text-[11px] text-muted-foreground">Compra pela plataforma indisponível</p> : <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Compra pela plataforma indisponível. Pode contactar o vendedor diretamente.</p>;
  }

  const adicionar = () => {
    const precoRetalho = produto.preco_promocional !== null && produto.preco_promocional !== undefined && produto.preco_promocional > 0 && produto.preco_promocional < Number(produto.preco_aproximado ?? 0)
      ? produto.preco_promocional
      : produto.preco_aproximado;
    const tipoVenda = produto.tipo_venda === 'grosso' || produto.tipo_venda === 'ambos' ? produto.tipo_venda : 'retalho';
    const quantidadeMinima = Math.max(1, Number(produto.quantidade_minima ?? 1));
    const quantidadeGrosso = produto.quantidade_minima_grosso ? Math.max(quantidadeMinima, Number(produto.quantidade_minima_grosso)) : null;
    adicionarItem({
      produto_id: produto.id,
      vendedor_id: produto.vendedor_id!,
      vendedor_nome: vendedorNome || produto.vendedor?.nome_comercial || 'Vendedor ANGROLINK',
      nome: produto.nome_produto,
      imagem: produto.imagem_url || produto.imagem_principal || null,
      unidade: produto.unidade || 'unidade',
      quantidade: tipoVenda === 'grosso' && quantidadeGrosso ? quantidadeGrosso : quantidadeMinima,
      preco_retalho_centimos: paraCentimos(precoRetalho),
      preco_grosso_centimos: produto.preco_grosso ? paraCentimos(produto.preco_grosso) : null,
      tipo_venda: tipoVenda,
      quantidade_minima: quantidadeMinima,
      quantidade_minima_grosso: quantidadeGrosso,
      disponivel: true,
      atualizado_em: new Date().toISOString(),
    });
  };

  const adicionarAoCarrinho = () => {
    adicionar();
    toast({ title: 'Produto adicionado ao carrinho.' });
  };

  const comprarAgora = () => {
    adicionar();
    if (utilizador?.papel === 'cliente') {
      navigate(`/checkout?vendedor=${produto.vendedor_id}`);
      return;
    }
    if (!utilizador) {
      navigate('/login', { state: { destino: `/checkout?vendedor=${produto.vendedor_id}` } });
      return;
    }
    toast({ title: 'Compra disponível apenas para contas de cliente.', variant: 'destructive' });
  };

  if (modo === 'card') return <button type="button" onClick={adicionarAoCarrinho} className="w-full rounded-lg border border-green-700 px-2 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-50"><ShoppingCart className="mr-1 inline size-3.5" />Adicionar</button>;

  return <div className="grid gap-2 sm:grid-cols-2"><button type="button" onClick={comprarAgora} className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-800 px-4 py-3 font-semibold text-white hover:bg-green-900"><Zap className="size-4" />Comprar agora</button><button type="button" onClick={adicionarAoCarrinho} className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-green-700 px-4 py-3 font-semibold text-green-800 hover:bg-green-50"><ShoppingCart className="size-4" />Adicionar ao carrinho</button></div>;
}
