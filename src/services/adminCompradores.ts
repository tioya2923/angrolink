import type { Database } from '@/types/database.types';
import { supabase } from './supabase';

export type TipoCompradorAdmin = 'casa' | 'negocio';
export type PapelSecundarioComprador = 'vendedor' | 'parceiro_entrega' | 'admin';
export type EstadoPerfilAdmin = 'ativo' | 'inativo' | 'pendente' | 'suspenso' | 'rejeitado';

export interface FiltrosCompradoresAdmin {
  tipoComprador?: TipoCompradorAdmin | null;
  contaAtiva?: boolean | null;
  provincia?: string | null;
  municipio?: string | null;
  comDisputas?: boolean | null;
  comCancelamentos?: boolean | null;
  registoRecente?: boolean | null;
  pesquisa?: string | null;
  limite?: number;
  offset?: number;
}

export interface CompradorAdminResumo {
  clienteId: string;
  userId: string;
  nome: string;
  fotoUrl: string | null;
  email: string | null;
  telefone: string | null;
  tipoComprador: TipoCompradorAdmin | null;
  provincia: string | null;
  municipio: string | null;
  contaAtiva: boolean;
  criadoEm: string;
  totalEncomendas: number;
  encomendasConcluidas: number;
  encomendasCanceladas: number;
  totalDisputas: number;
  totalPagamentos: number;
  ultimaAtividadeEm: string | null;
}

export interface ResultadoCompradoresAdmin {
  itens: CompradorAdminResumo[];
  paginacao: { totalResultados: number; limite: number; offset: number };
  contagens: { total: number; ativos: number; inativos: number; casa: number; negocio: number; comDisputas: number };
}

export interface OutroPapelComprador {
  papel: PapelSecundarioComprador;
  id: string;
  estado: EstadoPerfilAdmin;
}

export interface EncomendaCompradorAdmin {
  encomendaId: string;
  codigoPublico: string;
  vendedorId: string;
  vendedorNome: string;
  criadoEm: string;
  estado: string;
  totalCentimos: number;
  modalidade: string | null;
  estadoPagamento: string | null;
  temDisputa: boolean;
}

export interface CancelamentoCompradorAdmin {
  encomendaId: string;
  codigoPublico: string;
  vendedorId: string;
  vendedorNome: string;
  motivo: string | null;
  canceladoEm: string | null;
}

export interface RecusaVendedorCompradorAdmin {
  encomendaId: string;
  codigoPublico: string;
  vendedorId: string;
  vendedorNome: string;
  motivo: string | null;
  recusadoEm: string | null;
}

export interface PagamentoCompradorAdmin {
  pagamentoId: string;
  encomendaId: string;
  codigoPublico: string;
  estado: string;
  metodo: string | null;
  totalCentimos: number;
  criadoEm: string;
  totalReembolsadoCentimos: number;
  temReembolso: boolean;
}

export interface DisputaCompradorAdmin {
  disputaId: string;
  encomendaId: string;
  codigoPublico: string;
  vendedorId: string;
  vendedorNome: string;
  tipo: string;
  estado: string;
  criadoEm: string;
}

export interface AtividadeCompradorAdmin {
  contactosProdutos: number;
  contactosServicos: number;
  favoritos: number;
  ultimaAtividadeEm: string | null;
}

export interface DetalheCompradorAdmin {
  comprador: Pick<CompradorAdminResumo, 'clienteId' | 'userId' | 'nome' | 'fotoUrl' | 'email' | 'telefone' | 'tipoComprador' | 'provincia' | 'municipio' | 'contaAtiva' | 'criadoEm' | 'ultimaAtividadeEm'>;
  outrosPapeis: OutroPapelComprador[];
  resumo: {
    totalEncomendas: number; encomendasConcluidas: number; encomendasCanceladas: number;
    recusasVendedor: number; totalDisputas: number; disputasAbertas: number;
    disputasEmAnalise: number; disputasResolvidas: number; totalPagamentos: number;
    contactosIniciados: number; favoritos: number;
  };
  encomendas: EncomendaCompradorAdmin[];
  cancelamentos: CancelamentoCompradorAdmin[];
  recusasVendedor: RecusaVendedorCompradorAdmin[];
  pagamentos: PagamentoCompradorAdmin[];
  disputas: DisputaCompradorAdmin[];
  atividade: AtividadeCompradorAdmin;
}

