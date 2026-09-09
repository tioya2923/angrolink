import type { ItemCarrinho } from '@/dominio/carrinho';
import { consultarElegibilidadeVendedor } from '@/services/elegibilidadeVendedor';
import { listarProdutosPublicosFase1 } from '@/services/catalogoPublicoProdutos';
import { supabase } from '@/services/supabase';

type EstadoProdutoCarrinho = Pick<ItemCarrinho, 'produto_id' | 'vendedor_id' | 'disponivel' | 'preco_retalho_centimos' | 'preco_grosso_centimos'>;

export type LocalLevantamentoVendedor = {
  vendedor_id: string;
  nome_comercial: string;
  provincia: string | null;
  municipio: string | null;
  bairro: string | null;
  endereco_detalhado: string | null;
  ponto_referencia: string | null;
};

const paraCentimos = (valor: number | null) => Math.round(Number(valor ?? 0) * 100);

export async function atualizarEstadoItensCarrinho(
  itens: ItemCarrinho[],
  vendedorAutenticadoId?: string | null,
): Promise<ItemCarrinho[]> {
  if (itens.length === 0) return [];
  const ids = itens.map((item) => item.produto_id);
  const produtosPublicos = await listarProdutosPublicosFase1({ produtoIds: ids, limite: ids.length });
  const produtos = new Map(produtosPublicos.map((produto) => [String(produto.id), produto]));
  const vendedores = [...new Set(produtosPublicos.map((produto) => produto.vendedor_id).filter((id): id is string => typeof id === 'string' && Boolean(id)))];
  const elegiveis = new Map(await Promise.all(vendedores.map(async (vendedorId) => [vendedorId, await consultarElegibilidadeVendedor(vendedorId)] as const)));

  return itens.map((item) => {
    const produto = produtos.get(item.produto_id);
    const vendedorId = typeof produto?.vendedor_id === 'string' ? produto.vendedor_id : null;
    const precoPromocional = typeof produto?.preco_promocional === 'number' ? produto.preco_promocional : null;
    const precoAproximado = typeof produto?.preco_aproximado === 'number' ? produto.preco_aproximado : null;
    const precoGrosso = typeof produto?.preco_grosso === 'number' ? produto.preco_grosso : null;
    if (!produto || vendedorId !== item.vendedor_id || vendedorId === vendedorAutenticadoId) return { ...item, disponivel: false };
    const precoRetalho = precoPromocional !== null && precoPromocional > 0 && precoPromocional < (precoAproximado ?? 0)
      ? precoPromocional
      : precoAproximado;
    const estado: EstadoProdutoCarrinho = {
      produto_id: item.produto_id,
      vendedor_id: item.vendedor_id,
      disponivel: produto.disponivel === true && elegiveis.get(item.vendedor_id) === true,
      preco_retalho_centimos: paraCentimos(precoRetalho),
      preco_grosso_centimos: precoGrosso === null ? null : paraCentimos(precoGrosso),
    };
    return { ...item, ...estado, atualizado_em: new Date().toISOString() };
  });
}

export async function obterLocaisLevantamento(vendedorIds: string[]): Promise<Map<string, LocalLevantamentoVendedor>> {
  if (vendedorIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('vendedores')
    .select('id, nome_comercial, provincia, municipio, bairro, mercado_bairro, endereco_detalhado')
    .in('id', [...new Set(vendedorIds)]);
  if (error) throw error;
  return new Map((data ?? []).map((vendedor) => [vendedor.id, {
    vendedor_id: vendedor.id,
    nome_comercial: vendedor.nome_comercial,
    provincia: vendedor.provincia,
    municipio: vendedor.municipio,
    bairro: vendedor.bairro,
    endereco_detalhado: vendedor.endereco_detalhado,
    ponto_referencia: vendedor.mercado_bairro,
  }]));
}
