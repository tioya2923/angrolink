type ResultadoRpcAdmin = {
  data: boolean | null;
  error: unknown | null;
};

/**
 * A interface só pode apresentar o papel administrativo após confirmação do
 * servidor. Metadados e e-mail do utilizador nunca participam nesta decisão.
 */
export async function verificarAdminNoServidor(
  chamarEhAdmin: () => Promise<ResultadoRpcAdmin>,
): Promise<boolean> {
  try {
    const resultado = await chamarEhAdmin();
    return resultado.error === null && resultado.data === true;
  } catch {
    return false;
  }
}
