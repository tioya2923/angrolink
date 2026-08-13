import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { EncomendaCard } from '@/componentes/encomendas/EncomendaCard';
import { useAuth } from '@/contextos/AuthContexto';
import { useEncomendasTempoReal } from '@/hooks/useEncomendasTempoReal';
import { fetchEncomendasVendedor, type EncomendaResumo } from '@/services/encomendas';

const FILTROS = { todas: 'Todas', aguardando_confirmacao: 'Aguardando confirmação', em_preparacao: 'Em preparação', pronta_para_levantamento: 'Prontas', finalizadas: 'Concluídas/levantadas', encerradas: 'Canceladas/recusadas' } as const;

export default function VendedorEncomendas() {
  const { utilizador } = useAuth();
  const [dados, setDados] = useState<EncomendaResumo[]>([]);
  const [filtro, setFiltro] = useState<keyof typeof FILTROS>('todas');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setErro(false);
      setDados(await fetchEncomendasVendedor());
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
    { ativo: utilizador?.papel === 'vendedor' },
    carregar,
  );

  const encomendas = useMemo(() => dados.filter((encomenda) => filtro === 'todas' || (filtro === 'finalizadas' ? ['levantada', 'concluida'].includes(encomenda.estado) : filtro === 'encerradas' ? ['cancelada', 'recusada'].includes(encomenda.estado) : encomenda.estado === filtro)), [dados, filtro]);

  if (carregando) return <p className="painel-dashboard-form text-sm text-muted-foreground">A carregar encomendas…</p>;
  if (erro) return <p className="painel-dashboard-form text-sm text-destructive">Não foi possível carregar as encomendas.</p>;

  return <div className="space-y-6"><header className="painel-dashboard-cabecalho flex items-center gap-3"><span className="relative z-10 rounded-xl bg-primary-foreground/15 p-3 text-primary-foreground"><ClipboardList className="size-5" /></span><div><h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">Encomendas</h1><p className="relative z-10 text-sm text-primary-foreground/80">Confirma, prepara e entrega pedidos de forma organizada.</p></div></header><div className="flex flex-wrap gap-2">{Object.entries(FILTROS).map(([id, nome]) => <button key={id} onClick={() => setFiltro(id as keyof typeof FILTROS)} className={`rounded-full border px-3 py-2 text-sm font-semibold ${filtro === id ? 'border-green-800 bg-green-800 text-white' : 'border-border bg-card hover:bg-green-50'}`}>{nome}</button>)}</div>{encomendas.length === 0 ? <div className="painel-dashboard-form border-dashed py-12 text-center text-sm text-muted-foreground">Ainda não recebeste encomendas.</div> : <div className="space-y-3">{encomendas.map((encomenda) => <EncomendaCard key={encomenda.id} encomenda={encomenda} vendedor />)}</div>}</div>;
}
