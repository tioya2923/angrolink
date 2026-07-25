import { Utilizador } from "@/tipos";

export function obterVendedorAtivoId(utilizador?: Utilizador | null): string | null {
  return utilizador?.vendedor_id || null;
}
