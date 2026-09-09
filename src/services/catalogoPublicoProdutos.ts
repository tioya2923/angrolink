import { supabase } from '@/services/supabase';

export interface FiltrosProdutosPublicosFase1 {
  produtoId?: string;
  produtoIds?: string[];
  vendedorId?: string;
  categoriaId?: string;
  categoriaIds?: string[];
  provincia?: string;
  municipio?: string;
  localizacaoOu?: boolean;
  pesquisa?: string;
  excluirProdutoId?: string;
  ordenarPorDestaque?: boolean;
  limite?: number;
}

type ResultadoRpc = { data: unknown; error: { message: string } | null };
type RpcCatalogoPublico = {
  (
    nome: 'listar_produtos_publicos_fase1',
    args: {
      p_produto_id: string | null;
      p_produto_ids: string[] | null;
      p_vendedor_id: string | null;
      p_categoria_id: string | null;
      p_categoria_ids: string[] | null;
      p_provincia: string | null;
      p_municipio: string | null;
      p_localizacao_ou: boolean;
      p_pesquisa: string | null;
      p_excluir_produto_id: string | null;
      p_ordenar_por_destaque: boolean;
      p_limite: number;
    },
  ): Promise<ResultadoRpc>;
};

// A migration local pendente ainda nÃ£o estÃ¡ em database.types.ts. Este Ã© o
// Ãºnico adapter temporÃ¡rio para o contrato pÃºblico de catÃ¡logo; ele deixa a
// assinatura explÃ­cita sem alargar o acesso directo Ã  tabela produtos.
const rpcCatalogoPublico = supabase.rpc.bind(supabase) as unknown as RpcCatalogoPublico;

function linhas(data: unknown): Record<string, unknown>[] {
  return Array.isArray(data)
    ? data.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    : [];
}

export async function listarProdutosPublicosFase1(
  filtros: FiltrosProdutosPublicosFase1 = {},
): Promise<Record<string, unknown>[]> {
  const { data, error } = await rpcCatalogoPublico('listar_produtos_publicos_fase1', {
    p_produto_id: filtros.produtoId ?? null,
    p_produto_ids: filtros.produtoIds?.length ? filtros.produtoIds : null,
    p_vendedor_id: filtros.vendedorId ?? null,
    p_categoria_id: filtros.categoriaId ?? null,
    p_categoria_ids: filtros.categoriaIds?.length ? filtros.categoriaIds : null,
    p_provincia: filtros.provincia ?? null,
    p_municipio: filtros.municipio ?? null,
    p_localizacao_ou: filtros.localizacaoOu === true,
    p_pesquisa: filtros.pesquisa ?? null,
    p_excluir_produto_id: filtros.excluirProdutoId ?? null,
    p_ordenar_por_destaque: filtros.ordenarPorDestaque === true,
    p_limite: filtros.limite ?? 100,
  });

  if (error) throw new Error('NÃ£o foi possÃ­vel carregar os produtos pÃºblicos.');
  return linhas(data);
}
