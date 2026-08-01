/**
 * Documentos exigidos por tipo de vendedor.
 *
 * Reflete a realidade do comércio angolano: vendedores informais
 * (zungueiras, quitandeiras, taxistas, pequenos produtores) só precisam
 * do BI para começar a vender; negócios fixos de maior porte precisam de
 * NIF, Alvará Comercial e, no topo, Registo Comercial.
 */

import { TipoVendedor } from '@/tipos';

export type NivelDocumentacao = 'informal' | 'pequeno' | 'medio' | 'grande';

export interface DocumentoExigido {
  id: string;
  nome: string;
  descricao: string;
}

export const CATALOGO_DOCUMENTOS: Record<string, DocumentoExigido> = {
  bi: {
    id: 'bi',
    nome: 'Bilhete de Identidade (BI)',
    descricao: 'Documento de identificação do responsável pela conta.',
  },
  nif: {
    id: 'nif',
    nome: 'Número de Identificação Fiscal (NIF)',
    descricao: 'Emitido pela Administração Geral Tributária (AGT).',
  },
  alvara: {
    id: 'alvara',
    nome: 'Alvará Comercial',
    descricao: 'Licença de atividade emitida pela administração municipal ou comunal.',
  },
  registo_comercial: {
    id: 'registo_comercial',
    nome: 'Certidão de Registo Comercial',
    descricao: 'Emitida pela Conservatória do Registo Comercial.',
  },
  cartao_vendedor: {
    id: 'cartao_vendedor',
    nome: 'Cartão de vendedor ambulante/informal',
    descricao: 'Emitido pela administração municipal, quando já o possuir. Não é obrigatório para começar a vender.',
  },
  comprovativo_banca: {
    id: 'comprovativo_banca',
    nome: 'Comprovativo de ocupação da banca',
    descricao: 'Recibo ou cartão da administração do mercado, quando existir.',
  },
};

export interface RequisitoDocumentacao {
  nivel: NivelDocumentacao;
  rotuloNivel: string;
  obrigatorios: string[];
  opcionais: string[];
}

export const REQUISITOS_POR_TIPO: Record<TipoVendedor, RequisitoDocumentacao> = {
  ambulante: {
    nivel: 'informal',
    rotuloNivel: 'Vendedor informal',
    obrigatorios: ['bi'],
    opcionais: ['cartao_vendedor'],
  },
  quitandeira: {
    nivel: 'informal',
    rotuloNivel: 'Vendedor informal',
    obrigatorios: ['bi'],
    opcionais: ['cartao_vendedor'],
  },
  taxista: {
    nivel: 'informal',
    rotuloNivel: 'Prestador informal',
    obrigatorios: ['bi'],
    opcionais: ['nif'],
  },
  produtor: {
    nivel: 'informal',
    rotuloNivel: 'Produtor informal',
    obrigatorios: ['bi'],
    opcionais: ['nif'],
  },
  mini_mercado: {
    nivel: 'pequeno',
    rotuloNivel: 'Pequeno negócio',
    obrigatorios: ['bi'],
    opcionais: ['nif', 'alvara'],
  },
  mercado: {
    nivel: 'pequeno',
    rotuloNivel: 'Pequeno negócio',
    obrigatorios: ['bi'],
    opcionais: ['comprovativo_banca', 'nif'],
  },
  supermercado: {
    nivel: 'medio',
    rotuloNivel: 'Negócio formalizado',
    obrigatorios: ['bi', 'nif', 'alvara'],
    opcionais: ['registo_comercial'],
  },
  hipermercado: {
    nivel: 'grande',
    rotuloNivel: 'Grande retalho',
    obrigatorios: ['bi', 'nif', 'alvara', 'registo_comercial'],
    opcionais: [],
  },
  grossista: {
    nivel: 'medio',
    rotuloNivel: 'Negócio formalizado',
    obrigatorios: ['bi', 'nif', 'alvara'],
    opcionais: ['registo_comercial'],
  },
  prestador_servico: {
    nivel: 'informal',
    rotuloNivel: 'Prestador informal',
    obrigatorios: ['bi'],
    opcionais: ['nif'],
  },
};

export function obterRequisitosDocumentos(
  tipo: TipoVendedor | ''
): RequisitoDocumentacao | null {
  if (!tipo) return null;
  return REQUISITOS_POR_TIPO[tipo] ?? null;
}
