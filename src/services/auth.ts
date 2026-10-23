import { supabase } from '@/services/supabase';

const EMAIL_ACESSO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A recuperação só aceita um email Auth utilizável, nunca o identificador interno de telefone. */
export function normalizarEmailAcessoParaRecuperacao(valor: string) {
  const email = valor.trim().toLowerCase();

  if (!EMAIL_ACESSO_REGEX.test(email) || email.endsWith('@telefone.angrolink')) {
    return null;
  }

  return email;
}

/** Operações de autenticação; componentes nunca usam o cliente Supabase diretamente. */
export async function enviarRecuperacaoSenha(email: string, redirectTo: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw error;
}

/**
 * Valida no Auth um codigo recebido por email. O codigo nao e guardado: a
 * autorizacao seguinte depende exclusivamente da sessao devolvida pelo Auth,
 * que a pagina revalida antes de atualizar a palavra-passe.
 */
export async function verificarCodigoRecuperacaoSenha(email: string, codigo: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: codigo,
    type: 'recovery',
  });

  if (
    error ||
    !data.user ||
    !data.session?.user ||
    data.user.id !== data.session.user.id
  ) {
    throw error || new Error('RECUPERACAO_OTP_SESSAO_INVALIDA');
  }

  return data.user.id;
}

export type ResultadoAlteracaoPassword =
  | { sucesso: true }
  | { sucesso: false; motivo: 'sessao_invalida' | 'senha_atual_incorreta' };

/**
 * Reautentica a identidade Auth atual antes de alterar a palavra-passe.
 *
 * O email de contacto dos perfis de domínio não é uma credencial: a fonte
 * autoritativa é o utilizador devolvido por Auth para a sessão atual.
 */
export async function alterarPasswordDaSessao(
  userIdEsperado: string,
  senhaAtual: string,
  novaSenha: string,
): Promise<ResultadoAlteracaoPassword> {
  const { data: dadosSessao, error: erroSessao } = await supabase.auth.getUser();
  const authUser = dadosSessao.user;

  if (
    erroSessao ||
    !authUser ||
    authUser.id !== userIdEsperado ||
    !authUser.email
  ) {
    return { sucesso: false, motivo: 'sessao_invalida' };
  }

  const { data: dadosReautenticacao, error: erroReautenticacao } =
    await supabase.auth.signInWithPassword({
      email: authUser.email,
      password: senhaAtual,
    });

  if (
    erroReautenticacao ||
    dadosReautenticacao.user?.id !== authUser.id
  ) {
    return { sucesso: false, motivo: 'senha_atual_incorreta' };
  }

  const { error: erroAtualizacao } = await supabase.auth.updateUser({
    password: novaSenha,
  });

  if (erroAtualizacao) throw erroAtualizacao;

  return { sucesso: true };
}
