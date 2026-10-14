import { supabase } from '@/services/supabase';

export type DestaqueEditorialAdmin = {
  id: string;
  produtoId: string;
  posicao: number;
  inicioEm: string;
  fimEm: string;
  revogadoEm: string | null;
};

export type EstadoDestaqueEditorial = 'ativo' | 'expirado' | 'revogado';

/** Estado de apresentação administrativo; a validade pública continua no servidor. */
export function obterEstadoDestaqueEditorial(
  item: DestaqueEditorialAdmin,
  agora = Date.now(),
): EstadoDestaqueEditorial {
  if (item.revogadoEm) return 'revogado';
  return new Date(item.fimEm).getTime() <= agora ? 'expirado' : 'ativo';
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.length > 0 ? valor : null;
}

function destaque(valor: unknown): DestaqueEditorialAdmin | null {
  if (!valor || typeof valor !== 'object') return null;
  const item = valor as Record<string, unknown>;
  const id = texto(item.id);
  const produtoId = texto(item.produto_id);
  const inicioEm = texto(item.inicio_em);
  const fimEm = texto(item.fim_em);
  const posicao = typeof item.posicao === 'number' ? item.posicao : Number(item.posicao);
  if (!id || !produtoId || !inicioEm || !fimEm || !Number.isInteger(posicao)) return null;
  return { id, produtoId, posicao, inicioEm, fimEm, revogadoEm: texto(item.revogado_em) };
}

function erroPadrao(erro: { message: string } | null, fallback: string): Error {
  return new Error(erro?.message || fallback);
}

export async function criarDestaqueProdutoEditorialAdmin(produtoId: string): Promise<DestaqueEditorialAdmin> {
  const { data, error } = await supabase.rpc('criar_destaque_produto_editorial_admin', { p_produto_id: produtoId });
  if (error) throw erroPadrao(error, 'Não foi possível criar o destaque editorial.');
  const resultado = destaque(data);
  if (!resultado) throw new Error('A resposta do destaque editorial é inválida.');
  return resultado;
}

export async function revogarDestaqueProdutoEditorialAdmin(
  destaqueId: string,
  motivoInterno?: string,
): Promise<DestaqueEditorialAdmin> {
  const { data, error } = await supabase.rpc('revogar_destaque_produto_editorial_admin', {
    p_destaque_id: destaqueId,
    p_motivo_interno: motivoInterno?.trim() || null,
  });
  if (error) throw erroPadrao(error, 'Não foi possível revogar o destaque editorial.');
  const resultado = destaque(data);
  if (!resultado) throw new Error('A resposta do destaque editorial é inválida.');
  return resultado;
}

export async function listarDestaquesProdutosEditoriaisAdmin(): Promise<DestaqueEditorialAdmin[]> {
  const { data, error } = await supabase.rpc('listar_destaques_produtos_editoriais_admin');
  if (error) throw erroPadrao(error, 'Não foi possível carregar os destaques editoriais.');
  return Array.isArray(data)
    ? data.map(destaque).filter((item): item is DestaqueEditorialAdmin => item !== null)
    : [];
}
