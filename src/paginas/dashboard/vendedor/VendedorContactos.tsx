import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Mail, MapPin, MessageSquare, Package, Phone, UserRound, Wrench, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/contextos/AuthContexto';
import { fetchHistoricoContactosServicosVendedor, fetchHistoricoContactosVendedor } from '@/services/api';

type Contacto = {
  id: string;
  tipo: 'produto' | 'servico';
  data: string | null;
  clientes?: { nome?: string | null; telefone?: string | null; email?: string | null; municipio?: string | null; provincia?: string | null; foto_perfil?: string | null } | null;
  produtos?: { nome_produto?: string | null } | null;
  servicos?: { nome_servico?: string | null } | null;
};

const formatarData = (data: string | null) => data
  ? new Intl.DateTimeFormat('pt-AO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data))
  : 'Data não disponível';

export default function VendedorContactos() {
  const { utilizador } = useAuth();
  const [produtos, setProdutos] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      if (!utilizador?.vendedor_id) return setCarregando(false);
      try {
        const [contactosProduto, contactosServico] = await Promise.all([
          fetchHistoricoContactosVendedor(utilizador.vendedor_id),
          fetchHistoricoContactosServicosVendedor(utilizador.vendedor_id),
        ]);
        setProdutos(contactosProduto);
        setServicos(contactosServico);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [utilizador?.vendedor_id]);

  const contactos = useMemo<Contacto[]>(() => [
    ...produtos.map(item => ({ ...item, tipo: 'produto' as const, data: item.atualizado_em || item.criado_em })),
    ...servicos.map(item => ({ ...item, tipo: 'servico' as const, data: item.atualizado_em || item.criado_em })),
  ].sort((a, b) => new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime()), [produtos, servicos]);

  if (carregando) return <p className="font-corpo text-sm text-muted-foreground">A carregar contactos...</p>;

  return (
    <div className="space-y-6">
      <header className="painel-dashboard-cabecalho">
        <div className="flex items-start gap-3">
          <div className="relative z-10 rounded-lg bg-primary-foreground/15 p-3 text-primary-foreground"><MessageSquare className="h-6 w-6" /></div>
          <div>
            <h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">Contactos recebidos</h1>
            <p className="relative z-10 font-corpo mt-1 text-sm text-primary-foreground/80">Clientes que iniciaram contacto através dos teus produtos e serviços.</p>
          </div>
        </div>
      </header>

      {contactos.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border p-10 text-center">
          <MessageSquare className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h2 className="font-titulo text-lg font-semibold">Ainda não recebeste contactos</h2>
          <p className="mx-auto mt-2 max-w-md font-corpo text-sm text-muted-foreground">Quando um cliente usar o WhatsApp de um anúncio, o contacto e a data aparecerão aqui.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {contactos.map(contacto => {
            const cliente = contacto.clientes;
            const anuncio = contacto.tipo === 'produto' ? contacto.produtos?.nome_produto : contacto.servicos?.nome_servico;
            return (
              <article key={`${contacto.tipo}-${contacto.id}`} className="painel-dashboard-item p-4 md:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    {cliente?.foto_perfil ? <img src={cliente.foto_perfil} alt={`Foto de ${cliente.nome || 'cliente'}`} className="h-11 w-11 rounded-full object-cover" /> : <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><UserRound className="h-5 w-5" /></div>}
                    <div className="min-w-0">
                      <h2 className="font-titulo font-semibold">{cliente?.nome || 'Cliente não identificado'}</h2>
                      <p className="mt-1 flex items-center gap-1.5 font-corpo text-sm text-muted-foreground">{contacto.tipo === 'produto' ? <Package className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}{anuncio || 'Anúncio removido'}</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 font-corpo text-xs text-muted-foreground"><CalendarDays className="h-4 w-4" />{formatarData(contacto.data)}</span>
                </div>
                <div className="mt-4 grid gap-2 border-t border-border pt-4 text-sm sm:grid-cols-3">
                  <Info icone={Phone} texto={cliente?.telefone || 'Telefone não disponível'} />
                  <Info icone={Mail} texto={cliente?.email || 'E-mail não disponível'} />
                  <Info icone={MapPin} texto={[cliente?.municipio, cliente?.provincia].filter(Boolean).join(', ') || 'Localização não disponível'} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Info({ icone: Icone, texto }: { icone: LucideIcon; texto: string }) {
  return <p className="flex min-w-0 items-center gap-2 font-corpo text-muted-foreground"><Icone className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">{texto}</span></p>;
}
