import { createClient } from 'npm:@supabase/supabase-js@2';

const TTL_SEGUNDOS = 600;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function headersCors(origem?: string): HeadersInit {
  return origem
    ? {
        'Access-Control-Allow-Origin': origem,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
      }
    : {};
}

function resposta(status: number, corpo: Record<string, string | number>, origem?: string) {
  return new Response(status === 204 ? null : JSON.stringify(corpo), {
    status,
    headers: { ...(status === 204 ? {} : { 'Content-Type': 'application/json' }), ...headersCors(origem) },
  });
}

function normalizarCaminhoDocumento(caminho: string): string | null {
  const valor = caminho.trim();
  if (!valor) return null;
  if (!/^https?:\/\//i.test(valor)) return valor.replace(/^\/+/, '');

  try {
    const url = new URL(valor);
    const correspondencia = url.pathname.match(/\/object\/(?:public|sign|authenticated)\/documentos-parceiros\/(.+)$/);
    return correspondencia?.[1] ? decodeURIComponent(correspondencia[1]) : null;
  } catch {
    return null;
  }
}

Deno.serve(async (pedido) => {
  const origem = pedido.headers.get('Origin') ?? undefined;
  const origens = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((valor) => valor.trim()).filter(Boolean);
  if (pedido.method === 'OPTIONS') return origens.includes(origem ?? '') ? resposta(204, {}, origem) : resposta(403, { erro: 'Origem não permitida.' });
  if (pedido.method !== 'POST') return resposta(405, { erro: 'Método não permitido.' }, origem);
  if (origem && !origens.includes(origem)) return resposta(403, { erro: 'Origem não permitida.' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const jwt = pedido.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!jwt) return resposta(401, { erro: 'Sessão inválida.' }, origem);

  const autenticacao = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data: utilizadorData } = await autenticacao.auth.getUser(jwt);
  if (!utilizadorData.user) return resposta(401, { erro: 'Sessão inválida.' }, origem);

  let corpo: { recurso?: unknown; entidade_id?: unknown };
  try { corpo = await pedido.json(); } catch { return resposta(400, { erro: 'Pedido inválido.' }, origem); }
  const recursoValido = corpo.recurso === 'foto_entregador' || corpo.recurso === 'foto_veiculo_entregador' || corpo.recurso === 'documento_entregador_frente' || corpo.recurso === 'documento_entregador_verso';
  if (!recursoValido || typeof corpo.entidade_id !== 'string' || !UUID.test(corpo.entidade_id)) return resposta(400, { erro: 'Recurso ou entidade inválidos.' }, origem);

  const admin = createClient(url, serviceRole);
  const { data: administrador, error: erroAdministrador } = await admin.from('administradores').select('user_id').eq('user_id', utilizadorData.user.id).maybeSingle();
  if (erroAdministrador) return resposta(500, { erro: 'Não foi possível validar a autorização.', codigo: 'AUTORIZACAO_INDISPONIVEL' }, origem);
  if (!administrador) return resposta(403, { erro: 'Sem permissão administrativa.' }, origem);

  let caminho: string | null = null;
  if (corpo.recurso === 'foto_entregador') {
    const { data: parceiro, error: erroParceiro } = await admin.from('parceiros_entrega').select('foto_perfil_url').eq('id', corpo.entidade_id).maybeSingle();
    if (erroParceiro) return resposta(500, { erro: 'Não foi possível localizar o entregador.', codigo: 'ENTREGADOR_INDISPONIVEL' }, origem);
    if (!parceiro) return resposta(404, { erro: 'Entregador não encontrado.' }, origem);
    caminho = parceiro.foto_perfil_url;
  } else if (corpo.recurso === 'foto_veiculo_entregador') {
    const { data: veiculo, error: erroVeiculo } = await admin
      .from('veiculos_entrega')
      .select('foto_veiculo_path')
      .eq('id', corpo.entidade_id)
      .maybeSingle();
    if (erroVeiculo) return resposta(500, { erro: 'Não foi possível localizar o veículo.', codigo: 'VEICULO_INDISPONIVEL' }, origem);
    if (!veiculo) return resposta(404, { erro: 'Veículo não encontrado.' }, origem);
    caminho = veiculo.foto_veiculo_path;
  } else {
    const frente = corpo.recurso === 'documento_entregador_frente';
    if (frente) {
      const { data: versao, error: erroVersao } = await admin.from('versoes_documento_parceiro_entrega').select('frente_path').eq('id', corpo.entidade_id).maybeSingle();
      if (erroVersao) return resposta(500, { erro: 'Não foi possível localizar a versão documental.', codigo: 'VERSAO_INDISPONIVEL' }, origem);
      if (!versao) return resposta(404, { erro: 'Versão documental não encontrada.' }, origem);
      caminho = versao.frente_path;
    } else {
      const { data: versao, error: erroVersao } = await admin.from('versoes_documento_parceiro_entrega').select('verso_path').eq('id', corpo.entidade_id).maybeSingle();
      if (erroVersao) return resposta(500, { erro: 'Não foi possível localizar a versão documental.', codigo: 'VERSAO_INDISPONIVEL' }, origem);
      if (!versao) return resposta(404, { erro: 'Versão documental não encontrada.' }, origem);
      caminho = versao.verso_path;
    }
  }
  if (!caminho) return resposta(404, { erro: 'Ficheiro não disponível.', codigo: 'LADO_INDISPONIVEL' }, origem);

  const caminhoStorage = normalizarCaminhoDocumento(caminho);
  if (!caminhoStorage) return resposta(422, { erro: 'Ficheiro com formato inválido.', codigo: 'CAMINHO_INVALIDO' }, origem);
  const { data: assinada, error } = await admin.storage.from('documentos-parceiros').createSignedUrl(caminhoStorage, TTL_SEGUNDOS);
  if (error || !assinada?.signedUrl) {
    console.error(JSON.stringify({ recurso: corpo.recurso, entidade_id: corpo.entidade_id, etapa: 'criar_signed_url', erro: error ? 'storage_create_signed_url_failed' : 'signed_url_ausente' }));
    return resposta(500, { erro: 'Não foi possível preparar o ficheiro.', codigo: 'ASSINATURA_INDISPONIVEL' }, origem);
  }
  return resposta(200, { url: assinada.signedUrl, expires_in: TTL_SEGUNDOS }, origem);
});
