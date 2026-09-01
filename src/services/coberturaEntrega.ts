import { supabase } from '@/services/supabase';

export type AreaCoberturaEntrega = { id: string; provincia: string; municipio: string; bairro: string | null; ativo: boolean; criado_em: string };

type Resposta<T> = Promise<{ data: T | null; error: { message: string } | null }>;
type RpcCobertura =
  & ((nome: 'criar_area_cobertura_entrega', args: { p_provincia: string; p_municipio: string; p_bairro?: string | null }) => Resposta<AreaCoberturaEntrega>)
  & ((nome: 'atualizar_area_cobertura_entrega', args: { p_area_id: string; p_provincia: string; p_municipio: string; p_bairro?: string | null; p_ativo?: boolean }) => Resposta<AreaCoberturaEntrega>)
  & ((nome: 'remover_area_cobertura_entrega', args: { p_area_id: string }) => Resposta<null>);

const rpc = supabase.rpc.bind(supabase) as unknown as RpcCobertura;

export async function criarAreaCobertura(dados: Omit<AreaCoberturaEntrega, 'id' | 'ativo' | 'criado_em'>) {
  const { data, error } = await rpc('criar_area_cobertura_entrega', { p_provincia: dados.provincia, p_municipio: dados.municipio, p_bairro: dados.bairro });
  if (error || !data) throw new Error(error?.message || 'Não foi possível criar a área.');
  return data;
}
export async function atualizarAreaCobertura(id: string, dados: Omit<AreaCoberturaEntrega, 'id' | 'criado_em'>) {
  const { data, error } = await rpc('atualizar_area_cobertura_entrega', { p_area_id: id, p_provincia: dados.provincia, p_municipio: dados.municipio, p_bairro: dados.bairro, p_ativo: dados.ativo });
  if (error || !data) throw new Error(error?.message || 'Não foi possível atualizar a área.');
  return data;
}
export async function removerAreaCobertura(id: string) { const { error } = await rpc('remover_area_cobertura_entrega', { p_area_id: id }); if (error) throw new Error(error.message); }
