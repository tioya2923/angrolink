/**
 * ========================================
 * CABEÇALHO — Navegação dinâmica por papel
 * ========================================
 */

import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, Leaf, LogIn, LogOut, User, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contextos/AuthContexto';
import CategoriaSidebar from '@/componentes/CategoriaSidebar';

export default function Cabecalho() {
  const [menuAberto, setMenuAberto] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState(false);
  const { utilizador, autenticado, logout } = useAuth();
  const navigate = useNavigate();
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
          { to: '/dashboard', label: 'Menu' },
          { to: '/dashboard/vendedores', label: 'Vendedores' },
          { to: '/dashboard/pedidos-vendedores', label: 'Pedidos' },
          { to: '/dashboard/utilizadores', label: 'Utilizadores' },
          { to: '/dashboard/produtos', label: 'Produtos' },
          { to: '/dashboard/rankings', label: 'Rankings' },
        ];
      case 'vendedor':
        return [
          { to: '/dashboard', label: 'Menu' },
          { to: '/dashboard/produtos', label: 'Meus Produtos' },
          { to: '/dashboard/servicos', label: 'Meus Serviços' },
          { to: '/dashboard/favoritos', label: 'Favoritos' },
          { to: '/dashboard/adicionar', label: 'Adicionar Produto' },
          { to: '/dashboard/adicionar-servico', label: 'Adicionar Serviço' },
          { to: "/dashboard/desempenho", label: "Desempenho" },
          { to: "/dashboard/contactos", label: "Contactos" },
          { to: '/dashboard/estatisticas', label: 'Estatísticas' },
          { to: '/dashboard/perfil', label: 'Perfil' },
        ];
      case 'parceiro_entrega':
        return [
          { to: '/dashboard', label: 'Central de entregas' },
          { to: '/dashboard/pedidos', label: 'Pedidos de entrega' },
          { to: '/dashboard/veiculo', label: 'Veículo e disponibilidade' },
          { to: '/dashboard/areas', label: 'Áreas de cobertura' },
          { to: '/dashboard/documentos', label: 'Documentos' },
          { to: '/dashboard/apoio', label: 'Apoio ANGROLINK' },
        ];
      case 'cliente':
      default:
        return [
          { to: '/dashboard', label: 'Menu' },
          { to: '/dashboard/historico', label: 'Histórico' },
          { to: '/dashboard/favoritos', label: 'Favoritos' },
          { to: '/dashboard/recomendacoes', label: 'Recomendações' },
          { to: '/dashboard/definicoes', label: 'Definições' },
        ];
    }
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
                <div className="absolute right-0 top-full mt-2 w-56 bg-card border-2 border-border rounded-md shadow-lg py-1 z-50">
                  <div className="px-4 py-2 border-b border-border">
                    <p className="font-corpo text-sm font-semibold text-foreground">{utilizador.nome}</p>
                    <p className="font-corpo text-xs text-muted-foreground">{utilizador.email}</p>
                  </div>
                  {linksPerfil().map(l => (
                    <Link
                      key={l.to}
                      to={l.to}
                      onClick={() => setPerfilAberto(false)}
                      className="block px-4 py-2 font-corpo text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      {l.label}
                    </Link>
                  ))}
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 font-corpo text-sm text-destructive hover:bg-muted transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Mobile toggle */}
        <button
          onClick={() => setMenuAberto(!menuAberto)}
          className="md:hidden p-2 text-white hover:text-green-200 transition-colors"
          aria-label="Abrir menu"
        >
          {menuAberto ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuAberto && (
        <nav className="md:hidden border-t-2 border-border bg-background">
          <div className="container py-4 flex flex-col gap-3">
            <CategoriaSidebar />

            {linksPublicos.map(l => (
              <Link key={l.to} to={l.to} className="font-corpo text-base font-medium text-foreground py-2" onClick={fecharMenu}>
                {l.label}
              </Link>
            ))}

            {!autenticado && (
              <>
                <Link to="/anunciar" className="btn-whatsapp font-titulo text-center py-3" onClick={fecharMenu}>
                  Quero Anunciar
                </Link>
                <Link to="/login" className="font-corpo text-base font-medium text-foreground py-2 flex items-center gap-2" onClick={fecharMenu}>
                  <LogIn className="w-4 h-4" />
                  Entrar
                </Link>
              </>
            )}

            {autenticado && utilizador && (
              <>
                <div className="border-t border-border pt-3 mt-1">
                  <p className="font-corpo text-xs text-muted-foreground mb-2">
                    {utilizador.nome} · {utilizador.email}
                  </p>
                </div>
                {linksPerfil().map(l => (
                  <Link key={l.to} to={l.to} className="font-corpo text-base font-medium text-foreground py-2" onClick={fecharMenu}>
                    {l.label}
                  </Link>
                ))}
                <button
                  onClick={handleLogout}
                  className="font-corpo text-base font-medium text-destructive py-2 flex items-center gap-2 text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