type RetornoLista = Database['public']['Functions']['listar_compradores_admin']['Returns'];
type RetornoDetalhe = Database['public']['Functions']['obter_comprador_admin']['Returns'];

const tiposComprador: TipoCompradorAdmin[] = ['casa', 'negocio'];
const papeisSecundarios: PapelSecundarioComprador[] = ['vendedor', 'parceiro_entrega', 'admin'];
const estadosPerfil: EstadoPerfilAdmin[] = ['ativo', 'inativo', 'pendente', 'suspenso', 'rejeitado'];

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor) ? valor as Record<string, unknown> : null;
}
function texto(valor: unknown): string | null { return typeof valor === 'string' ? valor : null; }
function numero(valor: unknown): number | null { return typeof valor === 'number' && Number.isFinite(valor) ? valor : null; }
function booleano(valor: unknown): boolean | null { return typeof valor === 'boolean' ? valor : null; }
function tipo(valor: unknown): TipoCompradorAdmin | null { return typeof valor === 'string' && tiposComprador.includes(valor as TipoCompradorAdmin) ? valor as TipoCompradorAdmin : null; }
function estado(valor: unknown): EstadoPerfilAdmin | null { return typeof valor === 'string' && estadosPerfil.includes(valor as EstadoPerfilAdmin) ? valor as EstadoPerfilAdmin : null; }
function lista(valor: unknown): unknown[] { return Array.isArray(valor) ? valor : []; }

function compradorResumo(valor: unknown): CompradorAdminResumo | null {
  const item = objeto(valor);
  if (!item) return null;
  const clienteId = texto(item.cliente_id); const userId = texto(item.user_id); const nome = texto(item.nome); const criadoEm = texto(item.criado_em);
  const contaAtiva = booleano(item.conta_ativa); const totalEncomendas = numero(item.total_encomendas);
  const encomendasConcluidas = numero(item.encomendas_concluidas); const encomendasCanceladas = numero(item.encomendas_canceladas);
  const totalDisputas = numero(item.total_disputas); const totalPagamentos = numero(item.total_pagamentos);
  if (!clienteId || !userId || !nome || !criadoEm || contaAtiva === null || totalEncomendas === null || encomendasConcluidas === null || encomendasCanceladas === null || totalDisputas === null || totalPagamentos === null) return null;
  return { clienteId, userId, nome, fotoUrl: texto(item.foto_url), email: texto(item.email), telefone: texto(item.telefone), tipoComprador: tipo(item.tipo_comprador), provincia: texto(item.provincia), municipio: texto(item.municipio), contaAtiva, criadoEm, totalEncomendas, encomendasConcluidas, encomendasCanceladas, totalDisputas, totalPagamentos, ultimaAtividadeEm: texto(item.ultima_atividade_em) };
}

function compradorDetalheBase(valor: unknown): DetalheCompradorAdmin['comprador'] | null {
  const item = objeto(valor);
  if (!item) return null;
  const clienteId = texto(item.cliente_id); const userId = texto(item.user_id); const nome = texto(item.nome); const criadoEm = texto(item.criado_em); const contaAtiva = booleano(item.conta_ativa);
  if (!clienteId || !userId || !nome || !criadoEm || contaAtiva === null) return null;
  return { clienteId, userId, nome, fotoUrl: texto(item.foto_url), email: texto(item.email), telefone: texto(item.telefone), tipoComprador: tipo(item.tipo_comprador), provincia: texto(item.provincia), municipio: texto(item.municipio), contaAtiva, criadoEm, ultimaAtividadeEm: texto(item.ultima_atividade_em) };
}

function validarLista(valor: RetornoLista): ResultadoCompradoresAdmin {
  const resposta = objeto(valor); const paginacao = resposta && objeto(resposta.paginacao); const contagens = resposta && objeto(resposta.contagens);
  const totalResultados = numero(paginacao?.total_resultados); const limite = numero(paginacao?.limite); const offset = numero(paginacao?.offset);
  const total = numero(contagens?.total); const ativos = numero(contagens?.ativos); const inativos = numero(contagens?.inativos); const casa = numero(contagens?.casa); const negocio = numero(contagens?.negocio); const comDisputas = numero(contagens?.com_disputas);
  if (!resposta || !Array.isArray(resposta.itens) || totalResultados === null || limite === null || offset === null || total === null || ativos === null || inativos === null || casa === null || negocio === null || comDisputas === null) throw new Error('A resposta da lista de compradores está incompleta.');
  return { itens: resposta.itens.map(compradorResumo).filter((item): item is CompradorAdminResumo => item !== null), paginacao: { totalResultados, limite, offset }, contagens: { total, ativos, inativos, casa, negocio, comDisputas } };
}

