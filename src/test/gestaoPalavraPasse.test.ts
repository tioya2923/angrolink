import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('@/services/supabase', () => ({
  supabase: { auth },
}));

import { alterarPasswordDaSessao } from '@/services/auth';

const clienteDefinicoes = readFileSync(
  resolve(process.cwd(), 'src/paginas/dashboard/cliente/ClienteDefinicoes.tsx'),
  'utf8',
);
const vendedorPerfil = readFileSync(
  resolve(process.cwd(), 'src/paginas/dashboard/vendedor/VendedorPerfil.tsx'),
  'utf8',
);

describe('gestão de palavra-passe pela identidade Auth', () => {
  beforeEach(() => {
    auth.getUser.mockReset();
    auth.signInWithPassword.mockReset();
    auth.updateUser.mockReset();
  });

  function prepararSessao(id: string, emailAuth: string) {
    auth.getUser.mockResolvedValue({ data: { user: { id, email: emailAuth } }, error: null });
    auth.signInWithPassword.mockResolvedValue({ data: { user: { id } }, error: null });
    auth.updateUser.mockResolvedValue({ error: null });
  }

  it.each([
    ['vendedor', 'vendedor-auth-id', '244923456789@telefone.angrolink', 'contacto@loja.ao'],
    ['comprador', 'cliente-auth-id', '244923456788@telefone.angrolink', 'contacto@cliente.ao'],
  ])('reautentica %s pelo email Auth sintético, nunca pelo email de contacto', async (
    _papel,
    id,
    emailAuth,
    emailContacto,
  ) => {
    prepararSessao(id, emailAuth);

    const resultado = await alterarPasswordDaSessao(id, 'senha-atual', 'senha-nova');

    expect(resultado).toEqual({ sucesso: true });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: emailAuth,
      password: 'senha-atual',
    });
    expect(auth.signInWithPassword).not.toHaveBeenCalledWith(expect.objectContaining({ email: emailContacto }));
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'senha-nova' });
  });

  it('mantém compatibilidade com uma conta cujo email Auth já é real', async () => {
    prepararSessao('parceiro-auth-id', 'acesso@parceiro.ao');

    const resultado = await alterarPasswordDaSessao(
      'parceiro-auth-id',
      'senha-atual',
      'senha-nova',
    );

    expect(resultado).toEqual({ sucesso: true });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'acesso@parceiro.ao',
      password: 'senha-atual',
    });
  });

  it('não altera a senha quando a palavra-passe atual está incorreta', async () => {
    auth.getUser.mockResolvedValue({
      data: { user: { id: 'vendedor-auth-id', email: '244923456789@telefone.angrolink' } },
      error: null,
    });
    auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: new Error('credenciais inválidas') });

    await expect(alterarPasswordDaSessao('vendedor-auth-id', 'errada', 'senha-nova'))
      .resolves.toEqual({ sucesso: false, motivo: 'senha_atual_incorreta' });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('recusa sessão trocada antes de reautenticar ou atualizar', async () => {
    auth.getUser.mockResolvedValue({
      data: { user: { id: 'outra-conta', email: 'acesso@outra.ao' } },
      error: null,
    });

    await expect(alterarPasswordDaSessao('vendedor-auth-id', 'senha-atual', 'senha-nova'))
      .resolves.toEqual({ sucesso: false, motivo: 'sessao_invalida' });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('propaga erro de atualização sem trocar email ou identidade Auth', async () => {
    prepararSessao('vendedor-auth-id', '244923456789@telefone.angrolink');
    auth.updateUser.mockResolvedValueOnce({ error: new Error('falha de atualização') });

    await expect(alterarPasswordDaSessao(
      'vendedor-auth-id',
      'senha-atual',
      'senha-nova',
    )).rejects.toThrow('falha de atualização');

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: '244923456789@telefone.angrolink',
      password: 'senha-atual',
    });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'senha-nova' });
  });

  it('faz os dois ecrãs usarem o helper em vez do email do perfil', () => {
    for (const pagina of [clienteDefinicoes, vendedorPerfil]) {
      const inicio = pagina.indexOf('async function handleAlterarPassword');
      const bloco = pagina.slice(inicio, pagina.indexOf('} finally {', inicio));

      expect(bloco).toContain('alterarPasswordDaSessao(');
      expect(bloco).not.toContain('signInWithPassword({');
      expect(bloco).not.toContain('email: utilizador.email');
    }
  });
});
