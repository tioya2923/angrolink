import { useQuery } from '@tanstack/react-query';
import {
  fetchCategorias,
  fetchProdutos,
  fetchServicos,
  fetchSugestoesPesquisa,
  type SugestaoPesquisa,
} from '@/services/api';

export const catalogoQueryKeys = {
  categorias: ['categorias'] as const,
  produtos: (params?: Parameters<typeof fetchProdutos>[0]) => ['produtos', params ?? {}] as const,
  servicos: ['servicos'] as const,
  sugestoes: (termo: string) => ['sugestoes-pesquisa', termo] as const,
};

export function useProdutosQuery(params?: Parameters<typeof fetchProdutos>[0]) {
  return useQuery({
    queryKey: catalogoQueryKeys.produtos(params),
    queryFn: () => fetchProdutos(params),
  });
}

export function useServicosQuery() {
  return useQuery({ queryKey: catalogoQueryKeys.servicos, queryFn: fetchServicos });
}

export function useCategoriasQuery() {
  return useQuery({ queryKey: catalogoQueryKeys.categorias, queryFn: fetchCategorias });
}

export function useSugestoesPesquisaQuery(termo: string, enabled: boolean) {
  return useQuery<SugestaoPesquisa[]>({
    queryKey: catalogoQueryKeys.sugestoes(termo),
    queryFn: () => fetchSugestoesPesquisa(termo),
    enabled,
    staleTime: 30_000,
  });
}
