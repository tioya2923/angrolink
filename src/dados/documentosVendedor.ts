/**
 * Documentos exigidos por tipo de vendedor.
 *
 * Reflete a realidade do comércio angolano: vendedores informais
 * (zungueiras, quitandeiras, pequenos produtores) só precisam do BI para
 * começar a vender; negócios fixos de maior porte precisam de NIF, Alvará
 * Comercial e, no topo, Registo Comercial. Categorias com exigências
 * legais próprias (ex: taxista) pedem também os documentos específicos
 * da sua atividade (carta de condução, documentos do veículo).
 */

import { TipoVendedor } from '@/tipos';

export type NivelDocumentacao = 'informal' | 'pequeno' | 'medio' | 'grande';

export interface CampoDocumento {
  id: string;
  rotulo: string;
  placeholder: string;
  tipo?: 'texto' | 'data';
}

export interface DocumentoExigido {
  id: string;
  nome: string;
  descricao: string;
  /** Dados a preencher para este documento (ex: número, categoria, validade). */
  campos: CampoDocumento[];
}

export const CATALOGO_DOCUMENTOS: Record<string, DocumentoExigido> = {
  bi: {
    id: 'bi',
    nome: 'Bilhete de Identidade (BI)',
    descricao: 'Documento de identificação do responsável pela conta. Para particulares, a AGT usa o mesmo número do BI como NIF.',
    campos: [
      { id: 'numero', rotulo: 'N.º do Bilhete de Identidade', placeholder: 'Ex: 000000000LA042' },
    ],
  },
  nif: {
    id: 'nif',
    nome: 'Número de Identificação Fiscal (NIF)',
    descricao: 'NIF da empresa/negócio, emitido pela Administração Geral Tributária (AGT).',
    campos: [
      { id: 'numero', rotulo: 'N.º de Identificação Fiscal (NIF)', placeholder: 'Ex: 5417123456' },
    ],
  },
  alvara: {
    id: 'alvara',
    nome: 'Alvará Comercial',
    descricao: 'Licença de atividade emitida pela administração municipal ou comunal.',
    campos: [
      { id: 'numero', rotulo: 'N.º do Alvará Comercial', placeholder: 'Ex: ALV/2025/001234' },
    ],
  },
  registo_comercial: {
    id: 'registo_comercial',
    nome: 'Certidão de Registo Comercial',
    descricao: 'Emitida pela Conservatória do Registo Comercial.',
    campos: [
      { id: 'numero', rotulo: 'N.º da Certidão de Registo Comercial', placeholder: 'Ex: 12345/2025' },
    ],
  },
  cartao_vendedor: {
    id: 'cartao_vendedor',
    nome: 'Cartão de vendedor ambulante/informal',
    descricao: 'Emitido pela administração municipal, quando já o possuir. Não é obrigatório para começar a vender.',
    campos: [
      { id: 'numero', rotulo: 'N.º do cartão de vendedor (se tiver)', placeholder: 'Ex: CV-00123' },
    ],
  },
  comprovativo_banca: {
    id: 'comprovativo_banca',
    nome: 'Comprovativo de ocupação da banca',
    descricao: 'Recibo ou cartão da administração do mercado, quando existir.',
    campos: [
      { id: 'numero', rotulo: 'N.º do comprovativo/cartão da banca (se tiver)', placeholder: 'Ex: B-045' },
    ],
  },
  carta_conducao: {
    id: 'carta_conducao',
    nome: 'Carta de Condução',
    descricao: 'Habilitação legal para conduzir, na categoria adequada ao veículo utilizado.',
    campos: [
      { id: 'numero', rotulo: 'N.º da Carta de Condução', placeholder: 'Ex: AO-1234567' },
      { id: 'categoria', rotulo: 'Categoria da carta', placeholder: 'Ex: B, C1, D' },
      { id: 'validade', rotulo: 'Validade da carta de condução', placeholder: '', tipo: 'data' },
    ],
  },
  certificado_moto_taxi: {
    id: 'certificado_moto_taxi',
    nome: 'Certificado Profissional de Moto-Táxi',
    descricao: 'Exigido pelo Regime Jurídico da Atividade de Moto-Táxi, além da carta de condução.',
    campos: [
      { id: 'numero', rotulo: 'N.º do certificado profissional', placeholder: 'Ex: CPMT-004521' },
      { id: 'validade', rotulo: 'Validade do certificado', placeholder: '', tipo: 'data' },
    ],
  },
  livrete_veiculo: {
    id: 'livrete_veiculo',
    nome: 'Livrete / Registo de Propriedade do Veículo',
    descricao: 'Documento único automóvel (DUA) ou livrete que identifica o veículo e o seu proprietário.',
    campos: [
      { id: 'numero', rotulo: 'N.º de matrícula do veículo', placeholder: 'Ex: LD-12-34-AB' },
    ],
  },
  seguro_automovel: {
    id: 'seguro_automovel',
    nome: 'Seguro Obrigatório Automóvel',
    descricao: 'Apólice de seguro válida para o veículo utilizado no transporte.',
    campos: [
      { id: 'numero', rotulo: 'N.º da apólice de seguro', placeholder: 'Ex: SEG-2026-00981' },
      { id: 'validade', rotulo: 'Validade do seguro', placeholder: '', tipo: 'data' },
    ],
  },
  titulo_terra: {
    id: 'titulo_terra',
    nome: 'Declaração ou Título de Uso e Aproveitamento de Terra',
    descricao: 'Comprovativo de posse da terra cultivada, emitido pela administração comunal, quando existir.',
    campos: [
      { id: 'numero', rotulo: 'N.º da declaração/título (se tiver)', placeholder: 'Ex: DUAT-00456' },
    ],
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
    rotuloNivel: 'Prestador de transporte',
    obrigatorios: ['bi', 'carta_conducao', 'livrete_veiculo'],
    opcionais: ['seguro_automovel'],
  },
  moto_taxista: {
    nivel: 'informal',
    rotuloNivel: 'Prestador de transporte (moto-táxi)',
    obrigatorios: ['bi', 'carta_conducao', 'certificado_moto_taxi', 'livrete_veiculo'],
    opcionais: ['seguro_automovel'],
  },
  produtor: {
    nivel: 'informal',
    rotuloNivel: 'Produtor informal',
    obrigatorios: ['bi'],
    opcionais: ['titulo_terra'],
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
    opcionais: [],
  },
};

export function obterRequisitosDocumentos(
  tipo: TipoVendedor | ''
): RequisitoDocumentacao | null {
  if (!tipo) return null;
  return REQUISITOS_POR_TIPO[tipo] ?? null;
}

/**
 * Devolve os rótulos dos campos obrigatórios (de qualquer documento
 * obrigatório do tipo) que ainda não foram preenchidos em `valores`
 * (map documento-id -> campo-id -> valor indicado).
 */
export function documentosObrigatoriosEmFalta(
  tipo: TipoVendedor | '',
  valores: Record<string, Record<string, string>>
): string[] {
  const requisitos = obterRequisitosDocumentos(tipo);
  if (!requisitos) return [];

  const emFalta: string[] = [];

  for (const documentoId of requisitos.obrigatorios) {
    const documento = CATALOGO_DOCUMENTOS[documentoId];
    if (!documento) continue;

    for (const campo of documento.campos) {
      if (!valores[documentoId]?.[campo.id]?.trim()) {
        emFalta.push(
          documento.campos.length > 1
            ? `${documento.nome} — ${campo.rotulo}`
            : campo.rotulo
        );
      }
    }
  }

  return emFalta;
}
