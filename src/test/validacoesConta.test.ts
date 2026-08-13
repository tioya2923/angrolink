import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/verificacoesConta', () => ({
  verificarDuplicados: vi.fn(),
}));

import { validarSenha, validarTelefone } from '@/lib/validacoesConta';

describe('validarTelefone', () => {
  it('aceita um número angolano válido', () => {
    expect(validarTelefone('923456789', '244')).toBeNull();
  });

  it('rejeita número angolano com tamanho ou prefixo inválido', () => {
    expect(validarTelefone('823456789', '244')).toBe('Número de telefone inválido.');
    expect(validarTelefone('92345678', '244')).toBe('Número de telefone inválido.');
  });

  it('aceita número internacional e rejeita repetições', () => {
    expect(validarTelefone('912345678', '351')).toBeNull();
    expect(validarTelefone('999999999', '351')).toBe('Número de telefone inválido.');
  });
});

describe('validarSenha', () => {
  it('exige confirmação, letras e números', () => {
    expect(validarSenha('senha12', 'senha21')).toBe('As senhas não coincidem.');
    expect(validarSenha('abcdef', 'abcdef')).toBe('A senha deve ter pelo menos 6 caracteres e incluir letras e números.');
    expect(validarSenha('senha12', 'senha12')).toBeNull();
  });
});
