import { supabase } from '@/services/supabase';

type RespostaFoto = { url: string; expires_in: number };
const cache = new Map<string, RespostaFoto>();
type RecursoDocumento = 'documento_entregador_frente' | 'documento_entregador_verso';

export async function obterFotoVeiculoEntregadorAdmin(veiculoId: string): Promise<string> {
  const chave = `foto_veiculo_entregador:${veiculoId}`;
  const existente = cache.get(chave);
  if (existente) return existente.url;

  const { data, error } = await supabase.functions.invoke<RespostaFoto>(
    'admin-media-privada',
    { body: { recurso: 'foto_veiculo_entregador', entidade_id: veiculoId } },
  );
  if (error || !data?.url) {
    throw new Error('Não foi possível carregar a fotografia do veículo.');
  }
  cache.set(chave, data);
  return data.url;
}

export async function obterFotoEntregadorAdmin(parceiroId: string): Promise<string> {
  const existente = cache.get(parceiroId);
  if (existente) return existente.url;
  const { data, error } = await supabase.functions.invoke<RespostaFoto>('admin-media-privada', { body: { recurso: 'foto_entregador', entidade_id: parceiroId } });
  if (error || !data?.url) throw new Error('Não foi possível carregar a fotografia.');
  cache.set(parceiroId, data);
  return data.url;
}

export async function obterDocumentoEntregadorAdmin(versaoId: string, recurso: RecursoDocumento): Promise<string> {
  const { data, error } = await supabase.functions.invoke<RespostaFoto>('admin-media-privada', { body: { recurso, entidade_id: versaoId } });
  if (error || !data?.url) throw new Error('Não foi possível abrir o documento.');
  return data.url;
}
