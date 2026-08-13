import type { StatusVendedorAprovacao } from '@/tipos';

export type EstadoAcessoVendedor = Pick<
  { status_aprovacao?: StatusVendedorAprovacao; conta_ativa?: boolean },
  'status_aprovacao' | 'conta_ativa'
>;

export function contaVendedorPodeAutenticar(estado: EstadoAcessoVendedor) {
  return estado.conta_ativa !== false;
}

export function vendedorPodeOperarComercialmente(estado: EstadoAcessoVendedor) {
  return contaVendedorPodeAutenticar(estado) && estado.status_aprovacao === 'aprovado';
}

export function vendedorEstaEmModoRestrito(estado: EstadoAcessoVendedor) {
  return contaVendedorPodeAutenticar(estado) && !vendedorPodeOperarComercialmente(estado);
}

export function rotuloEstadoVendedor(estado?: StatusVendedorAprovacao) {
  if (estado === 'aprovado') return 'Conta aprovada';
  if (estado === 'rejeitado') return 'Cadastro rejeitado';
  if (estado === 'suspenso') return 'Conta suspensa';
  return 'Cadastro em análise';
}
