import { createContext, useCallback, useContext, useEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contextos/AuthContexto';
import { useNotificacoes } from '@/hooks/useNotificacoes';
import { ToastAction } from '@/components/ui/toast';
import { toast } from '@/hooks/use-toast';
import { eUrlDestinoInterna, type Notificacao } from '@/services/notificacoes';

type EstadoNotificacoes = ReturnType<typeof useNotificacoes> & {
  ativo: boolean;
  abrirNotificacao: (notificacao: Notificacao) => Promise<void>;
};

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
  const navigate = useNavigate();
  const elegivel = utilizador?.papel === 'cliente'
    || utilizador?.papel === 'vendedor'
    || utilizador?.papel === 'parceiro_entrega';
  const ativo = Boolean(utilizador && elegivel && !ROTAS_SEM_NOTIFICACOES.has(pathname));
  const estado = useNotificacoes(utilizador?.id, ativo);
  const { consumirUltimaRealtime, marcarLida } = estado;
  const navegandoRef = useRef(false);
  const idsComToastRef = useRef(new Set<string>());
  const dispensarToastRef = useRef(new Map<string, () => void>());

  useEffect(() => {
    idsComToastRef.current.clear();
    dispensarToastRef.current.clear();
  }, [utilizador?.id]);

  const abrirNotificacao = useCallback(async (notificacao: Notificacao) => {
    if (navegandoRef.current) return;
    navegandoRef.current = true;
    dispensarToastRef.current.get(notificacao.id)?.();
    dispensarToastRef.current.delete(notificacao.id);

    try {
      await marcarLida(notificacao.id);
      navigate(eUrlDestinoInterna(notificacao.url_destino) ? notificacao.url_destino : '/dashboard');
    } finally {
      navegandoRef.current = false;
    }
  }, [marcarLida, navigate]);

  useEffect(() => {
    const notificacao = estado.ultimaRealtime;
    if (!ativo || !notificacao || idsComToastRef.current.has(notificacao.id)) return;

    idsComToastRef.current.add(notificacao.id);
    let instancia: ReturnType<typeof toast> | null = null;
    const abrir = () => {
      instancia?.dismiss();
      void abrirNotificacao(notificacao);
    };
    const ignorarFecho = (alvo: EventTarget | null) => alvo instanceof Element && Boolean(alvo.closest('[toast-close]'));
    const aoClicar = (evento: MouseEvent<HTMLElement>) => {
      if (!ignorarFecho(evento.target)) abrir();
    };
    const aoTeclar = (evento: KeyboardEvent<HTMLElement>) => {
      if (evento.key !== 'Enter' && evento.key !== ' ') return;
      evento.preventDefault();
      abrir();
    };

    instancia = toast({
      title: notificacao.titulo,
      description: notificacao.mensagem,
      className: 'cursor-pointer',
      role: 'button',
      tabIndex: 0,
      onClick: aoClicar,
      onKeyDown: aoTeclar,
      action: <ToastAction altText="Abrir notificação" onClick={evento => { evento.preventDefault(); evento.stopPropagation(); abrir(); }}>Abrir</ToastAction>,
    });
    dispensarToastRef.current.set(notificacao.id, instancia.dismiss);
    consumirUltimaRealtime(notificacao.id);
  }, [abrirNotificacao, ativo, consumirUltimaRealtime, estado.ultimaRealtime]);

  return <NotificacoesContexto.Provider value={{ ...estado, ativo, abrirNotificacao }}>{children}</NotificacoesContexto.Provider>;
}

export function useNotificacoesSessao(): EstadoNotificacoes {
  const contexto = useContext(NotificacoesContexto);
  if (!contexto) throw new Error('useNotificacoesSessao deve ser usado dentro de NotificacoesProvider.');
  return contexto;
}
