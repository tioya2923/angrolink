import { forwardRef, type ComponentPropsWithoutRef, useEffect, useState } from 'react';
import { Bell, CheckCheck, PackageCheck, ShoppingBag, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotificacoesSessao } from '@/contextos/NotificacoesContexto';
import { eUrlDestinoInterna, type ContextoNotificacao, type Notificacao } from '@/services/notificacoes';
import { toast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

function useEcrãPequeno() {
  const [pequeno, setPequeno] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
  ));

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const atualizar = () => setPequeno(media.matches);
    atualizar();
    media.addEventListener('change', atualizar);
    return () => media.removeEventListener('change', atualizar);
  }, []);

  return pequeno;
}

function rotuloContexto(contexto: ContextoNotificacao) {
  if (contexto === 'venda') return 'Venda';
  if (contexto === 'entrega') return 'Entrega';
  return 'Compra';
}

function IconeContexto({ contexto }: { contexto: ContextoNotificacao }) {
  const Icone = contexto === 'venda' ? PackageCheck : contexto === 'entrega' ? Truck : ShoppingBag;
  return <Icone aria-hidden="true" className="size-4 text-green-700" />;
}

function dataRelativa(data: string) {
  const dataNotificacao = new Date(data);
  const diferencaMinutos = Math.floor((Date.now() - dataNotificacao.getTime()) / 60_000);
  if (!Number.isFinite(diferencaMinutos) || diferencaMinutos < 0) return 'Agora';
  if (diferencaMinutos < 1) return 'Agora';
  if (diferencaMinutos < 60) return `Há ${diferencaMinutos} min`;
  const horas = Math.floor(diferencaMinutos / 60);
  if (horas < 24) return `Há ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `Há ${dias} dia${dias === 1 ? '' : 's'}`;
  return dataNotificacao.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
}

const BotaoSino = forwardRef<HTMLButtonElement, { naoLidas: number } & ComponentPropsWithoutRef<'button'>>(
  ({ naoLidas, ...props }, ref) => {
  const badge = naoLidas > 99 ? '99+' : String(naoLidas);
  return (
    <button
      ref={ref}
      type="button"
      {...props}
      className="relative rounded-full p-2 text-white transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/70"
      aria-label={naoLidas ? `Notificações: ${naoLidas} não lidas` : 'Notificações'}
    >
      <Bell className="size-5" aria-hidden="true" />
      {naoLidas > 0 && (
        <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[10px] font-bold leading-5 text-green-950">
          {badge}
        </span>
      )}
    </button>
  );
  },
);
BotaoSino.displayName = 'BotaoSino';

interface PainelProps {
  notificacoes: Notificacao[];
  loading: boolean;
  erro: string | null;
  naoLidas: number;
  atualizar: () => Promise<void>;
  marcarTodas: () => Promise<boolean>;
  aoAbrir: (notificacao: Notificacao) => void;
}

function PainelNotificacoes({
  notificacoes,
  loading,
  erro,
  naoLidas,
  atualizar,
  marcarTodas,
  aoAbrir,
}: PainelProps) {
  const marcarTodasComoLidas = async () => {
    if (!await marcarTodas()) {
      toast({ title: 'Não foi possível marcar as notificações como lidas.', variant: 'destructive' });
    }
  };

  return (
    <section aria-label="Painel de notificações" className="w-full">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-titulo text-lg font-bold text-foreground">Notificações</h2>
          <p className="text-xs text-muted-foreground">As 20 mais recentes</p>
        </div>
        {naoLidas > 0 && (
          <button
            type="button"
            onClick={() => void marcarTodasComoLidas()}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-green-800 hover:bg-green-50"
          >
            <CheckCheck className="size-4" aria-hidden="true" />
            Marcar todas
          </button>
        )}
      </header>

      <div className="max-h-[min(26rem,65vh)] overflow-y-auto p-2">
        {loading && notificacoes.length === 0 && (
          <div className="space-y-3 p-3" aria-label="A carregar notificações">
            <div className="h-16 animate-pulse rounded-lg bg-muted" />
            <div className="h-16 animate-pulse rounded-lg bg-muted" />
          </div>
        )}

        {erro && (
          <div className="m-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <p>Não foi possível carregar as notificações.</p>
            <button type="button" onClick={() => void atualizar()} className="mt-2 font-semibold underline">Tentar novamente</button>
          </div>
        )}

        {!loading && !erro && notificacoes.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Ainda não tens notificações.</p>
        )}

        {notificacoes.map(notificacao => (
          <button
            key={notificacao.id}
            type="button"
            onClick={() => aoAbrir(notificacao)}
            className={`mb-1 flex w-full gap-3 rounded-lg p-3 text-left transition-colors hover:bg-green-50 ${
              notificacao.lida ? 'bg-background' : 'bg-green-50/80'
            }`}
          >
            <span className="mt-0.5 rounded-full bg-green-100 p-2"><IconeContexto contexto={notificacao.contexto} /></span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-green-800">{rotuloContexto(notificacao.contexto)}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{dataRelativa(notificacao.criado_em)}</span>
              </span>
              <span className="mt-1 block text-sm font-semibold text-foreground">{notificacao.titulo}</span>
              <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">{notificacao.mensagem}</span>
            </span>
            {!notificacao.lida && <span className="mt-2 size-2 shrink-0 rounded-full bg-green-700" aria-label="Não lida" />}
          </button>
        ))}
      </div>
    </section>
  );
}

export default function NotificacoesMenu() {
  const pequeno = useEcrãPequeno();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const {
    notificacoes,
    naoLidas,
    loading,
    erro,
    ultimaRealtime,
    atualizar,
    marcarLida,
    marcarTodas,
    ativo,
  } = useNotificacoesSessao();

  useEffect(() => {
    if (!ativo || !ultimaRealtime) return;
    toast({ title: ultimaRealtime.titulo, description: ultimaRealtime.mensagem });
  }, [ativo, ultimaRealtime]);

  if (!ativo) return null;

  const abrirNotificacao = async (notificacao: Notificacao) => {
    const marcada = await marcarLida(notificacao.id);
    if (!marcada) {
      toast({ title: 'Não foi possível marcar a notificação como lida.', variant: 'destructive' });
    }
    setAberto(false);
    if (eUrlDestinoInterna(notificacao.url_destino)) navigate(notificacao.url_destino);
  };

  const painel = (
    <PainelNotificacoes
      notificacoes={notificacoes}
      loading={loading}
      erro={erro}
      naoLidas={naoLidas}
      atualizar={atualizar}
      marcarTodas={marcarTodas}
      aoAbrir={notificacao => void abrirNotificacao(notificacao)}
    />
  );

  if (pequeno) {
    return (
      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetTrigger asChild><BotaoSino naoLidas={naoLidas} /></SheetTrigger>
        <SheetContent side="bottom" className="max-h-[80vh] rounded-t-2xl p-0">
          <SheetHeader className="sr-only"><SheetTitle>Notificações</SheetTitle></SheetHeader>
          {painel}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild><BotaoSino naoLidas={naoLidas} /></PopoverTrigger>
      <PopoverContent align="end" className="w-[24rem] max-w-[calc(100vw-2rem)] p-0">
        {painel}
      </PopoverContent>
    </Popover>
  );
}
