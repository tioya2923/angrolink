export type DadosRenovacaoDocumentoParceiro = {
  numeroDocumento?: string;
  validade: string;
};

function hojeCivilIso(data = new Date()): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function validarNovaValidadeDocumento(
  validade: string,
  validadeAnterior: string | null,
  hoje = hojeCivilIso(),
): string | null {
  if (!validade) return 'Indique a nova validade do documento.';
  if (validade <= hoje) return 'A nova validade deve ser posterior à data de hoje.';
  if (validadeAnterior && validade <= validadeAnterior) {
    return 'A nova validade deve ser posterior à validade anterior.';
  }
  return null;
}

export function mensagemErroReenvioDocumento(mensagem: string): string {
  if (mensagem.includes('Indique a nova validade')) return 'Indique a nova validade para renovar este documento.';
  if (mensagem.includes('A nova validade deve ser posterior')) return 'Escolha uma validade futura e posterior à validade anterior.';
  if (mensagem.includes('Documento rejeitado ou expirado não encontrado')) return 'Este documento já não está disponível para correção. Atualize os seus dados e tente novamente.';
  return 'Não foi possível enviar o documento. Tente novamente.';
}
