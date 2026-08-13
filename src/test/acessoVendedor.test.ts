import { describe, expect, it } from 'vitest';
import {
  contaVendedorPodeAutenticar,
  vendedorEstaEmModoRestrito,
  vendedorPodeOperarComercialmente,
} from '@/lib/acessoVendedor';

describe('separação entre autenticação e autorização de vendedor', () => {
  it('permite acesso normal ao vendedor aprovado', () => {
    const estado = { status_aprovacao: 'aprovado' as const, conta_ativa: true };
    expect(contaVendedorPodeAutenticar(estado)).toBe(true);
    expect(vendedorPodeOperarComercialmente(estado)).toBe(true);
    expect(vendedorEstaEmModoRestrito(estado)).toBe(false);
  });

  it.each(['pendente', 'rejeitado', 'suspenso'] as const)(
    'permite autenticação mas restringe operações para estado %s',
    status_aprovacao => {
      const estado = { status_aprovacao, conta_ativa: true };
      expect(contaVendedorPodeAutenticar(estado)).toBe(true);
      expect(vendedorPodeOperarComercialmente(estado)).toBe(false);
      expect(vendedorEstaEmModoRestrito(estado)).toBe(true);
    },
  );

  it('mantém a conta desativada fora do sistema', () => {
    const estado = { status_aprovacao: 'rejeitado' as const, conta_ativa: false };
    expect(contaVendedorPodeAutenticar(estado)).toBe(false);
    expect(vendedorPodeOperarComercialmente(estado)).toBe(false);
    expect(vendedorEstaEmModoRestrito(estado)).toBe(false);
  });
});
