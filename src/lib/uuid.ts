/**
 * Gera UUIDs v4 em browsers que expõem `crypto.getRandomValues`, mas não
 * `crypto.randomUUID` (por exemplo, alguns contextos não seguros/embutidos).
 */
export function gerarUuidV4(): string {
  const cryptoDisponivel = typeof globalThis !== 'undefined'
    ? globalThis.crypto
    : undefined;

  if (typeof cryptoDisponivel?.randomUUID === 'function') {
    return cryptoDisponivel.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof cryptoDisponivel?.getRandomValues === 'function') {
    cryptoDisponivel.getRandomValues(bytes);
  } else {
    // Compatibilidade final para runtimes antigos: mantém o formato UUID v4.
    for (let indice = 0; indice < bytes.length; indice += 1) {
      bytes[indice] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}
