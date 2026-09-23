import { useEffect, useRef, useState } from 'react';
import { ShoppingCart, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contextos/AuthContexto';
import { useCarrinho } from '@/hooks/useCarrinho';
import { agruparItensPorVendedor } from '@/dominio/carrinho';
import { formatarCentimosAoa } from '@/dominio/encomendas';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { ListaItensCarrinho } from '@/componentes/carrinho/ListaItensCarrinho';

const rotasProdutos = [/^\/$/, /^\/pesquisa$/, /^\/produto\/[^/]+$/, /^\/vendedor\/[^/]+$/];

function rotaPodeMostrarBarra(pathname: string) {
  return rotasProdutos.some((rota) => rota.test(pathname));
}

/** Atalho móvel do único estado de carrinho; não inicia checkout nem revalidação. */
export function BarraCarrinhoMovel() {
  const [aberto, setAberto] = useState(false);
  const [manterDrawerAteFechar, setManterDrawerAteFechar] = useState(false);
  const destinoAposFechoRef = useRef<string | null>(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { utilizador } = useAuth();
  const { itens, quantidadeItens, subtotalEstimadoCentimos, atualizarQuantidade, removerItem } = useCarrinho();

  const papelBloqueado = utilizador?.papel === 'admin' || utilizador?.papel === 'parceiro_entrega';
  const visivel = itens.length > 0 && !papelBloqueado && rotaPodeMostrarBarra(pathname);
  useEffect(() => {
    if (!visivel && aberto) {
      setManterDrawerAteFechar(true);
      setAberto(false);
    }
  }, [aberto, visivel]);

  const concluirFechoDoDrawer = () => {
    if (aberto) return;
    setManterDrawerAteFechar(false);
    if (!destinoAposFechoRef.current) return;
    const destino = destinoAposFechoRef.current;
    destinoAposFechoRef.current = null;
    navigate(destino);
  };

  if (!visivel && !aberto && !manterDrawerAteFechar) return null;

  const grupos = agruparItensPorVendedor(itens);
  const rotuloQuantidade = `${quantidadeItens} ${quantidadeItens === 1 ? 'produto' : 'produtos'}`;
  const irParaCarrinho = () => {
    destinoAposFechoRef.current = '/carrinho';
  };

  return <>
    {visivel && <div aria-hidden="true" className="h-[calc(5.5rem+env(safe-area-inset-bottom))] md:hidden" />}
    <Drawer open={aberto} onOpenChange={setAberto} onAnimationEnd={estaAberto => { if (!estaAberto) concluirFechoDoDrawer(); }}>
      {visivel && <DrawerTrigger asChild>
        <button
          type="button"
          className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-green-900 bg-green-800 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-left text-white shadow-lg md:hidden"
          aria-label={`Ver carrinho, ${rotuloQuantidade}, subtotal ${formatarCentimosAoa(subtotalEstimadoCentimos)}`}
        >
          <span className="rounded-full bg-white/15 p-2"><ShoppingCart className="size-5" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{rotuloQuantidade}</span><span className="block text-xs text-green-100">{formatarCentimosAoa(subtotalEstimadoCentimos)}</span></span>
          <span className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-green-900">Ver carrinho</span>
        </button>
      </DrawerTrigger>}
      <DrawerContent onAnimationEnd={concluirFechoDoDrawer} className="z-50 h-[min(82dvh,44rem)] max-h-[calc(100dvh-env(safe-area-inset-bottom))]">
        <DrawerHeader className="shrink-0 border-b text-left">
          <div className="flex items-center justify-between gap-3">
            <DrawerTitle>O seu carrinho</DrawerTitle>
            <DrawerClose asChild>
              <button
                type="button"
                aria-label="Fechar carrinho"
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </DrawerClose>
          </div>
          <DrawerDescription>{rotuloQuantidade} · subtotal estimado {formatarCentimosAoa(subtotalEstimadoCentimos)}</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <ListaItensCarrinho grupos={grupos} atualizarQuantidade={atualizarQuantidade} removerItem={removerItem} compacto />
        </div>
        <DrawerFooter className="shrink-0 border-t bg-background pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <DrawerClose asChild>
            <button type="button" onClick={irParaCarrinho} className="w-full rounded-lg bg-green-800 px-4 py-3 font-semibold text-white hover:bg-green-900">Ver carrinho e continuar</button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  </>;
}
