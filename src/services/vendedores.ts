/**
 * Projeção segura da tabela de vendedores.
 *
 * A coluna `documentos` contém dados sensíveis e nunca deve fazer parte de
 * leituras normais do perfil comercial, mesmo para administradores. Os
 * documentos são consultados pela camada dedicada de documentos.
 */
export const COLUNAS_VENDEDOR_PUBLICAS = [
  'id',
  'nome_comercial',
  'descricao',
  'telefone_whatsapp',
  'whatsapp',
  'provincia',
  'municipio',
  'bairro',
  'mercado_bairro',
  'endereco_detalhado',
  'tipo_vendedor',
  'verificado',
  'foto_perfil',
  'ano_inicio',
  'data_inicio_atividade',
  'horario_atendimento',
  'entrega_disponivel',
  'tipo_producao',
  'area_cultivada',
  'principais_culturas',
  'producao_mensal',
  'venda_grosso',
  'venda_retalho',
  'tipos_produtos',
  'compra_produtores',
  'volume_minimo',
  'entrega_outras_provincias',
  'tipo_loja',
  'mercado_localizado',
  'venda_presencial',
  'criado_em',
].join(', ');

export async function listarVendedoresPublicos(
  vendedorIds: readonly string[],
): Promise<Vendedor[]> {
  const idsUnicos = [...new Set(vendedorIds.filter(Boolean))];
  if (idsUnicos.length === 0) return [];

  const { data, error } = await supabase.rpc(
    'listar_vendedores_publicos',
    { p_vendedor_ids: idsUnicos },
  );

  if (error) {
    throw new Error('Não foi possível carregar os vendedores públicos.');
  }

  return (data ?? []) as unknown as Vendedor[];
}

export const COLUNAS_VENDEDOR_PROPRIO = [
  COLUNAS_VENDEDOR_PUBLICAS,
  'user_id', 'nome_responsavel', 'email', 'indicativo_telefone',
  'telefone_nacional', 'status_aprovacao', 'motivo_rejeicao', 'conta_ativa',
  'pode_destacar', 'plano', 'aprovado_em', 'criado_em', 'atualizado_em',
].join(', ');

export const COLUNAS_VENDEDOR_ADMIN = COLUNAS_VENDEDOR_PROPRIO;
import type { Vendedor } from '@/tipos';
import { supabase } from './supabase';
