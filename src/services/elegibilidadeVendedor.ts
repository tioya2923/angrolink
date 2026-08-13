import { supabase } from '@/services/supabase';

const cache = new Map<string, Promise<boolean>>();

export async function consultarElegibilidadeVendedor(vendedorId: string) {
  let pedido = cache.get(vendedorId);
  if (!pedido) {
    pedido = Promise.resolve(supabase.rpc('vendedor_pode_receber_encomendas', { p_vendedor_id: vendedorId }))
      .then(({ data, error }) => {
        if (error) throw error;
        return data === true;
      });
    cache.set(vendedorId, pedido);
  }
  return pedido;
}

export function limparElegibilidadeVendedor(vendedorId?: string) {
  if (vendedorId) cache.delete(vendedorId);
  else cache.clear();
}
