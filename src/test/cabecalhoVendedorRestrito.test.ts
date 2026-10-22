import { describe, expect, it } from 'vitest';
import { filtrarLinksVendedorPorAcesso } from '@/lib/acessoVendedor';

const linksVendedor = [
  { to: '/dashboard' },
  { to: '/dashboard/produtos' },
  { to: '/dashboard/favoritos' },
  { to: '/dashboard/adicionar' },
  { to: '/dashboard/desempenho' },
  { to: '/dashboard/contactos' },
  { to: '/dashboard/estatisticas' },
  { to: '/dashboard/perfil' },
  { to: '/dashboard/encomendas' },
  { to: '/dashboard/compras' },
  { to: '/dashboard/documentos' },
];

const caminhos = (status_aprovacao: 'pendente' | 'aprovado' | 'rejeitado' | 'suspenso') =>
  filtrarLinksVendedorPorAcesso(linksVendedor, {
    status_aprovacao,
    conta_ativa: true,
  }).map(({ to }) => to);

describe('menu do cabeçalho para vendedor', () => {
  it.each(['pendente', 'rejeitado', 'suspenso'] as const)(
    'oculta ações comerciais quando a candidatura está %s',
    (status) => {
      expect(caminhos(status)).toEqual([
        '/dashboard',
        '/dashboard/perfil',
        '/dashboard/encomendas',
        '/dashboard/compras',
        '/dashboard/documentos',
      ]);
    },
  );

  it('mantém todas as ações comerciais para vendedor aprovado', () => {
    expect(caminhos('aprovado')).toEqual(linksVendedor.map(({ to }) => to));
  });

  it('also restricts an inactive approved seller', () => {
    expect(
      filtrarLinksVendedorPorAcesso(linksVendedor, {
        status_aprovacao: 'aprovado',
        conta_ativa: false,
      }).map(({ to }) => to),
    ).toEqual([
      '/dashboard',
      '/dashboard/perfil',
      '/dashboard/encomendas',
      '/dashboard/compras',
      '/dashboard/documentos',
    ]);
  });
});
