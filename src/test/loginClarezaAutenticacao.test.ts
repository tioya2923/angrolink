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
vi.mock('@/componentes/Cabecalho', () => ({ default: () => null }));
vi.mock('@/componentes/Rodape', () => ({ default: () => null }));
vi.mock('@/services/territorioAngola', () => ({
  listarProvinciasAngola: vi.fn().mockResolvedValue([]),
  listarMunicipiosAngola: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/services/supabase', () => ({ supabase: {} }));

import PaginaLogin from '@/paginas/PaginaLogin';
import PaginaCadastroParceiroEntrega from '@/paginas/PaginaCadastroParceiroEntrega';

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
    expect(login).not.toMatch(/console\.(log|debug|info|error)\(/i);
  });

  it('apresenta ajuda visível e associada ao campo sem alterar as suas propriedades', () => {
    render(createElement(MemoryRouter, null, createElement(PaginaLogin)));
    const campo = screen.getByLabelText('Email ou Telefone');
    expect(campo).toHaveAttribute('type', 'text');
    expect(campo).toHaveAttribute('required');
    expect(campo).toHaveAttribute('placeholder', 'exemplo@email.com ou 923456789');
    expect(campo).toHaveAttribute('aria-describedby', 'identificador-login-ajuda');
    const ajuda = document.getElementById('identificador-login-ajuda');
    expect(ajuda).toBeVisible();
    expect(campo).toHaveAccessibleDescription('Angola: 9 dígitos sem indicativo são interpretados com +244 (ex.: 923456789).');
    expect(screen.getByText('Acede à tua conta ANGROLINK')).toBeVisible();
    expect(screen.queryByText('Acede à tua conta de vendedor ou comprador')).not.toBeInTheDocument();
    const resumo = screen.getByText('Como entrar com email ou telefone');
    expect(resumo.tagName).toBe('SUMMARY');
    expect(resumo).toBeVisible();
    const detalhes = resumo.closest('details');
    expect(detalhes).not.toHaveAttribute('open');
    expect(screen.getByText(/Para outros países, inclui o indicativo internacional/)).not.toBeVisible();
    fireEvent.click(resumo);
    expect(detalhes).toHaveAttribute('open');
    expect(screen.getByText(/Para outros países, inclui o indicativo internacional/)).toBeVisible();
    expect(screen.getByText(/Para outros países, inclui o indicativo internacional/)).toHaveTextContent('+351912345678');
    expect(detalhes).toHaveTextContent('com ou sem + inicial');
    expect(detalhes).toHaveTextContent('número original de acesso à conta, não um contacto alterado no perfil');
    expect(detalhes).toHaveTextContent('Se a conta foi criada com email como identificador de acesso, usa esse email.');
    expect(detalhes).toHaveTextContent('Se foi criada apenas com telefone');
    expect(detalhes).toHaveTextContent('Alterar contactos do perfil não modifica o login');
    expect(detalhes).toHaveTextContent('email de contacto não permite automaticamente iniciar sessão');
    fireEvent.click(resumo);
    expect(detalhes).not.toHaveAttribute('open');
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it.each(['+244923456789', '+351912345678', 'conta@example.test'])(
    'preserva a entrada %s encaminhada para o login', async (entrada) => {
      render(createElement(MemoryRouter, null, createElement(PaginaLogin)));
      fireEvent.change(screen.getByLabelText('Email ou Telefone'), { target: { value: entrada } });
      fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-de-teste' } });
      fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
      await waitFor(() => expect(mocks.login).toHaveBeenCalledExactlyOnceWith(entrada, 'senha-de-teste'));
    },
  );

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

  it('explica o acesso no cadastro de parceiros com ajuda visível e acessível, sem submeter', async () => {
    render(createElement(MemoryRouter, null, createElement(PaginaCadastroParceiroEntrega)));
    const campo = screen.getByLabelText('Email (opcional)');
    expect(campo).toHaveAttribute('type', 'email');
    expect(campo).toHaveAttribute('maxLength', '255');
    expect(campo).not.toBeRequired();
    expect(campo).toHaveAttribute('aria-describedby', 'parceiro-cadastro-email-ajuda');
    const ajuda = document.getElementById('parceiro-cadastro-email-ajuda');
    expect(ajuda).toBeVisible();
    expect(campo).toHaveAccessibleDescription(ajuda!.textContent!);
    expect(ajuda).toHaveTextContent('iniciar sessão e recuperar a palavra-passe');
    expect(ajuda).toHaveTextContent('endereço verdadeiro que controlas');
    expect(ajuda).toHaveTextContent('nunca um email inventado ou de outra pessoa');
    expect(ajuda).toHaveTextContent('Introduzir o email não comprova a sua titularidade');
    expect(ajuda).toHaveTextContent('Sem email, o acesso inicial segue o telefone');
    expect(ajuda).toHaveTextContent('Se reutilizares uma conta existente, mantém os seus dados de acesso');
    await waitFor(() => expect(screen.queryByText('A carregar províncias...')).not.toBeInTheDocument());
    expect(mocks.login).not.toHaveBeenCalled();
    expect(mocks.enviarRecuperacaoSenha).not.toHaveBeenCalled();
  });
});
