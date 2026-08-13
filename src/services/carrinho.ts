import type { ItemCarrinho } from '@/dominio/carrinho';
import { consultarElegibilidadeVendedor } from '@/services/elegibilidadeVendedor';
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

export async function atualizarEstadoItensCarrinho(itens: ItemCarrinho[]): Promise<ItemCarrinho[]> {
  if (itens.length === 0) return [];
  const ids = itens.map((item) => item.produto_id);
  const { data, error } = await supabase
    .from('produtos')
    .select('id, vendedor_id, disponivel, publicado, preco_aproximado, preco_promocional, preco_grosso')
    .in('id', ids);

  if (error) throw error;
  const produtos = new Map((data ?? []).map((produto) => [produto.id, produto]));
  const vendedores = [...new Set((data ?? []).map((produto) => produto.vendedor_id).filter((id): id is string => Boolean(id)))];
  const elegiveis = new Map(await Promise.all(vendedores.map(async (vendedorId) => [vendedorId, await consultarElegibilidadeVendedor(vendedorId)] as const)));

  return itens.map((item) => {
    const produto = produtos.get(item.produto_id);
    if (!produto || produto.vendedor_id !== item.vendedor_id) return { ...item, disponivel: false };
    const precoRetalho = produto.preco_promocional !== null && produto.preco_promocional > 0 && produto.preco_promocional < (produto.preco_aproximado ?? 0)
      ? produto.preco_promocional
      : produto.preco_aproximado;
    const estado: EstadoProdutoCarrinho = {
      produto_id: item.produto_id,
      vendedor_id: item.vendedor_id,
      disponivel: produto.disponivel === true && produto.publicado === true && elegiveis.get(item.vendedor_id) === true,
      preco_retalho_centimos: paraCentimos(precoRetalho),
      preco_grosso_centimos: produto.preco_grosso === null ? null : paraCentimos(produto.preco_grosso),
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
