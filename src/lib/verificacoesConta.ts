import { supabase } from '@/services/supabase';

export function normalizarTelefone(
  telefone: string
) {
  return telefone.replace(/\D/g, '');
}

export function telefoneCompleto(
  telefone: string,
  indicativo: string = '244'
) {
  return `+${indicativo}${normalizarTelefone(telefone)}`;
}

export function gerarEmailInterno(
  telefone: string,
  indicativo?: string
) {
  if (indicativo) {
    return `${normalizarTelefone(indicativo)}${normalizarTelefone(telefone)}@telefone.angrolink`;
  }

  let numero = normalizarTelefone(telefone);

  // Se vier apenas com os 9 dígitos,
  // acrescenta automaticamente o código de Angola.
  if (numero.length === 9) {
    numero = `244${numero}`;
  }

  return `${numero}@telefone.angrolink`;
}

export function normalizarEmail(
  email?: string | null
) {
  return email
    ?.trim()
    .toLowerCase() || null;
}

export async function verificarDuplicados(
  telefone: string,
  indicativo: string = '244',
  email?: string | null
) {

  const telefoneFormatado =
    telefoneCompleto(telefone, indicativo);

  const emailNormalizado =
    normalizarEmail(email);

  const { data, error } = await supabase.rpc(
    'verificar_disponibilidade_cadastro',
    {
      p_telefone: telefoneFormatado,
      p_email: emailNormalizado ?? undefined,
    },
  );

  if (error) {
    throw new Error('Não foi possível verificar a disponibilidade dos dados de cadastro.');
  }

  const resultado = data?.[0];

  return {
    telefoneExiste: resultado?.telefone_existe === true,
    emailExiste: resultado?.email_existe === true,
  };

}

export function normalizarIdentificadorLogin(
  identificador: string
) {
  let valor = identificador
    .trim()
    .toLowerCase();

  // Remove espaços
  valor = valor.replace(/\s+/g, '');

  // Remove +
  if (valor.startsWith('+')) {
    valor = valor.substring(1);
  }

  // Se vier com 244XXXXXXXXX
  if (
    valor.startsWith('244') &&
    valor.length === 12
  ) {
    valor = valor.substring(3);
  }

  return valor;
}