function itemComCampos(valor: unknown, campos: string[]): Record<string, unknown> | null {
  const item = objeto(valor);
  return item && campos.every(campo => item[campo] !== undefined) ? item : null;
}

function validarDetalhe(valor: RetornoDetalhe): DetalheCompradorAdmin {
  const resposta = objeto(valor); const comprador = compradorDetalheBase(resposta?.comprador); const resumo = objeto(resposta?.resumo); const atividade = objeto(resposta?.atividade);
  if (!resposta || !comprador || !resumo || !atividade) throw new Error('A resposta do comprador está incompleta.');
  const numeroResumo = (chave: string) => numero(resumo[chave]);
  const valoresResumo = ['total_encomendas', 'encomendas_concluidas', 'encomendas_canceladas', 'recusas_vendedor', 'total_disputas', 'disputas_abertas', 'disputas_em_analise', 'disputas_resolvidas', 'total_pagamentos', 'contactos_iniciados', 'favoritos'].map(numeroResumo);
  const contactosProdutos = numero(atividade.contactos_produtos); const contactosServicos = numero(atividade.contactos_servicos); const favoritos = numero(atividade.favoritos);
  if (valoresResumo.some(valorResumo => valorResumo === null) || contactosProdutos === null || contactosServicos === null || favoritos === null) throw new Error('O resumo administrativo do comprador está incompleto.');
  const outrosPapeis = lista(resposta.outros_papeis).flatMap(valorPapel => { const item = itemComCampos(valorPapel, ['papel', 'id', 'estado']); const papel = item && texto(item.papel); const id = item && texto(item.id); const estadoPapel = item && estado(item.estado); return papel && id && estadoPapel && papeisSecundarios.includes(papel as PapelSecundarioComprador) ? [{ papel: papel as PapelSecundarioComprador, id, estado: estadoPapel }] : []; });
  const encomendas = lista(resposta.encomendas).flatMap(valorEncomenda => { const item = itemComCampos(valorEncomenda, ['encomenda_id', 'codigo_publico', 'vendedor_id', 'vendedor_nome', 'criado_em', 'estado', 'total_centimos', 'tem_disputa']); const totalCentimos = item && numero(item.total_centimos); const temDisputa = item && booleano(item.tem_disputa); const valores = item && ['encomenda_id', 'codigo_publico', 'vendedor_id', 'vendedor_nome', 'criado_em', 'estado'].map(chave => texto(item[chave])); return item && valores?.every(Boolean) && totalCentimos !== null && temDisputa !== null ? [{ encomendaId: valores[0]!, codigoPublico: valores[1]!, vendedorId: valores[2]!, vendedorNome: valores[3]!, criadoEm: valores[4]!, estado: valores[5]!, totalCentimos, modalidade: texto(item.modalidade), estadoPagamento: texto(item.estado_pagamento), temDisputa }] : []; });
  const cancelamentos = lista(resposta.cancelamentos).flatMap(valorCancelamento => { const item = itemComCampos(valorCancelamento, ['encomenda_id', 'codigo_publico', 'vendedor_id', 'vendedor_nome']); const valores = item && ['encomenda_id', 'codigo_publico', 'vendedor_id', 'vendedor_nome'].map(chave => texto(item[chave])); return item && valores?.every(Boolean) ? [{ encomendaId: valores[0]!, codigoPublico: valores[1]!, vendedorId: valores[2]!, vendedorNome: valores[3]!, motivo: texto(item.motivo), canceladoEm: texto(item.cancelado_em) }] : []; });
  const recusasVendedor = lista(resposta.recusas_vendedor).flatMap(valorRecusa => { const item = itemComCampos(valorRecusa, ['encomenda_id', 'codigo_publico', 'vendedor_id', 'vendedor_nome']); const valores = item && ['encomenda_id', 'codigo_publico', 'vendedor_id', 'vendedor_nome'].map(chave => texto(item[chave])); return item && valores?.every(Boolean) ? [{ encomendaId: valores[0]!, codigoPublico: valores[1]!, vendedorId: valores[2]!, vendedorNome: valores[3]!, motivo: texto(item.motivo), recusadoEm: texto(item.recusado_em) }] : []; });
  const pagamentos = lista(resposta.pagamentos).flatMap(valorPagamento => { const item = itemComCampos(valorPagamento, ['pagamento_id', 'encomenda_id', 'codigo_publico', 'estado', 'total_centimos', 'criado_em', 'total_reembolsado_centimos', 'tem_reembolso']); const totalCentimos = item && numero(item.total_centimos); const totalReembolsadoCentimos = item && numero(item.total_reembolsado_centimos); const temReembolso = item && booleano(item.tem_reembolso); const valores = item && ['pagamento_id', 'encomenda_id', 'codigo_publico', 'estado', 'criado_em'].map(chave => texto(item[chave])); return item && valores?.every(Boolean) && totalCentimos !== null && totalReembolsadoCentimos !== null && temReembolso !== null ? [{ pagamentoId: valores[0]!, encomendaId: valores[1]!, codigoPublico: valores[2]!, estado: valores[3]!, metodo: texto(item.metodo), totalCentimos, criadoEm: valores[4]!, totalReembolsadoCentimos, temReembolso }] : []; });
  const disputas = lista(resposta.disputas).flatMap(valorDisputa => { const item = itemComCampos(valorDisputa, ['disputa_id', 'encomenda_id', 'codigo_publico', 'vendedor_id', 'vendedor_nome', 'tipo', 'estado', 'criado_em']); const valores = item && ['disputa_id', 'encomenda_id', 'codigo_publico', 'vendedor_id', 'vendedor_nome', 'tipo', 'estado', 'criado_em'].map(chave => texto(item[chave])); return item && valores?.every(Boolean) ? [{ disputaId: valores[0]!, encomendaId: valores[1]!, codigoPublico: valores[2]!, vendedorId: valores[3]!, vendedorNome: valores[4]!, tipo: valores[5]!, estado: valores[6]!, criadoEm: valores[7]! }] : []; });
  return { comprador, outrosPapeis, resumo: { totalEncomendas: valoresResumo[0]!, encomendasConcluidas: valoresResumo[1]!, encomendasCanceladas: valoresResumo[2]!, recusasVendedor: valoresResumo[3]!, totalDisputas: valoresResumo[4]!, disputasAbertas: valoresResumo[5]!, disputasEmAnalise: valoresResumo[6]!, disputasResolvidas: valoresResumo[7]!, totalPagamentos: valoresResumo[8]!, contactosIniciados: valoresResumo[9]!, favoritos: valoresResumo[10]! }, encomendas, cancelamentos, recusasVendedor, pagamentos, disputas, atividade: { contactosProdutos, contactosServicos, favoritos, ultimaAtividadeEm: texto(atividade.ultima_atividade_em) } };
}

export async function listarCompradoresAdmin(filtros: FiltrosCompradoresAdmin = {}): Promise<ResultadoCompradoresAdmin> {
  const { data, error } = await supabase.rpc('listar_compradores_admin', { p_tipo_comprador: filtros.tipoComprador ?? null, p_conta_ativa: filtros.contaAtiva ?? null, p_provincia: filtros.provincia ?? null, p_municipio: filtros.municipio ?? null, p_com_disputas: filtros.comDisputas ?? null, p_com_cancelamentos: filtros.comCancelamentos ?? null, p_registo_recente: filtros.registoRecente ?? null, p_pesquisa: filtros.pesquisa?.trim() || null, p_limite: filtros.limite ?? 25, p_offset: Math.max(filtros.offset ?? 0, 0) });
  if (error) throw error;
  return validarLista(data);
}

export async function obterCompradorAdmin(clienteId: string): Promise<DetalheCompradorAdmin> {
  const { data, error } = await supabase.rpc('obter_comprador_admin', { p_cliente_id: clienteId });
  if (error) throw error;
  return validarDetalhe(data);
}
