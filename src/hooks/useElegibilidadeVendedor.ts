import { useEffect, useState } from 'react';
import { useAtualizacaoTempoReal } from '@/hooks/useAtualizacaoTempoReal';
import { consultarElegibilidadeVendedor, limparElegibilidadeVendedor } from '@/services/elegibilidadeVendedor';

export { consultarElegibilidadeVendedor, limparElegibilidadeVendedor } from '@/services/elegibilidadeVendedor';

export function useElegibilidadeVendedor(vendedorId?: string | null) {
  const [elegivel, setElegivel] = useState(false);
  const [aCarregar, setACarregar] = useState(Boolean(vendedorId));

  useEffect(() => {
    let ativo = true;
    if (!vendedorId) { setElegivel(false); setACarregar(false); return; }
    setACarregar(true);
    consultarElegibilidadeVendedor(vendedorId).then((resultado) => {
      if (ativo) setElegivel(resultado);
    }).catch(() => {
      if (ativo) setElegivel(false);
    }).finally(() => {
      if (ativo) setACarregar(false);
    });
    return () => { ativo = false; };
  }, [vendedorId]);

  useAtualizacaoTempoReal(['vendedores'], () => {
    if (!vendedorId) return;
    limparElegibilidadeVendedor(vendedorId);
    setACarregar(true);
    return consultarElegibilidadeVendedor(vendedorId).then(setElegivel).catch(() => setElegivel(false)).finally(() => setACarregar(false));
  });

  return { elegivel, aCarregar };
}
