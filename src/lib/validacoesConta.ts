import { verificarDuplicados } from './verificacoesConta';

export function validarSenha(
  senha: string,
  confirmarSenha: string
) {
  if (senha !== confirmarSenha) {
    return 'As senhas não coincidem.';
  }

  const regex =
    /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

  if (!regex.test(senha)) {
    return 'A senha deve ter pelo menos 6 caracteres e incluir letras e números.';
  }

  return null;
}

export function validarTelefone(
  telefone: string,
  indicativo: string = '244'
) {
  // Angola: mantém a validação estrita (9 dígitos, começa por 9).
  if (indicativo === '244') {
    if (!/^\d{9}$/.test(telefone)) {
      return 'Número de telefone inválido.';
    }

    if (!telefone.startsWith('9')) {
      return 'Número de telefone inválido.';
    }
  } else if (!/^\d{4,14}$/.test(telefone)) {
    // Outros países: intervalo genérico de dígitos (padrão E.164).
    return 'Número de telefone inválido.';
  }

  if (/^(\d)\1+$/.test(telefone)) {
    return 'Número de telefone inválido.';
  }

  const proibidos = [
    '123456789',
    '987654321',
    '123123123',
    '111222333',
  ];

  if (proibidos.includes(telefone)) {
    return 'Número de telefone inválido.';
  }

  return null;
}

export async function validarDuplicados(
  telefone: string,
  indicativo: string,
  email?: string | null
) {
  const resultado = await verificarDuplicados(
    telefone,
    indicativo,
    email
  );

  if (
    resultado.telefoneExiste &&
    resultado.emailExiste
  ) {
    return 'Já existe uma conta com este número de telefone e este email.';
  }

  if (resultado.telefoneExiste) {
    return 'Já existe uma conta com este número de telefone.';
  }

  if (resultado.emailExiste) {
    return 'Já existe uma conta com este email.';
  }

  return null;
}