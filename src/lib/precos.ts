export interface Promocao {
  precoOriginal: number;
  precoPromocional: number;
  percentagem: number;
}

/** Devolve uma promoção apenas quando o preço promocional é realmente inferior. */
export function obterPromocao(
  precoOriginal?: number | null,
  precoPromocional?: number | null,
): Promocao | null {
  const original = Number(precoOriginal);
  const promocional = Number(precoPromocional);

  if (!Number.isFinite(original) || !Number.isFinite(promocional) || original <= 0 || promocional <= 0 || promocional >= original) {
    return null;
  }

  return { precoOriginal: original, precoPromocional: promocional, percentagem: Math.round((1 - promocional / original) * 100) };
}
