import { useQuery } from '@tanstack/react-query';
import { Eye, Heart, Phone, Wrench } from 'lucide-react';
import { useAuth } from '@/contextos/AuthContexto';
import { fetchResumoCliente } from '@/services/api';

export default function ClienteResumo() {
  const { utilizador } = useAuth();
  const { data: stats, isLoading } = useQuery({
    queryKey: ['cliente-resumo', utilizador?.id],
    queryFn: () => fetchResumoCliente(utilizador!.id),
    enabled: Boolean(utilizador?.id),
  });

  if (isLoading) return <div className="painel-dashboard-form font-corpo text-sm text-muted-foreground">A carregar resumo...</div>;

  return (
    <div className="space-y-6">
      <header className="painel-dashboard-cabecalho flex items-center gap-3">
        <span className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15 text-primary-foreground"><Heart className="size-5 fill-current" /></span>
        <div>
        <h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">O meu resumo</h1>
        <p className="relative z-10 mt-1 font-corpo text-sm text-primary-foreground/80">
          Bem-vindo, {utilizador?.nome || 'cliente'}. Aqui pode acompanhar a sua atividade na ANGROLINK.
        </p>
        </div>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <CardStat icone={Eye} rotulo="Produtos visualizados" valor={stats?.produtosVisualizados ?? 0} />
        <CardStat icone={Wrench} rotulo="Serviços visualizados" valor={stats?.servicosVisualizados ?? 0} />
        <CardStat icone={Phone} rotulo="Contactos feitos" valor={stats?.contactosFeitos ?? 0} />
      </div>
    </div>
  );
}

function CardStat({ icone: Icone, rotulo, valor }: { icone: React.ComponentType<{ className?: string }>; rotulo: string; valor: number }) {
  return (
    <div className="painel-dashboard-metrica">
      <Icone className="w-5 h-5 text-primary mb-3" />
      <p className="font-titulo text-2xl font-bold">{valor}</p>
      <p className="font-corpo text-sm text-muted-foreground">{rotulo}</p>
    </div>
  );
}
