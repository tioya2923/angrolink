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
