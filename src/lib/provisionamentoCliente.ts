/**
 * Campos opcionais enviados ao perfil de comprador não devem transformar
 * ausência em string vazia: clientes.telefone tem unicidade no banco.
 */
export function textoOpcionalParaCliente(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;

  const normalizado = valor.trim();
  return normalizado || null;
}

export function deveLerClienteProprioAposFalhaCriacao(erro: unknown): boolean {
  return (
    !!erro &&
    typeof erro === 'object' &&
    'code' in erro &&
    (erro as { code?: unknown }).code === '23505'
  );
}
