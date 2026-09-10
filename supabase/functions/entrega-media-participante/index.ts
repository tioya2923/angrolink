import { createClient } from 'npm:@supabase/supabase-js@2';

const TTL = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ESTADOS = new Set(['aceite', 'chegou_origem', 'recolhida', 'chegou_destino', 'concluida']);
type Recurso = 'foto_entregador' | 'foto_veiculo_entregador';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const resposta = (status: number, corpo: Record<string, string | number>) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
function caminhoSeguro(valor: string | null) { if (!valor) return null; if (!/^https?:\/\//i.test(valor)) return valor.replace(/^\/+/, ''); try { const url = new URL(valor); return url.pathname.match(/\/object\/(?:public|sign|authenticated)\/documentos-parceiros\/(.+)$/)?.[1] ?? null; } catch { return null; } }

Deno.serve(async (pedido) => {
  if (pedido.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (pedido.method !== 'POST') return resposta(405, { erro: 'Método não permitido.' });
  const jwt = pedido.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  const url = Deno.env.get('SUPABASE_URL'), anon = Deno.env.get('SUPABASE_ANON_KEY'), serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!jwt) return resposta(401, { erro: 'Sessão inválida.' });
  if (!url || !anon || !serviceRole) return resposta(500, { erro: 'Serviço indisponível.' });
  const autenticacao = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data: auth } = await autenticacao.auth.getUser(jwt); if (!auth.user) return resposta(401, { erro: 'Sessão inválida.' });
  let corpo: { encomenda_id?: unknown; recurso?: unknown }; try { corpo = await pedido.json(); } catch { return resposta(400, { erro: 'Pedido inválido.' }); }
  if (typeof corpo.encomenda_id !== 'string' || !UUID.test(corpo.encomenda_id) || (corpo.recurso !== 'foto_entregador' && corpo.recurso !== 'foto_veiculo_entregador')) return resposta(400, { erro: 'Recurso inválido.' });
  const admin = createClient(url, serviceRole);
  const { data: encomenda } = await admin.from('encomendas').select('id,cliente_id,vendedor_id,modalidade_recebimento').eq('id', corpo.encomenda_id).maybeSingle();
  if (!encomenda || encomenda.modalidade_recebimento !== 'entrega') return resposta(404, { erro: 'Entrega não encontrada.' });
  const { data: vendedor } = await admin.from('vendedores').select('id').eq('id', encomenda.vendedor_id).eq('user_id', auth.user.id).maybeSingle();
  if (encomenda.cliente_id !== auth.user.id && !vendedor) return resposta(403, { erro: 'Sem permissão para esta media.' });
  const { data: atribuicao } = await admin.from('atribuicoes_entrega_encomenda').select('estado,parceiro_entrega_id,veiculo_id').eq('encomenda_id', encomenda.id).order('atribuido_em', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
  if (!atribuicao || !ESTADOS.has(atribuicao.estado)) return resposta(403, { erro: 'A identidade do entregador ainda não está disponível.' });
  const recurso = corpo.recurso as Recurso, coluna = recurso === 'foto_entregador' ? 'foto_perfil_url' : 'foto_veiculo_path', tabela = recurso === 'foto_entregador' ? 'parceiros_entrega' : 'veiculos_entrega', id = recurso === 'foto_entregador' ? atribuicao.parceiro_entrega_id : atribuicao.veiculo_id;
  const { data: media } = await admin.from(tabela).select(coluna).eq('id', id).maybeSingle();
  const caminho = caminhoSeguro((media as Record<string, string | null> | null)?.[coluna] ?? null);
  if (!caminho) return resposta(404, { erro: 'Media indisponível.' });
  const { data: assinada, error } = await admin.storage.from('documentos-parceiros').createSignedUrl(caminho, TTL);
  if (error || !assinada?.signedUrl) return resposta(500, { erro: 'Não foi possível preparar a media.' });
  return resposta(200, { url: assinada.signedUrl, expires_in: TTL });
});
