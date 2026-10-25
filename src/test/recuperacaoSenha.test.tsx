import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  callbackAuth: null as null | ((evento: string, sessao: { user: { id: string } } | null) => void),
  getUser: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
  toast: vi.fn(),
}));

const CHAVE_RECUPERACAO = 'angrolink_recuperacao_senha';

vi.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
      verifyOtp: mocks.verifyOtp,
      updateUser: mocks.updateUser,
      signOut: mocks.signOut,
      onAuthStateChange: (callback: typeof mocks.callbackAuth) => {
        mocks.callbackAuth = callback;
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      },
    },
  },
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));

import PaginaResetPassword from '@/paginas/PaginaResetPassword';

function DestinoLogin() {
  const location = useLocation();
  return <p data-testid="destino-login">{location.pathname}</p>;
}

function renderizar() {
  return render(
    <MemoryRouter initialEntries={['/reset-password']}>
      <Routes>
        <Route path="/reset-password" element={<PaginaResetPassword />} />
        <Route path="/login" element={<DestinoLogin />} />
      </Routes>
    </MemoryRouter>,
  );
}

function emitirRecuperacao(id = 'auth-recuperacao') {
  act(() => {
    mocks.callbackAuth?.('PASSWORD_RECOVERY', { user: { id } });
  });
}

