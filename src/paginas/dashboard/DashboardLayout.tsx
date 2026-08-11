/**
 * ========================================
 * LAYOUT DASHBOARD — Estrutura partilhada
 * ========================================
 * Menu lateral + conteúdo principal
 * adaptado por tipo de utilizador.
 */

import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import {
  ArrowLeft,
  BarChart3,
  Clock,
  ClipboardList,
  CircleHelp,
  FileCheck2,
  Heart,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  MessageSquare,
  MapPinned,
  Package,
  PlusCircle,
  Settings,
  ShieldCheck,
  Sparkles,
  Truck,
  UserCircle,
  Users,
  Wrench,
  X,
} from 'lucide-react';

import { useAuth } from '@/contextos/AuthContexto';
import { PapelUtilizador } from '@/tipos';
import { obterUrlDocumentoParceiro } from '@/services/api';

interface ItemMenu {
  rotulo: string;
  icone: React.ComponentType<any>;
  caminho: string;

  badge?: number;

  disabled?: boolean;

  descricao?: string;
}

const MENUS: Record<PapelUtilizador, ItemMenu[]> = {
  parceiro_entrega: [
    { rotulo: 'Resumo', icone: LayoutDashboard, caminho: '/dashboard' },
    { rotulo: 'Dados e perfil', icone: UserCircle, caminho: '/dashboard/dados' },
    { rotulo: 'Pedidos de entrega', icone: ClipboardList, caminho: '/dashboard/pedidos' },
    { rotulo: 'Veículo e disponibilidade', icone: Truck, caminho: '/dashboard/veiculo' },
    { rotulo: 'Cobertura', icone: MapPinned, caminho: '/dashboard/areas' },
    { rotulo: 'Documentos', icone: FileCheck2, caminho: '/dashboard/documentos' },
    { rotulo: 'Apoio ANGROLINK', icone: CircleHelp, caminho: '/dashboard/apoio' },
  ],
  admin: [
    {
      rotulo: 'Menu',
      icone: LayoutDashboard,
      caminho: '/dashboard',
    },
    {
      rotulo: 'Vendedores',
      icone: Users,
      caminho: '/dashboard/vendedores',
    },
    {
      rotulo: 'Pedidos',
      icone: UserCircle,
      caminho: '/dashboard/pedidos-vendedores',
    },
    {
      rotulo: 'Entregadores',
      icone: Truck,
      caminho: '/dashboard/entregadores',
    },
    {
      rotulo: 'Utilizadores',
      icone: ShieldCheck,
      caminho: '/dashboard/utilizadores',
    },
    {
      rotulo: 'Produtos',
      icone: Package,
      caminho: '/dashboard/produtos',
    },
    {
      rotulo: 'Rankings',
      icone: BarChart3,
      caminho: '/dashboard/rankings',
    },
  ],

  vendedor: [
    {
      rotulo: 'Menu',
      icone: LayoutDashboard,
      caminho: '/dashboard',
    },
    {
      rotulo: 'Meus Produtos',
      icone: Package,
      caminho: '/dashboard/produtos',
    },
    {
      rotulo: 'Meus Serviços',
      icone: Wrench,
      caminho: '/dashboard/servicos',
    },
    {
      rotulo: 'Favoritos',
      icone: Heart,
      caminho: '/dashboard/favoritos',
    },
    {
      rotulo: 'Adicionar Produto',
      icone: PlusCircle,
      caminho: '/dashboard/adicionar',
    },
    {
      rotulo: 'Adicionar Serviço',
      icone: PlusCircle,
      caminho: '/dashboard/adicionar-servico',
    },
    {
      rotulo: "Desempenho",
      icone: BarChart3,
      caminho: "/dashboard/desempenho",
    },
    {
      rotulo: "Contactos",
      icone: MessageSquare,
      caminho: "/dashboard/contactos",
    },
    {
      rotulo: 'Estatísticas',
      icone: BarChart3,
      caminho: '/dashboard/estatisticas',
    },
    {
      rotulo: 'Perfil',
      icone: UserCircle,
      caminho: '/dashboard/perfil',
    },
  ],

  cliente: [
    {
      rotulo: 'Menu',
      icone: LayoutDashboard,
      caminho: '/dashboard',
    },
    {
      rotulo: 'Histórico',
      icone: Clock,
      caminho: '/dashboard/historico',
    },
    {
      rotulo: 'Favoritos',
      icone: Heart,
      caminho: '/dashboard/favoritos',
    },    
    {
      rotulo: 'Recomendações',
      icone: Sparkles,
      caminho: '/dashboard/recomendacoes',
    },
    {
      rotulo: 'Definições',
      icone: Settings,
      caminho: '/dashboard/definicoes',
    },
  ],
};

