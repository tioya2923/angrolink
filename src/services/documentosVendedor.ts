import { supabase } from './supabase';
import type { Database } from '@/types/database.types';

export const BUCKET_DOCUMENTOS_VENDEDORES = 'documentos-vendedores';

export type TipoDocumentoVendedor =
  | 'bi'
  | 'nif'
  | 'alvara'
  | 'registo_comercial'
  | 'cartao_vendedor'
  | 'comprovativo_banca'
  | 'carta_conducao'
  | 'certificado_moto_taxi'
  | 'livrete_veiculo'
  | 'seguro_automovel'
  | 'titulo_terra';

export type EstadoDocumentoVendedor =
  | 'pendente'
  | 'em_analise'
  | 'aprovado'
  | 'rejeitado'
  | 'expirado';

export type TipoRejeicaoCandidatura = 'documental' | 'nao_documental';

type DocumentoVendedorBase = Database['public']['Tables']['documentos_vendedor']['Row'];
type DocumentoVendedorInsertBase = Database['public']['Tables']['documentos_vendedor']['Insert'];

export interface DocumentoVendedor extends Omit<DocumentoVendedorBase, 'tipo_documento' | 'estado' | 'dados_adicionais'> {
  id: string;
  vendedor_id: string;
  tipo_documento: TipoDocumentoVendedor;
  frente_path: string;
  verso_path: string | null;
  numero_documento: string | null;
  validade: string | null;
  dados_adicionais: Record<string, string>;
  estado: EstadoDocumentoVendedor;
  motivo_rejeicao: string | null;
  analisado_por: string | null;
  analisado_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

/**
 * A rejeição da candidatura é independente da análise de cada documento.
 * Esta validação impede que a equipa indique uma causa documental sem antes
 * assinalar, de forma auditável, os documentos que precisam de correção.
 */
export function validarRejeicaoCandidaturaVendedor(
  tipo: TipoRejeicaoCandidatura | null,
  motivo: string,
  documentos: Pick<DocumentoVendedor, 'estado'>[],
) {
  if (!tipo) return 'Indique se o motivo da rejeição é documental ou não documental.';
  if (!motivo.trim()) return 'Indique um motivo claro para o vendedor.';
  if (tipo === 'documental' && !documentos.some(documento => documento.estado === 'rejeitado')) {
    return 'Indique primeiro quais documentos precisam de correção.';
  }
  return null;
}

export function documentoVendedorPodeSerReenviado(estado: EstadoDocumentoVendedor) {
  return estado === 'rejeitado';
}

export function documentoVendedorPodeSerAnalisado(estado: EstadoDocumentoVendedor) {
  return estado === 'pendente' || estado === 'em_analise';
}

type DocumentoVendedorInsert = DocumentoVendedorInsertBase;

function normalizarDocumentoVendedor(documento: DocumentoVendedorBase): DocumentoVendedor {
  return {
    ...documento,
    tipo_documento: documento.tipo_documento as TipoDocumentoVendedor,
    estado: documento.estado as EstadoDocumentoVendedor,
    dados_adicionais: (documento.dados_adicionais && typeof documento.dados_adicionais === 'object' && !Array.isArray(documento.dados_adicionais)
      ? documento.dados_adicionais
      : {}) as Record<string, string>,
  };
}

export interface DocumentoVendedorParaSubmissao {
  tipo_documento: TipoDocumentoVendedor;
  valores: Record<string, string>;
  frente: File;
  verso?: File | null;
}

/**
 * Valida o lote completo antes de iniciar qualquer upload. Isto evita uma
 * candidatura aparentemente concluída com documentos obrigatórios ausentes
 * ou repetidos.
 */
export function validarDocumentosParaSubmissao(documentos: DocumentoVendedorParaSubmissao[]) {
  if (documentos.length === 0) {
    throw new Error('Envie pelo menos um documento antes de concluir o cadastro.');
  }

  const tipos = new Set<string>();
  for (const documento of documentos) {
    if (tipos.has(documento.tipo_documento)) {
      throw new Error('Cada tipo de documento só pode ser enviado uma vez.');
    }
    tipos.add(documento.tipo_documento);

    if (!documento.frente || !documento.verso) {
      throw new Error('Envie a foto da frente e do verso de cada documento.');
    }

    validarImagemDocumentoVendedor(documento.frente);
    validarImagemDocumentoVendedor(documento.verso);
  }
}

export function validarImagemDocumentoVendedor(ficheiro: Pick<File, 'type' | 'size'>) {
  const formatos = ['image/jpeg', 'image/png', 'image/webp'];
  if (!formatos.includes(ficheiro.type)) {
    throw new Error('Os documentos devem ser imagens JPG, PNG ou WEBP.');
  }
  if (ficheiro.size > 3 * 1024 * 1024) {
    throw new Error('Cada imagem de documento deve ter no máximo 3 MB.');
  }
}

function extensaoSegura(ficheiro: File) {
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[ficheiro.type] || 'jpg';
}

export function criarCaminhoDocumentoVendedor(
  utilizadorId: string,
  vendedorId: string,
  tipoDocumento: TipoDocumentoVendedor,
  lado: 'frente' | 'verso',
  extensao: string,
  identificador: string = crypto.randomUUID(),
) {
  return `${utilizadorId}/${vendedorId}/${tipoDocumento}-${lado}-${identificador}.${extensao}`;
}

export function separarValoresDocumentoVendedor(valores: Record<string, string>) {
  const { numero = '', validade = '', ...dadosAdicionais } = valores;
  return {
    numero_documento: numero.trim() || null,
    validade: validade || null,
    dados_adicionais: Object.fromEntries(
      Object.entries(dadosAdicionais).filter(([, valor]) => valor.trim() !== ''),
    ),
  };
}

async function obterUtilizadorAutenticado() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Sessão inválida. Entre novamente na sua conta.');
  return data.user;
}

