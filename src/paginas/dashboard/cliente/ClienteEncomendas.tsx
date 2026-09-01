import { useCallback, useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { EncomendaCard } from '@/componentes/encomendas/EncomendaCard';
import { useAuth } from '@/contextos/AuthContexto';
import { useEncomendasTempoReal } from '@/hooks/useEncomendasTempoReal';
import { fetchEncomendasCliente, type EncomendaResumo } from '@/services/encomendas';

export default function ClienteEncomendas({ titulo = 'Minhas encomendas', descricao = 'Acompanha cada pedido até ao levantamento.', rotaDetalhe = '/dashboard/encomendas' }: { titulo?: string; descricao?: string; rotaDetalhe?: string }) {
  const { utilizador } = useAuth();
  const [encomendas, setEncomendas] = useState<EncomendaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setErro(false);
      setEncomendas(await fetchEncomendasCliente());
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEncomendasTempoReal(
    { ativo: utilizador?.papel === 'cliente' || utilizador?.papel === 'vendedor' },
    carregar,
  );

  if (carregando) return <p className="painel-dashboard-form text-sm text-muted-foreground">A carregar encomendas…</p>;
  if (erro) return <p className="painel-dashboard-form text-sm text-destructive">Não foi possível carregar as encomendas.</p>;

  return <div className="space-y-6"><header className="painel-dashboard-cabecalho flex items-center gap-3"><span className="relative z-10 rounded-xl bg-primary-foreground/15 p-3 text-primary-foreground"><ClipboardList className="size-5" /></span><div><h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">{titulo}</h1><p className="relative z-10 text-sm text-primary-foreground/80">{descricao}</p></div></header>{encomendas.length === 0 ? <div className="painel-dashboard-form border-dashed py-12 text-center text-sm text-muted-foreground">Ainda não tens encomendas.</div> : <div className="space-y-3">{encomendas.map((encomenda) => <EncomendaCard key={encomenda.id} encomenda={encomenda} vendedor={false} rotaDetalhe={rotaDetalhe} />)}</div>}</div>;
}
