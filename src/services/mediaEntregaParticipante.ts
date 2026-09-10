import { supabase } from '@/services/supabase';

type RecursoMediaEntrega = 'foto_entregador' | 'foto_veiculo_entregador';
type RespostaMedia = { url: string };

export async function obterMediaEntregaParticipante(encomendaId: string, recurso: RecursoMediaEntrega): Promise<string> {
  const { data, error } = await supabase.functions.invoke<RespostaMedia>('entrega-media-participante', { body: { encomenda_id: encomendaId, recurso } });
  if (error || !data?.url) throw new Error('Não foi possível carregar a fotografia.');
  return data.url;
}
