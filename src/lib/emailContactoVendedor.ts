const TIPOS_COM_EMAIL_CONTACTO_OBRIGATORIO = new Set([
  'supermercado',
  'hipermercado',
  'grossista',
]);

const FORMATO_EMAIL_BASICO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMINIO_INTERNO_TELEFONE = '@telefone.angrolink';

export function normalizarEmailContacto(valor?: string | null): string | null {
  const email = valor?.trim().toLowerCase() ?? '';
  return email || null;
}

export function tipoVendedorExigeEmailContacto(tipo?: string | null): boolean {
  return TIPOS_COM_EMAIL_CONTACTO_OBRIGATORIO.has(tipo ?? '');
}

export function validarEmailContactoVendedor(
  tipo: string | null | undefined,
  valor?: string | null,
): string | null {
  const email = normalizarEmailContacto(valor);

  if (!email) {
    return tipoVendedorExigeEmailContacto(tipo)
      ? 'Indique um email de contacto para este tipo de vendedor.'
      : null;
  }

  if (!FORMATO_EMAIL_BASICO.test(email)) {
    return 'Indique um email de contacto válido.';
  }

  if (email.endsWith(DOMINIO_INTERNO_TELEFONE)) {
    return 'Indique um email de contacto externo; o endereço interno de telefone não pode ser usado aqui.';
  }

  return null;
}
