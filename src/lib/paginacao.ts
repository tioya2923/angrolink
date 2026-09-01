export interface EstadoPaginacao {
  inicio: number;
  fim: number;
  podeAnterior: boolean;
  podeProxima: boolean;
}

export function calcularEstadoPaginacao(offset: number, limite: number, totalResultados: number, totalItens: number): EstadoPaginacao {
  const inicio = totalResultados === 0 ? 0 : offset + 1;
  return {
    inicio,
    fim: Math.min(offset + totalItens, totalResultados),
    podeAnterior: offset > 0,
    podeProxima: offset + totalItens < totalResultados,
  };
}
