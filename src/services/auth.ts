import { supabase } from '@/services/supabase';

/** Operações de autenticação; componentes nunca usam o cliente Supabase diretamente. */
export async function enviarRecuperacaoSenha(email: string, redirectTo: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw error;
}
