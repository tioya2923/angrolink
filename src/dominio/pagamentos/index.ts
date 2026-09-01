export type MetodoPagamento =
  | 'online'
  | 'pagamento_na_entrega'
  | 'digital_na_entrega'
  | 'pagamento_no_levantamento';

export type EstadoPagamento =
  | 'pendente'
  | 'a_processar'
  | 'confirmado'
  | 'falhado'
  | 'cancelado'
  | 'expirado'
  | 'reembolsado_parcialmente'
  | 'reembolsado';

export function rotuloEstadoPagamento(estado: string): string {
  const rotulos: Record<EstadoPagamento, string> = {
    pendente: 'Pendente',
    a_processar: 'A processar',
    confirmado: 'Pago',
    falhado: 'Falhou',
    cancelado: 'Cancelado',
    expirado: 'Expirado',
    reembolsado_parcialmente: 'Reembolsado parcialmente',
    reembolsado: 'Reembolsado',
  };

  return rotulos[estado as EstadoPagamento] ?? 'Estado por confirmar';
}

export function rotuloMetodoPagamento(metodo: string): string {
  const rotulos: Record<MetodoPagamento, string> = {
    online: 'Pagamento online',
    pagamento_na_entrega: 'Pagamento na entrega',
    digital_na_entrega: 'Pagamento digital na entrega',
    pagamento_no_levantamento: 'Pagar no levantamento',
  };

  return rotulos[metodo as MetodoPagamento] ?? 'Método por confirmar';
}

export function rotuloEstadoRepasse(estado: string | null): string {
  const rotulos: Record<EstadoRepasse, string> = {
    pendente: 'Pendente',
    disponivel: 'Disponível',
    processando: 'Em processamento',
    concluido: 'Concluído',
    falhado: 'Falhou',
    cancelado: 'Cancelado',
  };

  return estado ? (rotulos[estado as EstadoRepasse] ?? 'Estado por confirmar') : 'Repasse ainda não disponível';
}

export type EstadoRepasse =
  | 'pendente'
  | 'disponivel'
  | 'processando'
  | 'concluido'
  | 'falhado'
  | 'cancelado';

export interface DivisaoFinanceiraInput {
  subtotalCentimos: number;
  descontoCentimos?: number;
  entregaCentimos?: number;
  taxaProcessadorCentimos?: number;
  comissaoBps: number;
}

export interface DivisaoFinanceira {
  subtotalCentimos: number;
  descontoCentimos: number;
  entregaCentimos: number;
  taxaProcessadorCentimos: number;
  comissaoAngrolinkCentimos: number;
  valorVendedorCentimos: number;
  valorLogisticaCentimos: number;
  totalClienteCentimos: number;
}

function validarCentimos(nome: string, valor: number) {
  if (!Number.isSafeInteger(valor) || valor < 0) {
    throw new Error(`${nome} deve ser um número inteiro não negativo de cêntimos.`);
  }
}

/**
 * Espelho determinístico da divisão que a RPC calculará no servidor.
 * É útil para testes e apresentação futura, mas nunca autoriza ou confirma
 * um pagamento: a fonte de verdade é sempre `criar_pagamento_encomenda`.
 */
export function calcularDivisaoFinanceira(input: DivisaoFinanceiraInput): DivisaoFinanceira {
  const descontoCentimos = input.descontoCentimos ?? 0;
  const entregaCentimos = input.entregaCentimos ?? 0;
  const taxaProcessadorCentimos = input.taxaProcessadorCentimos ?? 0;

  validarCentimos('Subtotal', input.subtotalCentimos);
  validarCentimos('Desconto', descontoCentimos);
  validarCentimos('Entrega', entregaCentimos);
  validarCentimos('Taxa do processador', taxaProcessadorCentimos);

  if (!Number.isSafeInteger(input.comissaoBps) || input.comissaoBps < 0 || input.comissaoBps > 10_000) {
    throw new Error('A comissão deve estar entre 0 e 10 000 pontos-base.');
  }
  if (descontoCentimos > input.subtotalCentimos) {
    throw new Error('O desconto não pode ser superior ao subtotal.');
  }

  const comercioCentimos = input.subtotalCentimos - descontoCentimos;
  const comissaoAngrolinkCentimos = Math.floor((comercioCentimos * input.comissaoBps + 5_000) / 10_000);
  const valorVendedorCentimos = comercioCentimos - comissaoAngrolinkCentimos;
  const valorLogisticaCentimos = entregaCentimos;
  const totalClienteCentimos = comercioCentimos + entregaCentimos + taxaProcessadorCentimos;

  return {
    subtotalCentimos: input.subtotalCentimos,
    descontoCentimos,
    entregaCentimos,
    taxaProcessadorCentimos,
    comissaoAngrolinkCentimos,
    valorVendedorCentimos,
    valorLogisticaCentimos,
    totalClienteCentimos,
  };
}
