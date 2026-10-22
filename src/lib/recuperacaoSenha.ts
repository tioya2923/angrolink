const CHAVE_RECUPERACAO_SENHA = 'angrolink_recuperacao_senha';
const DURACAO_RECUPERACAO_MS = 10 * 60 * 1000;

type ContextoRecuperacaoSenha = {
  userId: string;
  expiraEm: number;
};

function storageDisponivel() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

/**
 * Este marcador não é credencial: só reduz a reutilização local depois de o
 * SDK comunicar PASSWORD_RECOVERY. A autorização continua a ser da sessão
 * validada pelo Auth imediatamente antes da atualização.
 */
export function marcarRecuperacaoSenha(userId: string) {
  if (storageDisponivel()) {
    const contexto: ContextoRecuperacaoSenha = {
      userId,
      expiraEm: Date.now() + DURACAO_RECUPERACAO_MS,
    };
    window.sessionStorage.setItem(CHAVE_RECUPERACAO_SENHA, JSON.stringify(contexto));
  }
}

export function obterRecuperacaoSenha() {
  if (!storageDisponivel()) return null;

  try {
    const valor = window.sessionStorage.getItem(CHAVE_RECUPERACAO_SENHA);
    if (!valor) return null;
    const contexto = JSON.parse(valor) as ContextoRecuperacaoSenha;
    if (!contexto.userId || !Number.isFinite(contexto.expiraEm) || contexto.expiraEm <= Date.now()) {
      limparRecuperacaoSenha();
      return null;
    }
    return contexto;
  } catch {
    limparRecuperacaoSenha();
    return null;
  }
}

export function limparRecuperacaoSenha() {
  if (storageDisponivel()) {
    window.sessionStorage.removeItem(CHAVE_RECUPERACAO_SENHA);
  }
}
