export type EtapaEnvioCadastroVendedor =
  | 'disponibilidade'
  | 'conta'
  | 'perfil'
  | 'documentos'
  | 'sessao';

export type DiagnosticoSeguroCadastroVendedor = {
  etapa: EtapaEnvioCadastroVendedor;
  operacao: string;
  statusHttp: number | null;
  codigo: string | null;
};

function eRegisto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

export function detalhesTecnicosErroCadastroVendedor(erro: unknown) {
  if (!eRegisto(erro)) {
    return { codigo: null, mensagem: null, statusHttp: null };
  }

  return {
    codigo: typeof erro.code === 'string' ? erro.code : null,
    mensagem: typeof erro.message === 'string' ? erro.message : null,
    statusHttp: typeof erro.status === 'number' ? erro.status : null,
  };
}

export function registarDiagnosticoSeguroCadastroVendedor(
  etapa: EtapaEnvioCadastroVendedor,
  operacao: string,
  erro: unknown,
) {
  const { codigo, statusHttp } = detalhesTecnicosErroCadastroVendedor(erro);
  const diagnostico: DiagnosticoSeguroCadastroVendedor = {
    etapa,
    operacao,
    statusHttp,
    codigo,
  };

  // Intencionalmente não inclui mensagem, payload, telefone, email ou documentos.
  if (import.meta.env.DEV) {
    console.error('Diagnóstico seguro do cadastro de vendedor:', diagnostico);
  }

  return diagnostico;
}

export function mensagemErroCadastroVendedor(etapa: EtapaEnvioCadastroVendedor) {
  if (etapa === 'disponibilidade') {
    return 'Não foi possível verificar a disponibilidade dos dados. Confirma a ligação e tenta novamente.';
  }

  if (etapa === 'conta') {
    return 'Não foi possível concluir a conta. Confirma os dados e tenta novamente ou entra pela página de login.';
  }

  if (etapa === 'perfil') {
    return 'Não foi possível concluir o perfil de vendedor. Verifica os dados e tenta novamente.';
  }

  if (etapa === 'documentos') {
    return 'A conta pode ter sido criada, mas os documentos não foram confirmados. Entra novamente para concluir o envio.';
  }

  return 'Não foi possível concluir o pedido agora. Confirma a ligação e tenta novamente.';
}
