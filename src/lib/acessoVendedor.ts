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

const caminhosVendedorRestrito = new Set([
  '/dashboard',
  '/dashboard/encomendas',
  '/dashboard/compras',
  '/dashboard/perfil',
  '/dashboard/documentos',
]);

export function filtrarLinksVendedorPorAcesso<T extends { to: string }>(
  links: T[],
  vendedor: EstadoAcessoVendedor,
): T[] {
  return vendedorPodeOperarComercialmente(vendedor)
    ? links
    : links.filter(({ to }) => caminhosVendedorRestrito.has(to));
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
