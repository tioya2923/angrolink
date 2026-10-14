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

export type ProdutoDestaqueEditorialPublico = Record<string, unknown>;

function linhas(data: unknown): Record<string, unknown>[] {
  return Array.isArray(data)
    ? data.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    : [];
}

export async function listarProdutosPublicosFase1(
  filtros: FiltrosProdutosPublicosFase1 = {},
): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase.rpc('listar_produtos_publicos_fase1', {
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

  if (error) throw new Error('Não foi possível carregar os produtos públicos.');
  return linhas(data);
}

export async function listarDestaquesProdutosEditoriaisPublicos(
  limite = 8,
): Promise<ProdutoDestaqueEditorialPublico[]> {
  const { data, error } = await supabase.rpc(
    'listar_destaques_produtos_editoriais_publicos',
    { p_limite: Math.min(Math.max(limite, 1), 8) },
  );

  if (error) throw new Error('Não foi possível carregar os produtos em destaque.');
  return linhas(data);
}