describe('recuperação segura de palavra-passe', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    mocks.callbackAuth = null;
    mocks.getUser.mockReset();
    mocks.verifyOtp.mockReset();
    mocks.updateUser.mockReset();
    mocks.signOut.mockReset().mockResolvedValue({ error: null });
    mocks.unsubscribe.mockReset();
    mocks.toast.mockReset();
  });

  it('verifica OTP, remove espacos e habilita apenas a identidade devolvida pelo Auth', async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { user: { id: 'auth-otp' }, session: { user: { id: 'auth-otp' } } },
      error: null,
    });
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-otp' } }, error: null });
    renderizar();
    await screen.findByLabelText('Email de acesso');

    fireEvent.change(screen.getByLabelText('Email de acesso'), { target: { value: '  TESTE@EXEMPLO.COM ' } });
    fireEvent.change(screen.getByLabelText('Codigo de recuperacao'), { target: { value: '123 456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar codigo' }));

    await waitFor(() => expect(mocks.verifyOtp).toHaveBeenCalledWith({
      email: 'teste@exemplo.com',
      token: '123456',
      type: 'recovery',
    }));
    expect(await screen.findByLabelText('Nova palavra-passe')).toBeTruthy();
    expect(JSON.parse(window.sessionStorage.getItem(CHAVE_RECUPERACAO) || '{}')).toMatchObject({
      userId: 'auth-otp',
    });
  });

  it('preserva a recuperacao quando USER_UPDATED da mesma identidade ocorre durante updateUser', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-recuperacao' } }, error: null });
    let concluirAtualizacao: ((value: unknown) => void) | undefined;
    mocks.updateUser.mockReturnValue(new Promise((resolve) => { concluirAtualizacao = resolve; }));
    renderizar();
    emitirRecuperacao();
    await screen.findByLabelText('Nova palavra-passe');

    fireEvent.change(screen.getByLabelText('Nova palavra-passe'), { target: { value: 'senha-nova' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova palavra-passe'), { target: { value: 'senha-nova' } });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar palavra-passe' }));
    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));

    act(() => {
      mocks.callbackAuth?.('USER_UPDATED', { user: { id: 'auth-recuperacao' } });
    });
    expect(screen.getByLabelText('Nova palavra-passe')).toBeTruthy();

    concluirAtualizacao?.({ data: { user: { id: 'auth-recuperacao' } }, error: null });
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1));
    expect(window.sessionStorage.getItem(CHAVE_RECUPERACAO)).toBeNull();
    expect(await screen.findByTestId('destino-login')).toHaveTextContent('/login');
  });

  it('invalida a recuperacao se USER_UPDATED for de outra identidade durante updateUser', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-recuperacao' } }, error: null });
    let concluirAtualizacao: ((value: unknown) => void) | undefined;
    mocks.updateUser.mockReturnValue(new Promise((resolve) => { concluirAtualizacao = resolve; }));
    renderizar();
    emitirRecuperacao();
    await screen.findByLabelText('Nova palavra-passe');

    fireEvent.change(screen.getByLabelText('Nova palavra-passe'), { target: { value: 'senha-nova' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova palavra-passe'), { target: { value: 'senha-nova' } });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar palavra-passe' }));
    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));

    act(() => {
      mocks.callbackAuth?.('USER_UPDATED', { user: { id: 'outra-identidade' } });
    });
    expect(await screen.findByLabelText('Email de acesso')).toBeTruthy();

    concluirAtualizacao?.({ data: { user: { id: 'auth-recuperacao' } }, error: null });
    await waitFor(() => expect(mocks.signOut).not.toHaveBeenCalled());
  });

  it('rejeita email sintetico, formato invalido e codigo nao numerico antes de chamar o Auth', async () => {
    renderizar();
    await screen.findByLabelText('Email de acesso');

    fireEvent.change(screen.getByLabelText('Email de acesso'), { target: { value: '123@TELEFONE.ANGROLINK' } });
    fireEvent.change(screen.getByLabelText('Codigo de recuperacao'), { target: { value: '12 3x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar codigo' }));

    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Dados de recuperacao invalidos',
      variant: 'destructive',
    }));
  });

  it('rejeita OTP invalido ou expirado sem habilitar a atualizacao', async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: new Error('expired') });
    renderizar();
    await screen.findByLabelText('Email de acesso');

    fireEvent.change(screen.getByLabelText('Email de acesso'), { target: { value: 'teste@exemplo.com' } });
    fireEvent.change(screen.getByLabelText('Codigo de recuperacao'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar codigo' }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Codigo de recuperacao invalido ou expirado',
      variant: 'destructive',
    })));
    expect(screen.queryByLabelText('Nova palavra-passe')).toBeNull();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('nao atualiza se a sessao devolvida pelo OTP for substituida antes da revalidacao', async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { user: { id: 'auth-a' }, session: { user: { id: 'auth-a' } } },
      error: null,
    });
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-b' } }, error: null });
    renderizar();
    await screen.findByLabelText('Email de acesso');

    fireEvent.change(screen.getByLabelText('Email de acesso'), { target: { value: 'teste@exemplo.com' } });
    fireEvent.change(screen.getByLabelText('Codigo de recuperacao'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar codigo' }));

    expect(await screen.findByLabelText('Email de acesso')).toBeTruthy();
    expect(screen.queryByLabelText('Nova palavra-passe')).toBeNull();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('nao envia duas verificacoes OTP concorrentes', async () => {
    let concluirVerificacao: ((value: unknown) => void) | undefined;
    mocks.verifyOtp.mockReturnValue(new Promise((resolve) => { concluirVerificacao = resolve; }));
    renderizar();
    await screen.findByLabelText('Email de acesso');

    fireEvent.change(screen.getByLabelText('Email de acesso'), { target: { value: 'teste@exemplo.com' } });
    fireEvent.change(screen.getByLabelText('Codigo de recuperacao'), { target: { value: '123456' } });
    const botao = screen.getByRole('button', { name: 'Verificar codigo' });
    fireEvent.click(botao);
    fireEvent.click(botao);

    await waitFor(() => expect(mocks.verifyOtp).toHaveBeenCalledTimes(1));
    concluirVerificacao?.({
      data: { user: null, session: null },
      error: new Error('expired'),
    });
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Codigo de recuperacao invalido ou expirado',
    })));
  });

  it('não aceita uma sessão de login normal como contexto de recuperação', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'sessao-normal' } }, error: null });
    renderizar();

    expect(await screen.findByText('Este link de recuperação é inválido, expirou ou já foi utilizado.')).toBeTruthy();
    expect(screen.queryByLabelText('Nova palavra-passe')).toBeNull();
  });

  it('aceita apenas PASSWORD_RECOVERY com a mesma identidade Auth da sessão', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-recuperacao' } }, error: null });
    renderizar();
    emitirRecuperacao();

    expect(await screen.findByLabelText('Nova palavra-passe')).toBeTruthy();
    expect(JSON.parse(window.sessionStorage.getItem(CHAVE_RECUPERACAO) || '{}')).toMatchObject({
      userId: 'auth-recuperacao',
    });
  });

  it('rejeita link expirado ou inválido quando a sessão não corresponde ao contexto recebido', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'outra-sessao' } }, error: null });
    renderizar();
    emitirRecuperacao('auth-recuperacao');

    expect(await screen.findByText('Este link de recuperação é inválido, expirou ou já foi utilizado.')).toBeTruthy();
    expect(window.sessionStorage.getItem(CHAVE_RECUPERACAO)).toBeNull();
  });

  it('valida tamanho e confirmação antes de atualizar a identidade Auth', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-recuperacao' } }, error: null });
    renderizar();
    emitirRecuperacao();
    await screen.findByLabelText('Nova palavra-passe');

    fireEvent.change(screen.getByLabelText('Nova palavra-passe'), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova palavra-passe'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar palavra-passe' }));
    expect(mocks.updateUser).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Nova palavra-passe'), { target: { value: 'senha-nova' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova palavra-passe'), { target: { value: 'senha-outra' } });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar palavra-passe' }));
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Palavras-passe diferentes' }));
  });

  it('atualiza a palavra-passe, preserva UUID, consome o contexto e encaminha ao login', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-recuperacao' } }, error: null });
    mocks.updateUser.mockResolvedValue({ data: { user: { id: 'auth-recuperacao' } }, error: null });
    renderizar();
    emitirRecuperacao();
    await screen.findByLabelText('Nova palavra-passe');

    fireEvent.change(screen.getByLabelText('Nova palavra-passe'), { target: { value: 'senha-nova' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova palavra-passe'), { target: { value: 'senha-nova' } });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar palavra-passe' }));

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'senha-nova' }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1));
    expect(window.sessionStorage.getItem(CHAVE_RECUPERACAO)).toBeNull();
    expect(await screen.findByTestId('destino-login')).toHaveTextContent('/login');
  });

  it('consome o contexto quando updateUser falha', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-recuperacao' } }, error: null });
    mocks.updateUser.mockResolvedValue({ data: { user: null }, error: new Error('falha') });
    renderizar();
    emitirRecuperacao();
    await screen.findByLabelText('Nova palavra-passe');

    fireEvent.change(screen.getByLabelText('Nova palavra-passe'), { target: { value: 'senha-nova' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova palavra-passe'), { target: { value: 'senha-nova' } });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar palavra-passe' }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Não foi possível atualizar a palavra-passe',
      variant: 'destructive',
    })));
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(CHAVE_RECUPERACAO)).toBeNull();
  });

  it('mantém a recuperação para o erro Auth comprovado de password igual', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-recuperacao' } }, error: null });
    mocks.updateUser.mockResolvedValue({
      data: { user: null },
      error: Object.assign(new Error('New password should be different from the old password.'), { status: 422 }),
    });
    renderizar();
    emitirRecuperacao();
    await screen.findByLabelText('Nova palavra-passe');

    fireEvent.change(screen.getByLabelText('Nova palavra-passe'), { target: { value: 'senha-atual' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova palavra-passe'), { target: { value: 'senha-atual' } });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar palavra-passe' }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'A nova palavra-passe deve ser diferente da atual',
      variant: 'destructive',
    })));
    expect(window.sessionStorage.getItem(CHAVE_RECUPERACAO)).not.toBeNull();
    expect(screen.getByLabelText('Nova palavra-passe')).toBeTruthy();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('mantém a recuperação quando o Auth identifica a password igual pelo código estável', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-recuperacao' } }, error: null });
    mocks.updateUser.mockResolvedValue({
      data: { user: null },
      error: Object.assign(new Error('Mensagem do servidor pode variar.'), { status: 422, code: 'same_password' }),
    });
    renderizar();
    emitirRecuperacao();
    await screen.findByLabelText('Nova palavra-passe');

    fireEvent.change(screen.getByLabelText('Nova palavra-passe'), { target: { value: 'senha-atual' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova palavra-passe'), { target: { value: 'senha-atual' } });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar palavra-passe' }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'A nova palavra-passe deve ser diferente da atual',
      variant: 'destructive',
    })));
    expect(window.sessionStorage.getItem(CHAVE_RECUPERACAO)).not.toBeNull();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('continua a consumir o contexto para outro erro 422', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-recuperacao' } }, error: null });
    mocks.updateUser.mockResolvedValue({
      data: { user: null },
      error: Object.assign(new Error('Outro erro de validação.'), { status: 422 }),
    });
    renderizar();
    emitirRecuperacao();
    await screen.findByLabelText('Nova palavra-passe');

    fireEvent.change(screen.getByLabelText('Nova palavra-passe'), { target: { value: 'senha-nova' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova palavra-passe'), { target: { value: 'senha-nova' } });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar palavra-passe' }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Não foi possível atualizar a palavra-passe',
      variant: 'destructive',
    })));
    expect(window.sessionStorage.getItem(CHAVE_RECUPERACAO)).toBeNull();
  });

  it('não atualiza a palavra-passe quando a sessão A foi substituída por B antes da submissão', async () => {
    mocks.getUser
      .mockResolvedValueOnce({ data: { user: { id: 'auth-a' } }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: 'auth-b' } }, error: null });
    renderizar();
    emitirRecuperacao('auth-a');
    await screen.findByLabelText('Nova palavra-passe');

    fireEvent.change(screen.getByLabelText('Nova palavra-passe'), { target: { value: 'senha-nova' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova palavra-passe'), { target: { value: 'senha-nova' } });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar palavra-passe' }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Não foi possível atualizar a palavra-passe',
      variant: 'destructive',
    })));
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(CHAVE_RECUPERACAO)).toBeNull();
  });

  it('invalida o contexto de recuperação após um login normal, mesmo da mesma identidade', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-recuperacao' } }, error: null });
    renderizar();
    emitirRecuperacao();
    await screen.findByLabelText('Nova palavra-passe');

    act(() => {
      mocks.callbackAuth?.('SIGNED_IN', { user: { id: 'auth-recuperacao' } });
    });
    expect(await screen.findByText('Este link de recuperação é inválido, expirou ou já foi utilizado.')).toBeTruthy();
    expect(window.sessionStorage.getItem(CHAVE_RECUPERACAO)).toBeNull();
  });

  it('expira um marcador antigo sem aceitar a sessão persistida', async () => {
    window.sessionStorage.setItem(CHAVE_RECUPERACAO, JSON.stringify({
      userId: 'auth-recuperacao',
      expiraEm: Date.now() - 1,
    }));
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-recuperacao' } }, error: null });
    renderizar();

    expect(await screen.findByText('Este link de recuperação é inválido, expirou ou já foi utilizado.')).toBeTruthy();
    expect(window.sessionStorage.getItem(CHAVE_RECUPERACAO)).toBeNull();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('invalida o contexto quando ocorre logout durante a recuperação', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-recuperacao' } }, error: null });
    renderizar();
    emitirRecuperacao();
    await screen.findByLabelText('Nova palavra-passe');

    act(() => {
      mocks.callbackAuth?.('SIGNED_OUT', null);
    });
    expect(await screen.findByText('Este link de recuperação é inválido, expirou ou já foi utilizado.')).toBeTruthy();
    expect(window.sessionStorage.getItem(CHAVE_RECUPERACAO)).toBeNull();
  });

  it('mantém a recuperação ativa durante TOKEN_REFRESHED da mesma identidade', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-recuperacao' } }, error: null });
    renderizar();
    emitirRecuperacao();
    await screen.findByLabelText('Nova palavra-passe');

    act(() => {
      mocks.callbackAuth?.('TOKEN_REFRESHED', { user: { id: 'auth-recuperacao' } });
    });

    expect(await screen.findByLabelText('Nova palavra-passe')).toBeTruthy();
    expect(JSON.parse(window.sessionStorage.getItem(CHAVE_RECUPERACAO) || '{}')).toMatchObject({
      userId: 'auth-recuperacao',
    });
  });

  it('invalida a recuperação em TOKEN_REFRESHED de outra identidade e em USER_UPDATED', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-recuperacao' } }, error: null });
    renderizar();
    emitirRecuperacao();
    await screen.findByLabelText('Nova palavra-passe');

    act(() => {
      mocks.callbackAuth?.('TOKEN_REFRESHED', { user: { id: 'outra-identidade' } });
    });
    expect(await screen.findByText('Este link de recuperação é inválido, expirou ou já foi utilizado.')).toBeTruthy();

    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-recuperacao' } }, error: null });
    emitirRecuperacao();
    await screen.findByLabelText('Nova palavra-passe');
    act(() => {
      mocks.callbackAuth?.('USER_UPDATED', { user: { id: 'auth-recuperacao' } });
    });
    expect(await screen.findByText('Este link de recuperação é inválido, expirou ou já foi utilizado.')).toBeTruthy();
  });

  it('permite PASSWORD_RECOVERY posterior a INITIAL_SESSION, que não é autorização de recuperação', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-recuperacao' } }, error: null });
    renderizar();
    act(() => {
      mocks.callbackAuth?.('INITIAL_SESSION', { user: { id: 'auth-recuperacao' } });
    });
    expect(await screen.findByText('Este link de recuperação é inválido, expirou ou já foi utilizado.')).toBeTruthy();

    emitirRecuperacao();
    expect(await screen.findByLabelText('Nova palavra-passe')).toBeTruthy();
  });

  it('não permite duas submissões concorrentes para a mesma recuperação', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-recuperacao' } }, error: null });
    let concluirAtualizacao: ((value: unknown) => void) | undefined;
    mocks.updateUser.mockReturnValue(new Promise((resolve) => { concluirAtualizacao = resolve; }));
    renderizar();
    emitirRecuperacao();
    await screen.findByLabelText('Nova palavra-passe');

    fireEvent.change(screen.getByLabelText('Nova palavra-passe'), { target: { value: 'senha-nova' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova palavra-passe'), { target: { value: 'senha-nova' } });
    const botao = screen.getByRole('button', { name: 'Atualizar palavra-passe' });
    fireEvent.click(botao);
    fireEvent.click(botao);

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));
    concluirAtualizacao?.({ data: { user: { id: 'auth-recuperacao' } }, error: null });
    await screen.findByTestId('destino-login');
  });

  it('não atualiza quando getUser falha imediatamente antes da atualização', async () => {
    mocks.getUser
      .mockResolvedValueOnce({ data: { user: { id: 'auth-recuperacao' } }, error: null })
      .mockResolvedValueOnce({ data: { user: null }, error: new Error('sessão expirada') });
    renderizar();
    emitirRecuperacao();
    await screen.findByLabelText('Nova palavra-passe');

    fireEvent.change(screen.getByLabelText('Nova palavra-passe'), { target: { value: 'senha-nova' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova palavra-passe'), { target: { value: 'senha-nova' } });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar palavra-passe' }));

    await waitFor(() => expect(mocks.updateUser).not.toHaveBeenCalled());
    expect(window.sessionStorage.getItem(CHAVE_RECUPERACAO)).toBeNull();
  });
});
