import { supabase } from '@/services/supabase';

export function normalizarTelefone(
  telefone: string
) {
  return telefone.replace(/\D/g, '');
}

export function telefoneCompleto(
  telefone: string
) {
  return `+244${normalizarTelefone(telefone)}`;
}

export function gerarEmailInterno(
  telefone: string
) {
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
  email?: string | null
) {

  const telefoneFormatado =
    telefoneCompleto(telefone);

  console.log('Telefone recebido:', telefone);
  console.log('Telefone formatado:', telefoneFormatado);

  const emailNormalizado =
    normalizarEmail(email);

  const { data: clienteTelefone } =
    await supabase
      .from('clientes')
      .select('id')
      .eq(
        'telefone',
        telefoneFormatado
      )
      .maybeSingle();

  const { data: vendedorTelefone } =
    await supabase
      .from('vendedores')
      .select('id')
      .eq(
        'telefone_whatsapp',
        telefoneFormatado
      )
      .maybeSingle();

      console.log('Cliente encontrado:', clienteTelefone);
      console.log('Vendedor encontrado:', vendedorTelefone);

  let clienteEmail = null;
  let clienteEmailLogin = null;

  let vendedorEmail = null;
  let vendedorEmailLogin = null;

  if (emailNormalizado) {

    ({ data: clienteEmail } =
      await supabase
        .from('clientes')
        .select('id')
        .eq('email', emailNormalizado)
        .maybeSingle());

    ({ data: clienteEmailLogin } =
      await supabase
        .from('clientes')
        .select('id')
        .eq('email_login', emailNormalizado)
        .maybeSingle());

    ({ data: vendedorEmail } =
      await supabase
        .from('vendedores')
        .select('id')
        .eq('email', emailNormalizado)
        .maybeSingle());

    ({ data: vendedorEmailLogin } =
      await supabase
        .from('vendedores')
        .select('id')
        .eq('email_login', emailNormalizado)
        .maybeSingle());

  }

  console.log('========================');
  console.log('Telefone recebido:', telefone);
  console.log('Telefone formatado:', telefoneFormatado);
  console.log('Email:', emailNormalizado);

  console.log('clienteTelefone:', clienteTelefone);
  console.log('vendedorTelefone:', vendedorTelefone);

  console.log('clienteEmail:', clienteEmail);
  console.log('vendedorEmail:', vendedorEmail);

  console.log('========================');

  return {

    telefoneExiste:
      !!clienteTelefone ||
      !!vendedorTelefone,

    emailExiste:
      !!clienteEmail ||
      !!clienteEmailLogin ||
      !!vendedorEmail ||
      !!vendedorEmailLogin,

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