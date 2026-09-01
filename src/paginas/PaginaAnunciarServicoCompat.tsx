import { Navigate } from 'react-router-dom';

import { useAuth } from '@/contextos/AuthContexto';
import { obterDestinoAnunciarServico } from '@/dominio/rotaAnunciarServico';

export default function PaginaAnunciarServicoCompat() {
  const { utilizador, pronto } = useAuth();

  if (!pronto) {
    return (
      <div className="min-h-screen p-8 text-center font-corpo text-sm text-muted-foreground">
        A carregar sessão...
      </div>
    );
  }

  return <Navigate to={obterDestinoAnunciarServico(utilizador)} replace />;
}
