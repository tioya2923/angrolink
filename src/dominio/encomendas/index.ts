export const ESTADOS_ENCOMENDA = [
  'aguardando_confirmacao',
  'confirmada',
  'em_preparacao',
  'pronta_para_levantamento',
  'recolhida',
  'chegou_destino',
  'levantada',
  'concluida',
  'recusada',
  'cancelada',
] as const;

export type EstadoEncomenda = typeof ESTADOS_ENCOMENDA[number];
export type ModalidadeRecebimentoEncomenda = 'levantamento' | 'entrega';
export type AtorEncomenda = 'cliente' | 'vendedor';
export type ContextoDetalheEncomenda = 'cliente' | 'vendedor';

export interface MotivoEncerramentoEncomenda {
  titulo: string;
  descricao: string;
  motivo: string;
  data: string | null;
}

const ROTULOS_ESTADO: Record<EstadoEncomenda, string> = {
  aguardando_confirmacao: 'Aguardando confirmação', confirmada: 'Confirmada',
  em_preparacao: 'Em preparação', pronta_para_levantamento: 'Pronta para levantamento',
  recolhida: 'Recolhida pelo entregador', chegou_destino: 'Entregador chegou ao destino', levantada: 'Levantada', concluida: 'Concluída', recusada: 'Recusada', cancelada: 'Cancelada',
};

export function rotuloEstadoEncomenda(estado: string) {
  return ROTULOS_ESTADO[estado as EstadoEncomenda] ?? 'Estado desconhecido';
}

/** A encomenda é a fonte canónica; o evento serve apenas de auditoria. */
export function obterMotivoEncerramentoEncomenda(
  contexto: ContextoDetalheEncomenda,
  encomenda: {
    estado: string;
    motivo_cancelamento: string | null;
    motivo_recusa: string | null;
    cancelado_em: string | null;
    recusado_em: string | null;
  },
): MotivoEncerramentoEncomenda | null {
  if (contexto === 'vendedor' && encomenda.estado === 'cancelada') {
    return {
      titulo: 'Encomenda cancelada pelo cliente',
      descricao: 'O cliente indicou:',
      motivo: encomenda.motivo_cancelamento?.trim() || 'O cliente não indicou um motivo.',
      data: encomenda.cancelado_em,
    };
  }
  if (contexto === 'cliente' && encomenda.estado === 'recusada') {
    return {
      titulo: 'Encomenda recusada pelo vendedor',
      descricao: 'O vendedor indicou:',
      motivo: encomenda.motivo_recusa?.trim() || 'O vendedor não indicou um motivo.',
      data: encomenda.recusado_em,
    };
  }
  return null;
}

