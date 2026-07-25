import { useAuth } from "@/contextos/AuthContexto";
import { obterVendedorAtivoId } from "@/lib/vendedorAtivo";

// =============================
// VENDEDOR ATIVO FIXO — FASE 1
// =============================
// Enquanto ainda não tens autenticação real ligada ao Supabase,
// usamos este vendedor como dono dos produtos no MVP.
export const VENDEDOR_ATIVO_ID = "776d411d-922b-4908-bc02-32547b0f0277";

// =============================
// HOOK PARA COMPONENTES REACT
// =============================
// Este hook pode ser usado em páginas/componentes.
// Mas o api.ts não pode depender diretamente de hooks React.
export const useVendedorAtivo = () => {
  const { utilizador } = useAuth();

  return {
    id:
    obterVendedorAtivoId(utilizador)
    ||
    null
  };
};