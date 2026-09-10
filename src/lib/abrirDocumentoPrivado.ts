export type ResultadoAberturaDocumento = 'aberta' | 'documento_indisponivel';

export async function abrirDocumentoPrivado(
  obterUrl: () => Promise<string>,
): Promise<ResultadoAberturaDocumento> {
  const janela = window.open('about:blank', '_blank');
  try {
    const url = await obterUrl();
    // Com noopener o browser pode abrir a aba e devolver null. Não usamos o
    // retorno como indicador de bloqueio; a proteção do opener é mantida.
    if (typeof url !== 'string' || !url.trim()) {
      janela?.close();
      return 'documento_indisponivel';
    }
    if (janela && !janela.closed) janela.location.href = url;
    else window.open(url, '_blank', 'noopener,noreferrer');
    return 'aberta';
  } catch (erro) {
    console.error('Falha ao abrir documento privado:', erro);
    janela?.close();
    return 'documento_indisponivel';
  }
}
