/**
 * Admin — Gestão de produtos
 * Editar destaque e disponibilidade com dados reais do Supabase.
 */

import { useEffect, useState } from 'react';
import { Star, Eye, EyeOff, MapPin, Package, Tag } from 'lucide-react';

import { Produto } from '@/tipos';
import { useToast } from '@/hooks/use-toast';
import { useAtualizacaoTempoReal } from '@/hooks/useAtualizacaoTempoReal';

import {
  fetchProdutosAdmin,
  updateProdutoAdmin,
} from '@/services/api';

export default function AdminProdutos() {
  const { toast } = useToast();

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [atualizandoId, setAtualizandoId] = useState<string | null>(null);

  async function carregarProdutos() {
    try {
      setLoading(true);

      const data = await fetchProdutosAdmin();
      setProdutos(data || []);
    } catch (err) {
      console.error(err);

      toast({
        title: 'Erro ao carregar produtos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarProdutos();
  }, []);

  useAtualizacaoTempoReal(['produtos', 'vendedores', 'categorias'], carregarProdutos);

  const toggleDestaque = async (produto: Produto) => {
    try {
      setAtualizandoId(produto.id);

      const novoValor = !produto.destaque;

      const atualizado = await updateProdutoAdmin(produto.id, {
        destaque: novoValor,
      });

      setProdutos(prev =>
        prev.map(p =>
          p.id === produto.id ? atualizado : p
        )
      );

      toast({
        title: novoValor ? 'Produto destacado' : 'Destaque removido',
      });
    } catch (err) {
      console.error(err);

      toast({
        title: 'Erro ao atualizar destaque',
        variant: 'destructive',
      });
    } finally {
      setAtualizandoId(null);
    }
  };

  const toggleDisponivel = async (produto: Produto) => {
    try {
      setAtualizandoId(produto.id);

      const novoValor = !produto.disponivel;

      const atualizado = await updateProdutoAdmin(produto.id, {
        disponivel: novoValor,
      });

      setProdutos(prev =>
        prev.map(p =>
          p.id === produto.id ? atualizado : p
        )
      );

      toast({
        title: novoValor ? 'Produto visível' : 'Produto ocultado',
      });
    } catch (err) {
      console.error(err);

      toast({
        title: 'Erro ao atualizar disponibilidade',
        variant: 'destructive',
      });
    } finally {
      setAtualizandoId(null);
    }
  };

  if (loading) {
    return (
      <p className="font-corpo text-sm text-muted-foreground">
        A carregar produtos...
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header className="painel-dashboard-cabecalho">
        <h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">Gestão de Produtos</h1>
        <p className="relative z-10 mt-1 font-corpo text-sm text-primary-foreground/80">Controla a visibilidade e o destaque dos anúncios publicados.</p>
      </header>

      {produtos.length === 0 ? (
        <p className="font-corpo text-sm text-muted-foreground py-8 text-center">
          Nenhum produto encontrado.
        </p>
      ) : (
        <div className="space-y-3">
          {produtos.map(p => {
            const vendedor = (p as any).vendedor;

            return (
              <div
                key={p.id}
                className="painel-dashboard-item p-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row">
                  {p.imagem_url || p.imagem_principal ? (
                    <img
                      src={p.imagem_url || p.imagem_principal || ''}
                      alt={p.nome_produto}
                      className="h-20 w-full shrink-0 rounded-lg border border-border object-cover sm:w-24"
                      onError={e => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <span className="flex h-20 w-full shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:w-24"><Package className="size-7" /></span>
                  )}

                  <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-titulo text-base font-bold">
                      {p.nome_produto}
                    </span>

                    {p.destaque && (
                      <Star
                        size={14}
                        className="text-secondary fill-secondary"
                      />
                    )}

                    <span className={`rounded-full px-2 py-0.5 font-corpo text-xs font-medium ${p.disponivel ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>{p.disponivel ? 'Visível' : 'Oculto'}</span>
                  </div>

                  <div className="mt-3 grid gap-x-5 gap-y-2 font-corpo text-xs text-muted-foreground sm:grid-cols-2">
                    <span>Vendedor: {vendedor?.nome_comercial || 'Sem vendedor'}</span>
                    <span className="flex items-center gap-1"><MapPin size={13} className="text-primary" />{p.municipio || 'Localização não indicada'}</span>
                    <span className="flex items-center gap-1"><Tag size={13} className="text-primary" />{p.categoria_nome || 'Sem categoria'} · {p.tipo_venda || 'Tipo não definido'}</span>
                    <span className="font-semibold text-foreground">{Number(p.preco_aproximado || 0).toLocaleString('pt-AO')} Kz/{p.unidade || 'unidade'}</span>
                  </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2 border-t border-border pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                  <button
                    disabled={atualizandoId === p.id}
                    onClick={() => toggleDestaque(p)}
                    className={`font-corpo text-xs border-2 px-3 py-1.5 transition-colors disabled:opacity-50 ${
                      p.destaque
                        ? 'border-secondary text-secondary'
                        : 'border-border hover:border-secondary hover:text-secondary'
                    }`}
                  >
                    <Star size={12} className="inline mr-1" />
                    {atualizandoId === p.id
                      ? 'A atualizar...'
                      : p.destaque
                        ? 'Remover Destaque'
                        : 'Destacar'}
                  </button>

                  <button
                    disabled={atualizandoId === p.id}
                    onClick={() => toggleDisponivel(p)}
                    className="font-corpo text-xs border-2 border-border px-3 py-1.5 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                  >
                    {atualizandoId === p.id ? (
                      'A atualizar...'
                    ) : p.disponivel ? (
                      <>
                        <EyeOff size={12} className="inline mr-1" />
                        Ocultar
                      </>
                    ) : (
                      <>
                        <Eye size={12} className="inline mr-1" />
                        Mostrar
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
