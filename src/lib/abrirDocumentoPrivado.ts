export type ResultadoAberturaDocumento = 'aberta' | 'documento_indisponivel';

export async function abrirDocumentoPrivado(
  obterUrl: () => Promise<string>,
): Promise<ResultadoAberturaDocumento> {
  try {
    const url = await obterUrl();
    // Com noopener o browser pode abrir a aba e devolver null. Não usamos o
    // retorno como indicador de bloqueio; a proteção do opener é mantida.
    window.open(url, '_blank', 'noopener,noreferrer');
    return 'aberta';
  } catch {
    return 'documento_indisponivel';
  }
}