interface Props {
  children: React.ReactNode;
}

export default function DashboardLayout({
  children,
}: Props) {
  const { utilizador, logout } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();

  const [menuAberto, setMenuAberto] =
    useState(false);
  const [fotoPerfilAssinada, setFotoPerfilAssinada] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    if (utilizador?.papel !== 'parceiro_entrega' || !utilizador.foto_perfil) {
      setFotoPerfilAssinada(null);
      return;
    }

    obterUrlDocumentoParceiro(utilizador.foto_perfil)
      .then(url => { if (ativo) setFotoPerfilAssinada(url); })
      .catch(() => { if (ativo) setFotoPerfilAssinada(null); });

    return () => { ativo = false; };
  }, [utilizador?.foto_perfil, utilizador?.papel]);

  if (!utilizador) return null;

  const vendedorAprovado =
    utilizador.papel === 'vendedor' &&
    utilizador.status_aprovacao === 'aprovado';

  const menuBase = MENUS[utilizador.papel];

  const nomePapel =
    utilizador.papel === 'admin'
      ? 'Administrador'
      : utilizador.papel === 'vendedor'
        ? 'Vendedor'
        : utilizador.papel === 'parceiro_entrega'
          ? 'Parceiro de entregas'
        : 'Cliente';

  const inicialNome =
    utilizador.nome?.charAt(0).toUpperCase() || '?';

  const estadoVendedor =
    utilizador.papel === 'vendedor'
      ? utilizador.status_aprovacao === 'aprovado'
        ? 'Aprovado'
        : utilizador.status_aprovacao === 'suspenso'
          ? 'Suspenso'
          : 'Em aprovação'
      : null;

  const estadoParceiro =
    utilizador.papel === 'parceiro_entrega'
      ? utilizador.estado_parceiro_entrega === 'aprovado'
        ? 'Aprovado'
        : utilizador.estado_parceiro_entrega === 'suspenso'
          ? 'Suspenso'
          : utilizador.estado_parceiro_entrega === 'documentos_pendentes'
            ? 'Documentos pendentes'
            : 'Em análise'
      : null;

  const menu =
    utilizador.papel === 'vendedor' && !vendedorAprovado
      ? menuBase.filter(
          item =>
            item.caminho !== '/dashboard/adicionar' &&
            item.caminho !== '/dashboard/adicionar-servico'
        )
      : menuBase;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">

      {/* HEADER MOBILE */}
      <header className="border-b-2 border-green-900 bg-green-800 sticky top-0 z-50 shadow-sm">
        <div className="w-full px-4 md:px-6 flex items-center justify-between h-14 md:h-16">

          <div className="flex items-center gap-3">

            <button
              onClick={() => setMenuAberto(!menuAberto)}
              className="lg:hidden text-white hover:text-green-200 transition-colors"
              aria-label="Abrir menu"
            >
              {menuAberto ? (
                <X size={20} />
              ) : (
                <Menu size={20} />
              )}
            </button>

            <Link
              to={utilizador.papel === 'parceiro_entrega' ? '/dashboard' : '/'}
              className="flex items-center gap-2 group transition-opacity hover:opacity-90"
            >
              <Leaf
                className="w-7 h-7 text-white fill-green-600"
                strokeWidth={2.8}
              />

              <span className="font-titulo text-xl md:text-2xl font-bold tracking-tight text-white">
                ANGROLINK
              </span>
            </Link>

          </div>

          <div className="flex items-center gap-3">

            <span className="font-corpo text-sm text-white hidden sm:block">
              {utilizador.nome}
            </span>

            <button
              onClick={handleLogout}
              title="Sair"
              className="text-white hover:text-red-200 transition-colors"
            >
              <LogOut size={18} />
            </button>

          </div>

        </div>
      </header>


      <div className="flex flex-1">

        {/* SIDEBAR DESKTOP */}
        <aside className="hidden lg:flex flex-col w-56 border-r-2 border-border bg-background shrink-0">

          <div className="border-b-2 border-border p-5">

            <div className="rounded-2xl bg-green-50 border border-green-100 p-5">

              <div className="flex flex-col items-center text-center">

                {fotoPerfilAssinada || (utilizador.papel !== 'parceiro_entrega' && utilizador.foto_perfil) ? (

                  <img
                    src={fotoPerfilAssinada || utilizador.foto_perfil}
                    alt={utilizador.nome}
                    className="
                      w-24
                      h-24
                      rounded-full
                      object-cover
                      border-4
                      border-white
                      shadow-md
                    "
                  />

                ) : (

                  <div
                    className="
                      flex
                      items-center
                      justify-center
                      w-24
                      h-24
                      rounded-full
                      bg-green-700
                      text-white
                      text-3xl
                      font-bold
                      shadow-md
                    "
                  >
                    {inicialNome}
                  </div>

                )}

                <h2 className="mt-4 text-base font-bold text-foreground">
                  {utilizador.nome}
                </h2>

                <p className="text-sm text-muted-foreground">
                  Conta {nomePapel}
                </p>

                {estadoVendedor && (

                  <div
                    className={`
                      mt-3
                      rounded-full
                      px-3
                      py-1
                      text-xs
                      font-semibold

                      ${
                        utilizador.status_aprovacao === 'aprovado'
                          ? 'bg-green-100 text-green-700'
                          : utilizador.status_aprovacao === 'suspenso'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }
                    `}
                  >
                    {utilizador.status_aprovacao === 'aprovado'
                      ? '🟢 Conta aprovada'
                      : utilizador.status_aprovacao === 'suspenso'
                      ? '🔴 Conta suspensa'
                      : '🟡 Em aprovação'}
                  </div>

                )}

                {estadoParceiro && (
                  <div
                    className={`mt-3 rounded-full px-3 py-1 text-xs font-semibold ${
                      utilizador.estado_parceiro_entrega === 'aprovado'
                        ? 'bg-green-100 text-green-700'
                        : utilizador.estado_parceiro_entrega === 'suspenso'
                          ? 'bg-red-100 text-red-700'
                          : utilizador.estado_parceiro_entrega === 'documentos_pendentes'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {estadoParceiro}
                  </div>
                )}

              </div>

            </div>

          </div>

          <nav className="flex-1 py-4">

            {menu.map(item => {
              const ativo =
                location.pathname === item.caminho;

              return (
                <Link
                  key={item.caminho}
                  to={item.caminho}
                  className={`flex items-center gap-3 px-4 py-2.5 font-corpo text-sm transition-colors ${
                    ativo
                      ? 'bg-green-700 text-white border-r-2 border-green-900 font-medium'
                      : 'text-muted-foreground hover:text-green-700 hover:bg-green-50'
                  }`}
                >
                  <item.icone size={18} />
                  {item.rotulo}
                </Link>
              );
            })}

          </nav>

          <div className="border-t-2 border-border p-4">
            <Link
              to={utilizador.papel === 'parceiro_entrega' ? '/dashboard' : '/'}
              className="flex items-center gap-2 font-corpo text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={14} />
              Voltar ao site
            </Link>
          </div>

        </aside>


        {/* SIDEBAR MOBILE */}
        {menuAberto && (
          <div className="lg:hidden fixed inset-x-0 top-14 bottom-0 z-40 flex md:top-16">

            <div className="w-64 bg-background border-r-2 border-border flex flex-col shadow-lg overflow-y-auto">

              <nav className="flex-1 py-4">
                {menu.map(item => {
                  const ativo =
                    location.pathname === item.caminho;

                  return (
                    <Link
                      key={item.caminho}
                      to={item.caminho}
                      onClick={() =>
                        setMenuAberto(false)
                      }
                      className={`flex items-center gap-3 px-4 py-3 font-corpo text-sm transition-colors ${
                        ativo
                          ? 'bg-green-700 text-white border-r-2 border-green-900 font-medium'
                          : 'text-muted-foreground hover:text-green-700 hover:bg-green-50'
                      }`}
                    >
                      <item.icone size={18} />
                      {item.rotulo}
                    </Link>
                  );
                })}
              </nav>

              <div className="border-t-2 border-border p-4">
                <Link
                  to={utilizador.papel === 'parceiro_entrega' ? '/dashboard' : '/'}
                  onClick={() =>
                    setMenuAberto(false)
                  }
                  className="flex items-center gap-2 font-corpo text-xs text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft size={14} />
                  Voltar ao site
                </Link>
              </div>

            </div>

            {/* OVERLAY */}
            <div
              className="flex-1 bg-foreground/20"
              onClick={() =>
                setMenuAberto(false)
              }
            />

          </div>
        )}


        {/* CONTEÚDO */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>

      </div>
    </div>
  );
}
