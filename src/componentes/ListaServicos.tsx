import { Servico } from '@/tipos';
import CardServico from './CardServico';

interface ListaServicosProps {
  servicos: Servico[];
  titulo?: string;

  onRemoverFavorito?: (
    servicoId: string
  ) => void;

  mostrarDataContacto?: boolean;
}

export default function ListaServicos({
  servicos,
  titulo,
  onRemoverFavorito,
  mostrarDataContacto = false,
}: ListaServicosProps) {
  const listaSegura = Array.isArray(servicos)
    ? servicos
    : [];

  return (
    <section>
      {titulo && (
        <h2 className="font-titulo text-xl md:text-2xl mb-4">
          {titulo}
        </h2>
      )}

      {listaSegura.length === 0 ? (
        <p className="font-corpo text-sm text-muted-foreground py-8 text-center">
          Nenhum serviço encontrado.
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {listaSegura.map(servico => (
            <CardServico
              key={servico.id}
              servico={servico}
              onFavoritoRemovido={
                onRemoverFavorito
              }
              mostrarDataContacto={
                mostrarDataContacto
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}