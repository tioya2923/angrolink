import type { Utilizador } from '@/tipos';

type UtilizadorParaCompatibilidade = Pick<
  Utilizador,
  'papel' | 'vendedor_id' | 'status_aprovacao' | 'conta_ativa'
>;

export function obterDestinoAnunciarServico(
  utilizador: UtilizadorParaCompatibilidade | null,
): string {
  if (utilizador?.papel !== 'vendedor' || !utilizador.vendedor_id) {
    return '/anunciar';
  }

  if (utilizador.conta_ativa === false) {
    return '/anunciar';
  }

  if (
    utilizador.status_aprovacao === 'aprovado'
  ) {
    return '/dashboard/servicos/novo';
  }

  return '/dashboard/perfil';
}
