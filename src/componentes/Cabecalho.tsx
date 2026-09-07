/**
 * ========================================
 * CABEÇALHO — Navegação dinâmica por papel
 * ========================================
 */

import { Link, useLocation,  useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Banknote,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Clock,
  FileCheck2,
  Heart,
  LayoutDashboard,
  Leaf,
  LogIn,
  LogOut,
  MapPinned,
  Menu,
  MessageSquare,
  Package,
  PlusCircle,
  Scale,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Truck,
  User,
  UserCircle,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contextos/AuthContexto';
import CategoriaSidebar from '@/componentes/CategoriaSidebar';
import { useCarrinho } from '@/hooks/useCarrinho';
import NotificacoesMenu from '@/componentes/NotificacoesMenu';

export default function Cabecalho() {
  const [menuAberto, setMenuAberto] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState(false);
  const { utilizador, autenticado, logout } = useAuth();
  const { quantidadeItens } = useCarrinho();
  const navigate = useNavigate();
  const location = useLocation();
  const perfilRef = useRef<HTMLDivElement>(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (perfilRef.current && !perfilRef.current.contains(e.target as Node)) {
        setPerfilAberto(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    setPerfilAberto(false);
    setMenuAberto(false);
    navigate('/');
  };

  const fecharMenu = () => setMenuAberto(false);

  const linksPublicos = utilizador?.papel === 'parceiro_entrega' ? [] : [
    { to: '/pesquisa', label: 'Produtos' },
    { to: '/servicos', label: 'Serviços' },
  ];

  const linksPerfil = () => {
    if (!utilizador) return [];
    switch (utilizador.papel) {
      case 'admin':
        return [
          { to: '/dashboard', label: 'Menu', icone: LayoutDashboard },
          { to: '/dashboard/vendedores', label: 'Vendedores', icone: Users },
          { to: '/dashboard/compradores', label: 'Compradores', icone: ShoppingBag },
          { to: '/dashboard/pedidos-vendedores', label: 'Pedidos', icone: UserCircle },
          { to: '/dashboard/entregadores', label: 'Entregadores', icone: Truck },
          { to: '/dashboard/utilizadores', label: 'Utilizadores', icone: ShieldCheck },
          { to: '/dashboard/produtos', label: 'Produtos', icone: Package },
          { to: '/dashboard/rankings', label: 'Rankings', icone: BarChart3 },
          { to: '/dashboard/encomendas', label: 'Encomendas', icone: ClipboardList },
          { to: '/dashboard/financeiro', label: 'Financeiro', icone: Banknote },
          { to: '/dashboard/disputas', label: 'Disputas', icone: Scale },
        ];
      case 'vendedor':
        return [
          { to: '/dashboard', label: 'Menu', icone: LayoutDashboard },
          { to: '/dashboard/produtos', label: 'Meus Produtos', icone: Package },
          { to: '/dashboard/servicos', label: 'Meus Serviços', icone: Wrench },
          { to: '/dashboard/favoritos', label: 'Favoritos', icone: Heart },
          { to: '/dashboard/adicionar', label: 'Adicionar Produto', icone: PlusCircle },
          { to: '/dashboard/adicionar-servico', label: 'Adicionar Serviço', icone: PlusCircle },
          { to: '/dashboard/desempenho', label: 'Desempenho', icone: BarChart3 },
          { to: '/dashboard/contactos', label: 'Contactos', icone: MessageSquare },
          { to: '/dashboard/estatisticas', label: 'Estatísticas', icone: BarChart3 },
          { to: '/dashboard/perfil', label: 'Perfil', icone: UserCircle },
          { to: '/dashboard/encomendas', label: 'Encomendas', icone: ClipboardList },
          { to: '/dashboard/compras', label: 'Minhas compras', icone: ShoppingBag },
          { to: '/dashboard/documentos', label: 'Documentos', icone: FileCheck2 },
        ];
      case 'parceiro_entrega':
        return [
          { to: '/dashboard', label: 'Resumo', icone: LayoutDashboard },
          { to: '/dashboard/dados', label: 'Dados e perfil', icone: UserCircle },
          { to: '/dashboard/tarefas', label: 'Tarefas de entrega', icone: ClipboardList },
          { to: '/dashboard/veiculo', label: 'Veículo e disponibilidade', icone: Truck },
          { to: '/dashboard/areas', label: 'Cobertura', icone: MapPinned },
          { to: '/dashboard/documentos', label: 'Documentos', icone: FileCheck2 },
          { to: '/dashboard/apoio', label: 'Apoio ANGROLINK', icone: CircleHelp },
        ];
      case 'cliente':
      default:
        return [
          { to: '/dashboard', label: 'Menu', icone: LayoutDashboard },
          { to: '/dashboard/encomendas', label: 'Encomendas', icone: ClipboardList },
          { to: '/dashboard/historico', label: 'Histórico', icone: Clock },
          { to: '/dashboard/favoritos', label: 'Favoritos', icone: Heart },
          { to: '/dashboard/recomendacoes', label: 'Recomendações', icone: Sparkles },
          { to: '/dashboard/definicoes', label: 'Definições', icone: Settings },
        ];
    }
  };

  const nomePapel =
    utilizador?.papel === 'admin'
      ? 'Administrador'
      : utilizador?.papel === 'vendedor'
        ? 'Vendedor'
        : utilizador?.papel === 'parceiro_entrega'
          ? 'Parceiro de entregas'
          : 'Cliente';

  const linkPerfilAtivo = (to: string) => {
    if (to === '/dashboard') {
      return location.pathname === '/dashboard';
    }

    return (
      location.pathname === to ||
      location.pathname.startsWith(`${to}/`)
    );
  };

  return (
    <header className="border-b-2 border-border bg-green-800 sticky top-0 z-50">
      <div className="w-full px-4 md:px-8 flex items-center justify-between h-14 md:h-16">
        <Link to={utilizador?.papel === 'parceiro_entrega' ? '/dashboard' : '/'} className="flex items-center gap-2 group transition-opacity hover:opacity-90 font-titulo text-xl md:text-2xl font-bold tracking-tight text-foreground">
          <Leaf className="w-7 h-7 text-green-700 fill-green-600/100 text-white" strokeWidth={3} />
          <span className="font-titulo text-xl md:text-2xl font-bold tracking-tight text-white">
            ANGROLINK
          </span>
        </Link>

        {/* Desktop */}
        <nav className="hidden md:flex items-center gap-6">
          <CategoriaSidebar variante="navbar" />

          {linksPublicos.map(l => (
            <Link key={l.to} to={l.to} className="font-corpo text-sm font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1 text-white">
              {l.label}
            </Link>
          ))}

          <Link to="/carrinho" aria-label={`Carrinho com ${quantidadeItens} itens`} className="relative rounded-lg p-2 text-white hover:bg-white/10" title="Carrinho">
            <ShoppingCart className="size-5" />
            {quantidadeItens > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-amber-400 px-1 text-center text-[10px] font-bold text-green-950">{quantidadeItens > 99 ? '99+' : quantidadeItens}</span>}
          </Link>

          {autenticado && utilizador && <NotificacoesMenu />}

          {!autenticado && (
            <>
              <Link to="/login" className="font-corpo text-sm font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1 text-white">
                <LogIn className="w-4 h-4 text-white" />
                Entrar
              </Link>
              <Link to="/anunciar" className="btn-whatsapp font-titulo text-sm px-4 py-2">
                Quero Anunciar
              </Link>
            </>
          )}

          {autenticado && utilizador && (
            <div className="relative" ref={perfilRef}>
              <button
                onClick={() => setPerfilAberto(!perfilAberto)}
                className="flex items-center gap-2 font-corpo text-sm font-medium text-white hover:text-green-200 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="hidden lg:inline">{utilizador.nome}</span>
                <ChevronDown className={`w-3 h-3 text-white transition-transform ${perfilAberto ? 'rotate-180' : ''}`} />
              </button>

              {perfilAberto && (
                <div
                  className="
                    absolute right-0 top-full z-50 mt-3
                    w-72 overflow-hidden
                    rounded-2xl
                    border-2 border-border
                    bg-background
                    shadow-2xl
                  "
                >
                  {/* Perfil */}
                  <div className="border-b-2 border-border bg-green-50 p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="
                          flex size-11 shrink-0 items-center justify-center
                          rounded-full
                          bg-green-700
                          font-titulo text-lg font-bold text-white
                          shadow-sm
                        "
                      >
                        {utilizador.nome?.charAt(0).toUpperCase() || '?'}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-titulo text-sm font-bold text-foreground">
                          {utilizador.nome}
                        </p>

                        <p className="truncate font-corpo text-xs text-muted-foreground">
                          {utilizador.email}
                        </p>

                        <span
                          className="
                            mt-1 inline-flex rounded-full
                            bg-green-100 px-2 py-0.5
                            font-corpo text-[11px] font-semibold text-green-700
                          "
                        >
                          Conta {nomePapel}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Navegação */}
                  <div className="max-h-[60vh] overflow-y-auto py-2">
                    {linksPerfil().map(l => {
                      const Icone = l.icone;
                      const ativo = linkPerfilAtivo(l.to);

                      return (
                        <Link
                          key={l.to}
                          to={l.to}
                          onClick={() => setPerfilAberto(false)}
                          className={`
                            mx-2 flex items-center gap-3
                            rounded-lg px-3 py-2.5
                            font-corpo text-sm
                            transition-colors
                            ${
                              ativo
                                ? 'bg-green-700 font-medium text-white'
                                : 'text-muted-foreground hover:bg-green-50 hover:text-green-700'
                            }
                          `}
                        >
                          <Icone size={18} className="shrink-0" />

                          <span>{l.label}</span>
                        </Link>
                      );
                    })}
                  </div>

                  {/* Sair */}
                  <div className="border-t-2 border-border p-2">
                    <button
                      onClick={handleLogout}
                      className="
                        flex w-full items-center gap-3
                        rounded-lg px-3 py-2.5
                        font-corpo text-sm font-medium
                        text-destructive
                        transition-colors
                        hover:bg-destructive/10
                      "
                    >
                      <LogOut size={18} />
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Mobile toggle */}
        <div className="flex items-center gap-1 md:hidden">
          {autenticado && utilizador && <NotificacoesMenu />}
          <button
            onClick={() => setMenuAberto(!menuAberto)}
            className="p-2 text-white hover:text-green-200 transition-colors"
            aria-label="Abrir menu"
          >
            {menuAberto ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuAberto && (
        <div className="fixed inset-x-0 bottom-0 top-14 z-40 flex md:hidden">
          <nav
            className="
              flex w-[min(20rem,88vw)] flex-col
              border-r-2 border-border
              bg-background
              shadow-2xl
            "
          >
            {autenticado && utilizador ? (
              <>
                {/* Perfil */}
                <div className="border-b-2 border-border bg-green-50 p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="
                        flex size-12 shrink-0 items-center justify-center
                        rounded-full
                        bg-green-700
                        font-titulo text-lg font-bold text-white
                        shadow-md
                      "
                    >
                      {utilizador.nome?.charAt(0).toUpperCase() || '?'}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-titulo text-sm font-bold text-foreground">
                        {utilizador.nome}
                      </p>

                      <p className="truncate font-corpo text-xs text-muted-foreground">
                        {utilizador.email}
                      </p>

                      <span
                        className="
                          mt-1 inline-flex rounded-full
                          bg-green-100 px-2 py-0.5
                          font-corpo text-[11px] font-semibold text-green-700
                        "
                      >
                        Conta {nomePapel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Conteúdo com scroll */}
                <div className="flex-1 overflow-y-auto">
                  {/* Explorar o marketplace */}
                  {utilizador.papel !== 'parceiro_entrega' && (
                    <div className="border-b border-border px-3 py-3">
                      <p className="mb-2 px-2 font-corpo text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Explorar
                      </p>

                      <div className="px-2 py-1">
                        <CategoriaSidebar />
                      </div>

                      {linksPublicos.map(l => {
                        const Icone =
                          l.to === '/pesquisa'
                            ? Package
                            : Wrench;

                        return (
                          <Link
                            key={l.to}
                            to={l.to}
                            onClick={fecharMenu}
                            className="
                              flex items-center gap-3
                              rounded-lg px-3 py-2.5
                              font-corpo text-sm
                              text-muted-foreground
                              transition-colors
                              hover:bg-green-50 hover:text-green-700
                            "
                          >
                            <Icone size={18} className="shrink-0" />
                            {l.label}
                          </Link>
                        );
                      })}

                      <Link
                        to="/carrinho"
                        onClick={fecharMenu}
                        className="
                          flex items-center justify-between
                          rounded-lg px-3 py-2.5
                          font-corpo text-sm
                          text-muted-foreground
                          transition-colors
                          hover:bg-green-50 hover:text-green-700
                        "
                      >
                        <span className="flex items-center gap-3">
                          <ShoppingCart size={18} className="shrink-0" />
                          Carrinho
                        </span>

                        {quantidadeItens > 0 && (
                          <span
                            className="
                              min-w-5 rounded-full
                              bg-amber-400 px-1.5 py-0.5
                              text-center text-[10px] font-bold text-green-950
                            "
                          >
                            {quantidadeItens > 99 ? '99+' : quantidadeItens}
                          </span>
                        )}
                      </Link>
                    </div>
                  )}

                  {/* Menu do painel */}
                  <div className="py-3">
                    <p className="mb-2 px-5 font-corpo text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Painel
                    </p>

                    {linksPerfil().map(l => {
                      const Icone = l.icone;
                      const ativo = linkPerfilAtivo(l.to);

                      return (
                        <Link
                          key={l.to}
                          to={l.to}
                          onClick={fecharMenu}
                          className={`
                            mx-2 flex items-center gap-3
                            rounded-lg px-3 py-3
                            font-corpo text-sm
                            transition-colors
                            ${
                              ativo
                                ? 'bg-green-700 font-medium text-white shadow-sm'
                                : 'text-muted-foreground hover:bg-green-50 hover:text-green-700'
                            }
                          `}
                        >
                          <Icone size={18} className="shrink-0" />
                          <span>{l.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {/* Sair fixo no fundo */}
                <div className="border-t-2 border-border bg-background p-3">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="
                      flex w-full items-center gap-3
                      rounded-lg px-3 py-2.5
                      font-corpo text-sm font-medium
                      text-destructive
                      transition-colors
                      hover:bg-destructive/10
                    "
                  >
                    <LogOut size={18} />
                    Sair
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Mobile para utilizador não autenticado */}
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  <CategoriaSidebar />

                  {linksPublicos.map(l => (
                    <Link
                      key={l.to}
                      to={l.to}
                      onClick={fecharMenu}
                      className="
                        flex items-center gap-3
                        rounded-lg px-3 py-2.5
                        font-corpo text-sm font-medium
                        text-foreground
                        transition-colors
                        hover:bg-green-50 hover:text-green-700
                      "
                    >
                      {l.to === '/pesquisa' ? (
                        <Package size={18} />
                      ) : (
                        <Wrench size={18} />
                      )}

                      {l.label}
                    </Link>
                  ))}

                  <Link
                    to="/carrinho"
                    onClick={fecharMenu}
                    className="
                      flex items-center gap-3
                      rounded-lg px-3 py-2.5
                      font-corpo text-sm font-medium
                      text-foreground
                      transition-colors
                      hover:bg-green-50 hover:text-green-700
                    "
                  >
                    <ShoppingCart size={18} />
                    Carrinho
                    {quantidadeItens > 0 && ` (${quantidadeItens})`}
                  </Link>

                  <Link
                    to="/login"
                    onClick={fecharMenu}
                    className="
                      flex items-center gap-3
                      rounded-lg px-3 py-2.5
                      font-corpo text-sm font-medium
                      text-foreground
                      transition-colors
                      hover:bg-green-50 hover:text-green-700
                    "
                  >
                    <LogIn size={18} />
                    Entrar
                  </Link>

                  <Link
                    to="/anunciar"
                    onClick={fecharMenu}
                    className="btn-whatsapp block py-3 text-center font-titulo"
                  >
                    Quero Anunciar
                  </Link>
                </div>
              </>
            )}
          </nav>

          {/* Overlay */}
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={fecharMenu}
            className="flex-1 bg-foreground/30 backdrop-blur-[1px]"
          />
        </div>
      )}
    </header>
  );
}
