import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  callbackAuth: null as null | ((evento: string, sessao: { user: { id: string } } | null) => void),
  getUser: vi.fn(),
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
    mocks.updateUser.mockReset();
    mocks.signOut.mockReset().mockResolvedValue({ error: null });
    mocks.unsubscribe.mockReset();
    mocks.toast.mockReset();
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

  it('não consome o contexto quando updateUser falha', async () => {
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
    expect(JSON.parse(window.sessionStorage.getItem(CHAVE_RECUPERACAO) || '{}')).toMatchObject({
      userId: 'auth-recuperacao',
    });
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
