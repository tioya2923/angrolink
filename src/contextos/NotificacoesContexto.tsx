import { createContext, useContext, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contextos/AuthContexto';
import { useNotificacoes } from '@/hooks/useNotificacoes';

type EstadoNotificacoes = ReturnType<typeof useNotificacoes> & { ativo: boolean };

const NotificacoesContexto = createContext<EstadoNotificacoes | null>(null);

const ROTAS_SEM_NOTIFICACOES = new Set([
  '/login',
  '/anunciar',
  '/anunciar-servico',
  '/parceiro-entregas/cadastro',
]);

export function NotificacoesProvider({ children }: { children: ReactNode }) {
  const { utilizador } = useAuth();
  const { pathname } = useLocation();
  const elegivel = utilizador?.papel === 'cliente'
    || utilizador?.papel === 'vendedor'
    || utilizador?.papel === 'parceiro_entrega';
  const ativo = Boolean(utilizador && elegivel && !ROTAS_SEM_NOTIFICACOES.has(pathname));
  const estado = useNotificacoes(utilizador?.id, ativo);

  return <NotificacoesContexto.Provider value={{ ...estado, ativo }}>{children}</NotificacoesContexto.Provider>;
}

export function useNotificacoesSessao(): EstadoNotificacoes {
  const contexto = useContext(NotificacoesContexto);
  if (!contexto) throw new Error('useNotificacoesSessao deve ser usado dentro de NotificacoesProvider.');
  return contexto;
}
