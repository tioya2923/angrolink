import { useQuery } from '@tanstack/react-query';
import { Eye, Phone, Wrench } from 'lucide-react';
import { useAuth } from '@/contextos/AuthContexto';
import { fetchResumoCliente } from '@/services/api';

export default function ClienteResumo() {
  const { utilizador } = useAuth();
  const { data: stats, isLoading } = useQuery({
    queryKey: ['cliente-resumo', utilizador?.id],
    queryFn: () => fetchResumoCliente(utilizador!.id),
    enabled: Boolean(utilizador?.id),
  });

  if (isLoading) return <p className="font-corpo text-sm text-muted-foreground">A carregar menu...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-titulo text-2xl font-bold">Menu</h1>
        <p className="font-corpo text-sm text-muted-foreground mt-1">
          Bem-vindo, {utilizador?.nome || 'cliente'}. Aqui pode acompanhar a sua atividade na ANGROLINK.
        </p>
      </div>
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
    <div className="border-2 border-border bg-card rounded-md p-4">
      <Icone className="w-5 h-5 text-primary mb-3" />
      <p className="font-titulo text-2xl font-bold">{valor}</p>
      <p className="font-corpo text-sm text-muted-foreground">{rotulo}</p>
    </div>
  );
}