export function classeEstadoEncomenda(estado: string) {
  if (['levantada', 'recolhida', 'chegou_destino', 'concluida', 'confirmada'].includes(estado)) return 'bg-green-100 text-green-800 border-green-200';
  if (estado === 'pronta_para_levantamento') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (estado === 'em_preparacao') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (['recusada', 'cancelada'].includes(estado)) return 'bg-red-100 text-red-800 border-red-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

export function rotuloEventoEncomenda(evento: string) {
  const rotulos: Record<string, string> = {
    encomenda_criada: 'Encomenda criada', vendedor_confirmou: 'Encomenda confirmada',
    vendedor_recusou: 'Encomenda recusada', preparacao_iniciada: 'Preparação iniciada',
    pronta_para_levantamento: 'Pronta para levantamento', cliente_cancelou: 'Encomenda cancelada',
    codigo_levantamento_gerado: 'Código de levantamento gerado',
    codigo_levantamento_regenerado: 'Código de levantamento renovado',
    tentativa_levantamento_falhou: 'Tentativa de levantamento falhou',
    levantamento_confirmado: 'Levantamento confirmado', encomenda_concluida: 'Encomenda concluída',
    problema_reportado: 'Problema reportado pelo cliente',
    entregador_atribuido: 'Entregador atribuído', entregador_aceitou: 'Entregador aceitou a tarefa',
    entregador_recusou: 'Entregador recusou a tarefa',
    entregador_chegou_origem: 'Entregador chegou para recolha', encomenda_recolhida: 'Encomenda recolhida pelo entregador',
    entregador_chegou_destino: 'Entregador chegou ao destino', codigo_entrega_gerado: 'Código de entrega gerado',
    codigo_entrega_regenerado: 'Código de entrega renovado', tentativa_entrega_falhou: 'Tentativa de entrega falhou', entrega_confirmada: 'Entrega confirmada',
    atribuicao_liberada_admin: 'Atribuição reorganizada pela operação', incidente_operacional_aberto: 'Incidente operacional registado', incidente_operacional_resolvido: 'Incidente operacional resolvido',
  };
  return rotulos[evento] ?? 'Atualização da encomenda';
}

export function rotuloTipoProblemaEncomenda(tipo: string) {
  const rotulos: Record<string, string> = {
    produto_danificado: 'Produto danificado',
    produto_incorreto: 'Produto incorreto',
    quantidade_incorreta: 'Quantidade incorreta',
    qualidade_inadequada: 'Qualidade inadequada',
    produto_em_falta: 'Produto em falta',
    outro: 'Outro problema',
  };
  return rotulos[tipo] ?? 'Problema reportado';
}

export function rotuloEstadoDisputaEncomenda(estado: string) {
  const rotulos: Record<string, string> = {
    aberta: 'Aberto', em_analise: 'Em análise',
    resolvida_sem_reembolso: 'Resolvido sem reembolso',
    resolvida_reembolso_parcial: 'Resolvido com reembolso parcial',
    resolvida_reembolso_total: 'Resolvido com reembolso total', cancelada: 'Cancelado',
  };
  return rotulos[estado] ?? 'Em análise';
}

export function formatarDataEncomenda(data: string) {
  return new Intl.DateTimeFormat('pt-AO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data));
}

export function formatarQuantidadeEncomenda(quantidade: number, unidade: string) {
  return `${new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 3 }).format(quantidade)} ${unidade}`;
}

export interface ItemEncomendaSolicitado {
  produto_id: string;
  quantidade: number;
}

export interface CriarEncomendaLevantamentoInput {
  itens: ItemEncomendaSolicitado[];
  idempotencyKey: string;
  modalidade?: ModalidadeRecebimentoEncomenda;
  nomeDestinatario?: string;
  telefoneDestinatario?: string;
  observacoesCliente?: string;
}

export interface CriarEncomendaEntregaInput {
  itens: ItemEncomendaSolicitado[]; idempotencyKey: string; nomeDestinatario: string; telefoneDestinatario: string;
  provincia: string; municipio: string; bairro: string; enderecoDetalhado: string;
  pontoReferencia?: string; instrucoesEntrega?: string; observacoesCliente?: string;
}

const transicoesPorAtor: Record<AtorEncomenda, Partial<Record<EstadoEncomenda, EstadoEncomenda[]>>> = {
  cliente: {
    aguardando_confirmacao: ['cancelada'],
    levantada: ['concluida'],
  },
  vendedor: {
    aguardando_confirmacao: ['confirmada', 'recusada'],
    confirmada: ['em_preparacao'],
    em_preparacao: ['pronta_para_levantamento'],
  },
};

export function transicaoEncomendaPermitida(
  ator: AtorEncomenda,
  estadoAtual: EstadoEncomenda,
  proximoEstado: EstadoEncomenda,
) {
  return transicoesPorAtor[ator][estadoAtual]?.includes(proximoEstado) ?? false;
}

export function validarItemEncomendaSolicitado(item: ItemEncomendaSolicitado) {
  if (!item.produto_id.trim()) return 'Indique o produto pretendido.';
  if (!Number.isFinite(item.quantidade) || item.quantidade <= 0) {
    return 'A quantidade deve ser superior a zero.';
  }
  return null;
}

/** Apenas para apresentação. A RPC calcula e persiste valores no servidor. */
export function formatarCentimosAoa(centimos: number) {
  if (!Number.isSafeInteger(centimos) || centimos < 0) {
    throw new Error('O valor em cêntimos deve ser um inteiro não negativo.');
  }
  return new Intl.NumberFormat('pt-AO', {
    style: 'currency',
    currency: 'AOA',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centimos / 100);
}

/**
 * Espelha apenas a regra de arredondamento por linha usada na RPC para testes
 * e apresentação. Nunca é fonte de verdade para criação de encomendas.
 */
export function calcularSubtotalCentimos(valorUnitarioCentimos: number, quantidade: number) {
  if (!Number.isSafeInteger(valorUnitarioCentimos) || valorUnitarioCentimos < 0) {
    throw new Error('O valor unitário deve estar em cêntimos inteiros não negativos.');
  }
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw new Error('A quantidade deve ser superior a zero.');
  }
  return Math.round(valorUnitarioCentimos * quantidade);
}
