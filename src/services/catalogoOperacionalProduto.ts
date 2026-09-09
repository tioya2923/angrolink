import { supabase } from '@/services/supabase';
import { listarProvinciasAngola } from '@/services/territorioAngola';

export type EstadoOperacionalCatalogo = 'ativa' | 'experimental';

export interface CategoriaProdutoOperacional {
  id: string;
  nome: string;
  estado: EstadoOperacionalCatalogo;
  requerRevisaoAdmin: boolean;
  avisoVisual: string | null;
}

export interface SubcategoriaProdutoOperacional {
  id: string;
  categoriaId: string;
  nome: string;
  slug: string;
  ordemExibicao: number;
  estado: EstadoOperacionalCatalogo;
  requerRevisaoAdmin: boolean;
  avisoVisual: string | null;
}

type ResultadoRpc = { data: unknown; error: { message: string } | null };
type RpcCatalogoOperacional = {
  (nome: 'listar_categorias_produto_operacionais', args: { p_provincia_id: string }): Promise<ResultadoRpc>;
  (nome: 'listar_subcategorias_produto_operacionais', args: { p_provincia_id: string; p_categoria_id: string }): Promise<ResultadoRpc>;
};

// Os tipos gerados ainda não incluem a migration local pendente. Este adapter
// temporário mantém a superfície da RPC explícita sem editar database.types.ts.
const rpcCatalogoOperacional = supabase.rpc.bind(supabase) as unknown as RpcCatalogoOperacional;

let provinciaHuamboEmMemoria: string | null = null;

function linhas(data: unknown): Record<string, unknown>[] {
  return Array.isArray(data) ? data.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object') : [];
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

function estado(valor: unknown): EstadoOperacionalCatalogo | null {
  if (valor === 'ativa' || valor === 'experimental') return valor;
  return null;
}

export async function obterProvinciaOperacionalHuamboId(): Promise<string> {
  if (provinciaHuamboEmMemoria) return provinciaHuamboEmMemoria;

  const provincias = await listarProvinciasAngola();
  const huambo = provincias.find(provincia => provincia.codigoOficial === 'HBO');
  if (!huambo) throw new Error('Não foi possível identificar a província operacional do Huambo.');

  provinciaHuamboEmMemoria = huambo.id;
  return huambo.id;
}

export async function fetchCategoriasProdutoOperacionais(): Promise<CategoriaProdutoOperacional[]> {
  const provinciaId = await obterProvinciaOperacionalHuamboId();
  const { data, error } = await rpcCatalogoOperacional('listar_categorias_produto_operacionais', {
    p_provincia_id: provinciaId,
  });
  if (error) throw new Error('Não foi possível carregar as categorias de produto disponíveis.');

  return linhas(data)
    .map(item => {
      const estadoOperacional = estado(item.estado);

      if (!estadoOperacional) return null;

      return {
        id: texto(item.categoria_id),
        nome: texto(item.nome),
        estado: estadoOperacional,
        requerRevisaoAdmin: item.requer_revisao_admin === true,
        avisoVisual:
          typeof item.aviso_visual === 'string'
            ? item.aviso_visual
            : null,
      };
    })
    .filter(
      (item): item is CategoriaProdutoOperacional =>
        !!item && !!item.id && !!item.nome,
    );
}

export async function fetchSubcategoriasProdutoOperacionais(categoriaId: string): Promise<SubcategoriaProdutoOperacional[]> {
  const provinciaId = await obterProvinciaOperacionalHuamboId();
  const { data, error } = await rpcCatalogoOperacional('listar_subcategorias_produto_operacionais', {
    p_provincia_id: provinciaId,
    p_categoria_id: categoriaId,
  });
  if (error) throw new Error('Não foi possível carregar as subcategorias de produto disponíveis.');

  return linhas(data)
    .map(item => {
      const estadoOperacional = estado(item.estado);

      if (!estadoOperacional) return null;

      return {
        id: texto(item.subcategoria_id),
        categoriaId: texto(item.categoria_id),
        nome: texto(item.nome),
        slug: texto(item.slug),
        ordemExibicao:
          typeof item.ordem_exibicao === 'number'
            ? item.ordem_exibicao
            : 0,
        estado: estadoOperacional,
        requerRevisaoAdmin: item.requer_revisao_admin === true,
        avisoVisual:
          typeof item.aviso_visual === 'string'
            ? item.aviso_visual
            : null,
      };
    })
    .filter(
      (item): item is SubcategoriaProdutoOperacional =>
        !!item &&
        !!item.id &&
        !!item.categoriaId &&
        !!item.nome,
    );
}
