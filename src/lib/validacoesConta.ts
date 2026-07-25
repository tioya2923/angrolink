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
  telefone: string
) {
  if (!/^\d{9}$/.test(telefone)) {
    return 'Número de telefone inválido.';
  }

  if (!telefone.startsWith('9')) {
    return 'Número de telefone inválido.';
  }

  if (/^(\d)\1{8}$/.test(telefone)) {
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
  email?: string | null
) {
  const resultado = await verificarDuplicados(
    telefone,
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