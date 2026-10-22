import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  enviarRecuperacaoSenha: vi.fn(),
  login: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/services/auth', () => ({
  enviarRecuperacaoSenha: mocks.enviarRecuperacaoSenha,
  normalizarEmailAcessoParaRecuperacao: (valor: string) => {
    const email = valor.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.endsWith('@telefone.angrolink')
      ? email
      : null;
  },
}));
vi.mock('@/contextos/AuthContexto', () => ({
  useAuth: () => ({ autenticado: false, login: mocks.login }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));

import PaginaLogin from '@/paginas/PaginaLogin';

const login = readFileSync(resolve(process.cwd(), 'src/paginas/PaginaLogin.tsx'), 'utf8');
const anunciar = readFileSync(resolve(process.cwd(), 'src/paginas/PaginaAnunciar.tsx'), 'utf8');
const perfilVendedor = readFileSync(resolve(process.cwd(), 'src/paginas/dashboard/vendedor/VendedorPerfil.tsx'), 'utf8');
const parceiro = readFileSync(resolve(process.cwd(), 'src/paginas/PaginaCadastroParceiroEntrega.tsx'), 'utf8');
const tiposVendedor = readFileSync(resolve(process.cwd(), 'src/dados/constantes.ts'), 'utf8');

describe('clareza de autenticação e email de contacto', () => {
  beforeEach(() => {
    mocks.enviarRecuperacaoSenha.mockReset();
    mocks.login.mockReset().mockResolvedValue(false);
    mocks.toast.mockReset();
  });

  function abrirRecuperacao() {
    render(createElement(MemoryRouter, null, createElement(PaginaLogin)));
    fireEvent.click(screen.getByRole('button', { name: 'Esqueceste a senha?' }));
  }

  it('mantém o login por telefone e não regista o identificador ou a senha', async () => {
    render(createElement(MemoryRouter, null, createElement(PaginaLogin)));
    fireEvent.change(screen.getByLabelText('Email ou Telefone'), { target: { value: '923456789' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-segura' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(mocks.login).toHaveBeenCalledWith('923456789', 'senha-segura'));
    expect(login).toContain('Email ou Telefone');
    expect(login).toContain('Se criou a conta com telefone, entre com esse número.');
    expect(login).not.toMatch(/console\.(log|debug|info|error)\(/i);
  });

  it.each(['923456789', '244923456789@telefone.angrolink'])('não chama recuperação para %s', (entrada) => {
    abrirRecuperacao();
    fireEvent.change(screen.getByLabelText('Email de acesso'), { target: { value: entrada } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }));

    expect(mocks.enviarRecuperacaoSenha).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Insere um email de acesso válido.',
      variant: 'destructive',
    }));
  });

  it('pede recuperação por email Auth válido e apresenta resposta genérica', async () => {
    mocks.enviarRecuperacaoSenha.mockResolvedValueOnce(undefined);
    abrirRecuperacao();
    fireEvent.change(screen.getByLabelText('Email de acesso'), { target: { value: ' CONTA@EXEMPLO.AO ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }));

    await waitFor(() => expect(mocks.enviarRecuperacaoSenha).toHaveBeenCalledWith(
      'conta@exemplo.ao',
      `${window.location.origin}/reset-password`,
    ));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Pedido de recuperação registado',
    }));
  });

  it('não apresenta sucesso falso quando o envio falha', async () => {
    mocks.enviarRecuperacaoSenha.mockRejectedValueOnce(new Error('falha de entrega'));
    abrirRecuperacao();
    fireEvent.change(screen.getByLabelText('Email de acesso'), { target: { value: 'conta@exemplo.ao' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Não foi possível processar o pedido',
      variant: 'destructive',
    })));
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Pedido de recuperação registado' }));
  });

  it('distingue email de contacto dos dados de acesso nos formulários legados', () => {
    expect(anunciar).toContain('Email de contacto (opcional)');
    expect(anunciar).toContain('Este email é usado para contacto. Adicioná-lo ao perfil não altera os dados de acesso à conta.');
    expect(perfilVendedor).toContain('Email de contacto');
    expect(perfilVendedor).toContain('Alterá-lo não altera os dados de acesso à conta.');
  });

  it('mantém o email de contacto opcional para ambulante/zungueira', () => {
    const inicio = anunciar.indexOf('Email de contacto (opcional)', anunciar.indexOf('Campos opcionais gerais'));
    const campo = anunciar.slice(inicio, anunciar.indexOf('maxLength={255}', inicio));

    expect(tiposVendedor).toContain("valor: 'ambulante'");
    expect(tiposVendedor).toContain('Vendedora Ambulante / Zungueira');
    expect(campo).toContain('value={formPerfil.email}');
    expect(campo).not.toContain('required');
  });

  it('mantém o email opcional do parceiro como email Auth, sem o reclassificar como contacto', () => {
    expect(parceiro).toContain('const authEmail = emailOpcional || emailLogin;');
    expect(parceiro).toContain('email: authEmail,');
  });
});