async function enviarImagemPrivada(
  utilizadorId: string,
  vendedorId: string,
  tipoDocumento: TipoDocumentoVendedor,
  lado: 'frente' | 'verso',
  ficheiro: File,
) {
  validarImagemDocumentoVendedor(ficheiro);
  const caminho = criarCaminhoDocumentoVendedor(
    utilizadorId,
    vendedorId,
    tipoDocumento,
    lado,
    extensaoSegura(ficheiro),
  );
  const { error } = await supabase.storage
    .from(BUCKET_DOCUMENTOS_VENDEDORES)
    .upload(caminho, ficheiro, { contentType: ficheiro.type, upsert: false });
  if (error) throw error;
  return caminho;
}

/** Submete documentos iniciais sem criar URLs públicas nem gravá-las na tabela vendedores. */
export async function submeterDocumentosVendedor(
  vendedorId: string,
  documentos: DocumentoVendedorParaSubmissao[],
) {
  validarDocumentosParaSubmissao(documentos);
  const utilizador = await obterUtilizadorAutenticado();
  const registos: DocumentoVendedorInsert[] = [];

  for (const documento of documentos) {
    const frente_path = await enviarImagemPrivada(
      utilizador.id,
      vendedorId,
      documento.tipo_documento,
      'frente',
      documento.frente,
    );
    const verso_path = documento.verso
      ? await enviarImagemPrivada(
        utilizador.id,
        vendedorId,
        documento.tipo_documento,
        'verso',
        documento.verso,
      )
      : null;
    registos.push({
      vendedor_id: vendedorId,
      tipo_documento: documento.tipo_documento,
      frente_path,
      verso_path,
      ...separarValoresDocumentoVendedor(documento.valores),
      estado: 'pendente',
    });
  }

  const { data, error } = await supabase
    .from('documentos_vendedor')
    .insert(registos)
    .select('*');
  if (error) throw error;
  return (data || []).map(normalizarDocumentoVendedor);
}

export async function listarDocumentosVendedor(vendedorId: string) {
  const { data, error } = await supabase
    .from('documentos_vendedor')
    .select('*')
    .eq('vendedor_id', vendedorId)
    .order('criado_em');
  if (error) throw error;
  return (data || []).map(normalizarDocumentoVendedor);
}

export async function obterUrlAssinadaDocumentoVendedor(caminho: string) {
  const { data, error } = await supabase.storage
    .from(BUCKET_DOCUMENTOS_VENDEDORES)
    .createSignedUrl(caminho, 60 * 5);
  if (error || !data?.signedUrl) throw error || new Error('Não foi possível abrir o documento.');
  return data.signedUrl;
}

export async function reenviarDocumentoVendedor(
  documento: DocumentoVendedor,
  frente: File,
  verso: File | null,
  valores: Record<string, string>,
) {
  if (!documentoVendedorPodeSerReenviado(documento.estado)) {
    throw new Error('Só é possível reenviar documentos que foram rejeitados.');
  }

  const utilizador = await obterUtilizadorAutenticado();
  const frente_path = await enviarImagemPrivada(
    utilizador.id,
    documento.vendedor_id,
    documento.tipo_documento,
    'frente',
    frente,
  );
  const verso_path = verso
    ? await enviarImagemPrivada(
      utilizador.id,
      documento.vendedor_id,
      documento.tipo_documento,
      'verso',
      verso,
    )
    : null;
  const { data, error } = await supabase
    .from('documentos_vendedor')
    .update({ frente_path, verso_path, ...separarValoresDocumentoVendedor(valores), estado: 'pendente' })
    .eq('id', documento.id)
    .select('*')
    .single();
  if (error) throw error;
  return normalizarDocumentoVendedor(data);
}

export async function analisarDocumentoVendedor(
  documentoId: string,
  estado: Extract<EstadoDocumentoVendedor, 'aprovado' | 'rejeitado' | 'expirado'>,
  motivoRejeicao?: string,
) {
  if (estado === 'rejeitado' && !motivoRejeicao?.trim()) {
    throw new Error('Indique o motivo da rejeição do documento.');
  }
  const { data, error } = await supabase
    .from('documentos_vendedor')
    .update({ estado, motivo_rejeicao: estado === 'rejeitado' ? motivoRejeicao!.trim() : null })
    .eq('id', documentoId)
    .select('*')
    .single();
  if (error) throw error;
  return normalizarDocumentoVendedor(data);
}

export async function obterDocumentosLegadosVendedor(vendedorId: string) {
  const { data, error } = await supabase.rpc('obter_documentos_legados_vendedor', {
    p_vendedor_id: vendedorId,
  });
  if (error) throw error;
  return (data && typeof data === 'object' && !Array.isArray(data) ? data : {}) as Record<string, Record<string, string>>;
}
