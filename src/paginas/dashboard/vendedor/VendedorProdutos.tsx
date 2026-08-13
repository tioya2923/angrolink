/**
 * Vendedor — Lista dos seus produtos
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  Star,
  Edit,
  Trash2,
  Share2,
  Eye,
  MessageSquare,
} from 'lucide-react';

import { Produto } from '@/tipos';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contextos/AuthContexto';
import { useAtualizacaoTempoReal } from '@/hooks/useAtualizacaoTempoReal';
import { obterPromocao } from '@/lib/precos';

import {
  fetchProdutosPorVendedor,
  deleteProduto,
  updateProduto,
  destacarProdutoGratis,
  removerDestaqueProduto,
} from '@/services/api';

export default function VendedorProdutos() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { utilizador } = useAuth();

  const vendedorPendente =
    utilizador?.papel === 'vendedor' &&
    utilizador?.status_aprovacao !== 'aprovado';
  const contaSuspensa = utilizador?.status_aprovacao === 'suspenso';
  const textoBloqueio = contaSuspensa
    ? 'A sua conta está suspensa. Pode consultar os produtos, mas não pode criar, editar, remover ou alterar anúncios até à reativação.'
    : 'A sua conta está em análise. Poderá gerir produtos após a aprovação da equipa ANGROLINK.';

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const [atualizandoId, setAtualizandoId] = useState<string | null>(null);

  // =============================
  // BLOQUEIO CENTRAL
  // =============================
  const bloquearAcao = () => {
    toast({
      title: contaSuspensa ? 'Conta suspensa' : 'Conta em análise',
      description: textoBloqueio,
      variant: 'destructive',
    });
  };

  // =============================
  // CARREGAR PRODUTOS DO VENDEDOR
  // =============================
  async function carregarProdutos() {
    if (!utilizador?.vendedor_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const data = await fetchProdutosPorVendedor(utilizador.vendedor_id);

      setProdutos(data || []);
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);

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
  }, [utilizador?.vendedor_id]);

  useAtualizacaoTempoReal(['produtos', 'vendedores'], carregarProdutos);

  // =============================
  // REMOVER PRODUTO
  // =============================
  const removerProduto = async (id: string) => {
    if (vendedorPendente) return bloquearAcao();

    const confirmar = window.confirm(
      'Tens a certeza que queres remover este produto?'
    );

    if (!confirmar) return;

    try {
      setRemovendoId(id);

      await deleteProduto(id);

      setProdutos(prev => prev.filter(p => p.id !== id));

      toast({
        title: 'Produto removido',
        description: 'O produto foi eliminado com sucesso.',
      });
    } catch (err) {
      console.error(err);

      toast({
        title: 'Erro ao remover produto',
        variant: 'destructive',
      });
    } finally {
      setRemovendoId(null);
    }
  };

  // =============================
  // ATUALIZAR DESTAQUE
  // =============================
  // =============================
// ATUALIZAR DESTAQUE
// =============================
const toggleDestaque = async (produto: Produto) => {
  if (vendedorPendente) return bloquearAcao();

  try {
    setAtualizandoId(produto.id);

    if (produto.destaque) {
      await removerDestaqueProduto(produto.id);

      toast({
        title: 'Destaque removido',
        description: 'O produto voltou ao estado normal.',
      });
    } else {
      await destacarProdutoGratis(produto.id);

      toast({
        title: 'Produto destacado',
        description:
          'Este produto ficará em destaque durante 7 dias. Se já tinhas outro produto destacado, ele foi substituído.',
      });
    }

    await carregarProdutos();
  } catch (err: any) {
    console.error(err);

    toast({
      title: 'Erro ao atualizar destaque',
      description:
        err?.message || 'Não foi possível atualizar o destaque deste produto.',
      variant: 'destructive',
    });
  } finally {
    setAtualizandoId(null);
  }
};

  // =============================
  // ATUALIZAR DISPONIBILIDADE
  // =============================
  const toggleDisponibilidade = async (produto: Produto) => {
    if (vendedorPendente) return bloquearAcao();

    try {
      setAtualizandoId(produto.id);

      const novoValor = !produto.disponivel;

      await updateProduto(produto.id, {
        disponivel: novoValor,
      });

      setProdutos(prev =>
        prev.map(p =>
          p.id === produto.id
            ? { ...p, disponivel: novoValor }
            : p
        )
      );

      toast({
        title: novoValor ? 'Produto ativado' : 'Produto pausado',
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

  // =============================
  // PARTILHAR PRODUTO
  // =============================
  const partilharProduto = async (produto: Produto) => {
    const url = `${window.location.origin}/produto/${produto.id}`;

    try {
      await navigator.clipboard.writeText(url);

      toast({
        title: 'Link copiado!',
        description: 'Partilha no WhatsApp, Facebook ou grupos.',
      });
    } catch {
      toast({
        title: 'Não foi possível copiar o link',
        description: url,
        variant: 'destructive',
      });
    }
  };

  // =============================
  // EDITAR PRODUTO
  // =============================
  const editarProduto = (produto: Produto) => {
    if (vendedorPendente) return bloquearAcao();

    navigate(`/dashboard/produtos/editar/${produto.id}`);
  };

  // =============================
  // LOADING
  // =============================
  if (loading) {
    return (
      <p className="font-corpo text-sm text-muted-foreground">
        A carregar produtos...
      </p>
    );
  }

  // =============================
  // SEM VENDEDOR
  // =============================
  if (!utilizador?.vendedor_id) {
    return (
      <p className="font-corpo text-sm text-muted-foreground">
        Esta conta ainda não está ligada a um vendedor.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="painel-dashboard-cabecalho flex items-center justify-between gap-3">
        <div>
          <h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">
            Meus Produtos
          </h1>

          <p className="relative z-10 font-corpo text-sm text-primary-foreground/80 mt-1">
            Gere os teus produtos, disponibilidade, destaques e desempenho.
          </p>
        </div>

        <button
          onClick={() => {
            if (vendedorPendente) return bloquearAcao();

            navigate('/dashboard/adicionar');
          }}
          className="flex items-center gap-2 font-corpo text-sm bg-green-700 text-white px-4 py-2 border-2 border-green-700 hover:bg-green-800 transition-colors shrink-0 rounded-md"
        >
          <PlusCircle size={16} />
          {vendedorPendente ? (contaSuspensa ? 'Conta suspensa' : 'Aguardar aprovação') : 'Adicionar Produto'}
        </button>
      </div>

      {vendedorPendente && (
        <div className={`border-2 p-4 rounded-md ${contaSuspensa ? 'border-red-300 bg-red-50' : 'border-yellow-500/40 bg-yellow-500/10'}`}>
          <p className="font-corpo text-sm font-semibold">{contaSuspensa ? 'Conta suspensa' : 'Conta em análise'}</p>
          <p className="mt-1 font-corpo text-xs text-muted-foreground">{textoBloqueio}</p>
        </div>
      )}

      {/* EMPTY STATE */}
      {produtos.length === 0 ? (
        <div className="border-2 border-dashed border-border p-6 text-center space-y-3">
          <p className="font-corpo text-sm text-muted-foreground">
            Ainda não publicaste nenhum produto.
          </p>

          <button
            onClick={() => {
              if (vendedorPendente) {
                bloquearAcao();
                return;
              }

              navigate('/dashboard/adicionar');
            }}
            className="inline-flex items-center gap-2 font-corpo text-sm bg-green-700 text-white px-4 py-2 border-2 border-green-700 hover:bg-green-800 transition-colors rounded-md"
          >
            <PlusCircle size={16} />
            {vendedorPendente ? (contaSuspensa ? 'Conta suspensa' : 'Aguardar aprovação') : 'Publicar primeiro produto'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {produtos.map(produto => {
            const visualizacoes = Number((produto as any).visualizacoes || 0);
            const cliquesWhatsapp = Number((produto as any).cliques_whatsapp || 0);
            const promocao = obterPromocao(produto.preco_aproximado, produto.preco_promocional);

            return (
              <div
                key={produto.id}
                className="painel-dashboard-item p-4 flex flex-col sm:flex-row gap-3"
              >
                {/* IMAGEM */}
                <div className="w-full sm:w-24 h-20 bg-muted shrink-0">
                  <img
                    src={
                      produto.imagem_url ||
                      produto.imagem_principal ||
                      '/placeholder.png'
                    }
                    alt={produto.nome_produto}
                    className="w-full h-full object-cover"
                    onError={e => {
                      e.currentTarget.src = '/placeholder.png';
                    }}
                  />
                </div>

                {/* INFO */}
                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-titulo text-sm">
                      {produto.nome_produto}
                    </span>

                    {produto.destaque && (
                      <Star
                        size={14}
                        className="text-secondary fill-secondary"
                      />
                    )}

                    <span
                      className={`text-[10px] px-2 py-0.5 border ${
                        produto.disponivel
                          ? 'border-green-700 text-green-700 bg-green-50'
                          : 'border-destructive text-destructive bg-destructive/5'
                      }`}
                    >
                      {produto.disponivel ? 'Disponível' : 'Pausado'}
                    </span>
                  </div>

                  {promocao ? (
                    <p className="font-corpo text-xs"><span className="font-semibold text-destructive">{promocao.precoPromocional.toLocaleString('pt-AO')} Kz</span><span className="ml-2 text-muted-foreground line-through">{promocao.precoOriginal.toLocaleString('pt-AO')} Kz</span><span className="ml-2 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">-{promocao.percentagem}%</span></p>
                  ) : <p className="font-corpo text-xs text-muted-foreground">
                    {Number(produto.preco_aproximado || 0).toLocaleString()} Kz/
                    {produto.unidade || 'unidade'}
                    {' · '}
                    {produto.categoria_nome || 'Sem categoria'}
                    {' · '}
                    {produto.tipo_venda || 'tipo não definido'}
                  </p>}

                  <div className="flex flex-wrap gap-4 font-corpo text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye size={12} />
                      {visualizacoes} visualizações
                    </span>

                    <span className="flex items-center gap-1">
                      <MessageSquare size={12} />
                      {cliquesWhatsapp} cliques WhatsApp
                    </span>
                  </div>
                </div>

                {/* AÇÕES */}
                <div className="flex sm:flex-col gap-2 shrink-0">
                  <button
                    onClick={() => editarProduto(produto)}
                    className="font-corpo text-xs border-2 border-border px-3 py-1.5 hover:border-green-700 hover:text-green-700 hover:bg-green-50 transition-colors"
                  >
                    <Edit size={12} className="inline mr-1" />
                    Editar
                  </button>

                  <button
                    disabled={atualizandoId === produto.id}
                    onClick={() => toggleDisponibilidade(produto)}
                    className="font-corpo text-xs border-2 border-border px-3 py-1.5 hover:border-green-700 hover:text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
                  >
                    {atualizandoId === produto.id
                      ? 'A atualizar...'
                      : produto.disponivel
                        ? 'Pausar'
                        : 'Ativar'}
                  </button>

                  <button
                    disabled={atualizandoId === produto.id}
                    onClick={() => toggleDestaque(produto)}
                    className="font-corpo text-xs border-2 border-border px-3 py-1.5 hover:border-secondary hover:text-secondary transition-colors disabled:opacity-50"
                  >
                    <Star size={12} className="inline mr-1" />
                    {atualizandoId === produto.id
                      ? 'A atualizar...'
                      : produto.destaque
                        ? 'Remover'
                        : 'Destacar'}
                  </button>

                  <button
                    onClick={() => partilharProduto(produto)}
                    className="font-corpo text-xs border-2 border-border px-3 py-1.5 hover:border-green-700 hover:text-green-700 hover:bg-green-50 transition-colors"
                  >
                    <Share2 size={12} className="inline mr-1" />
                    Partilhar
                  </button>

                  <button
                    disabled={removendoId === produto.id}
                    onClick={() => removerProduto(produto.id)}
                    className="font-corpo text-xs border-2 border-border px-3 py-1.5 hover:border-destructive hover:text-destructive transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={12} className="inline mr-1" />
                    {removendoId === produto.id ? 'A remover...' : 'Remover'}
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
