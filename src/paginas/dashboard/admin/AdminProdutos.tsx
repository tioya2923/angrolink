/**
 * Admin — Gestão de produtos
 * Editar destaque e disponibilidade com dados reais do Supabase.
 */

import { useEffect, useState } from 'react';
import { Star, Eye, EyeOff } from 'lucide-react';

import { Produto } from '@/tipos';
import { useToast } from '@/hooks/use-toast';

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
    <div className="space-y-4">
      <h1 className="font-titulo text-2xl font-bold">
        Gestão de Produtos
      </h1>

      {produtos.length === 0 ? (
        <p className="font-corpo text-sm text-muted-foreground py-8 text-center">
          Nenhum produto encontrado.
        </p>
      ) : (
        <div className="space-y-2">
          {produtos.map(p => {
            const vendedor = (p as any).vendedor;

            return (
              <div
                key={p.id}
                className="border-2 border-border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-titulo text-sm">
                      {p.nome_produto}
                    </span>

                    {p.destaque && (
                      <Star
                        size={14}
                        className="text-secondary fill-secondary"
                      />
                    )}

                    {!p.disponivel && (
                      <span className="font-corpo text-xs text-destructive">
                        (indisponível)
                      </span>
                    )}
                  </div>

                  <p className="font-corpo text-xs text-muted-foreground">
                    {vendedor?.nome_comercial || 'Sem vendedor'}
                    {' · '}
                    {p.municipio || 'Sem município'}
                    {' · '}
                    {Number(p.preco_aproximado || 0).toLocaleString()} Kz/
                    {p.unidade || 'unidade'}
                  </p>

                  <p className="font-corpo text-xs text-muted-foreground">
                    Categoria: {p.categoria_nome || 'Sem categoria'}
                    {' · '}
                    Tipo: {p.tipo_venda || 'não definido'}
                  </p>
                </div>

                <div className="flex gap-2 flex-wrap">
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