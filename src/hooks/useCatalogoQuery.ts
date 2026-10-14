import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchCategorias,
  fetchDestaquesProdutosEditoriais,
  fetchProdutos,
  fetchServicos,
  fetchSugestoesPesquisa,
  type SugestaoPesquisa,
} from '@/services/api';

export const catalogoQueryKeys = {
  categorias: ['categorias'] as const,
  produtos: (params?: Parameters<typeof fetchProdutos>[0]) => ['produtos', params ?? {}] as const,
  destaquesEditoriais: ['destaques-editoriais-produtos'] as const,
  servicos: ['servicos'] as const,
  sugestoes: (termo: string) => ['sugestoes-pesquisa', termo] as const,
};

type ItemComFimDestaque = { destaque_fim_em?: string | null };

/**
 * Revalida consumidores públicos que ainda carregam o catálogo fora do
 * React Query. Cobre expiração, novas seleções e revogações em páginas
 * abertas, inclusive quando a lista inicialmente está vazia.
 */
export function useAtualizacaoCatalogoPublico(itens: readonly ItemComFimDestaque[]) {
  const [revisao, setRevisao] = useState(0);
  const fimMaisProximo = useMemo(() => itens
    .map((item) => item.destaque_fim_em)
    .filter((fim): fim is string => typeof fim === 'string')
    .map((fim) => new Date(fim).getTime())
    .filter((fim) => fim > Date.now())
    .sort((a, b) => a - b)[0] ?? null, [itens]);

  useEffect(() => {
    const atualizar = () => setRevisao((atual) => atual + 1);
    const intervalo = window.setInterval(atualizar, 60_000);
    const esperaExpiracao = fimMaisProximo === null
      ? null
      : window.setTimeout(atualizar, Math.max(0, fimMaisProximo - Date.now()) + 50);

    window.addEventListener('focus', atualizar);
    window.addEventListener('online', atualizar);
    return () => {
      window.clearInterval(intervalo);
      if (esperaExpiracao !== null) window.clearTimeout(esperaExpiracao);
      window.removeEventListener('focus', atualizar);
      window.removeEventListener('online', atualizar);
    };
  }, [fimMaisProximo]);

  return revisao;
}

export function useProdutosQuery(params?: Parameters<typeof fetchProdutos>[0]) {
  return useQuery({
    queryKey: catalogoQueryKeys.produtos(params),
    queryFn: () => fetchProdutos(params),
  });
}

export function useDestaquesProdutosEditoriaisQuery() {
  return useQuery({
    queryKey: catalogoQueryKeys.destaquesEditoriais,
    queryFn: fetchDestaquesProdutosEditoriais,
    // A lista pode ficar vazia ou mudar por uma decisão editorial feita
    // noutra sessão. Foco/reconexão recuperam logo; a renovação limitada
    // mantém páginas abertas atualizadas sem expor a tabela privada.
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 60_000,
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
