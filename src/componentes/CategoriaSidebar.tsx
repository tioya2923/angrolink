/**
 * ========================================
 * MENU DE CATEGORIAS
 * ========================================
 * Botão "Todas as Categorias" que abre um menu suspenso
 * com a lista de categorias, ao estilo Alibaba.
 * Usada no cabeçalho (navbar), em todas as páginas.
 */

import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { fetchCategorias, guardarHistoricoPesquisa } from '@/services/api';
import { useAuth } from '@/contextos/AuthContexto';
import { obterIconeCategoria } from '@/lib/iconesCategoria';

import { ChevronRight, Menu } from 'lucide-react';

interface CategoriaSidebarProps {
  variante?: 'bloco' | 'navbar';
}

export default function CategoriaSidebar({ variante = 'bloco' }: CategoriaSidebarProps) {
  const [categorias, setCategorias] = useState<any[]>([]);
  const [aberto, setAberto] = useState(false);
  const { utilizador, tipoComprador } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const navbar = variante === 'navbar';

  useEffect(() => {
    async function carregar() {
      const data = await fetchCategorias();
      setCategorias(data || []);
    }

    carregar();
  }, []);

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div
      ref={containerRef}
      className={
        navbar
          ? 'relative shrink-0'
          : 'relative w-full lg:w-64 shrink-0 self-start'
      }
    >
      <button
        type="button"
        onClick={() => setAberto(a => !a)}
        aria-expanded={aberto}
        className={
          navbar
            ? 'flex items-center gap-1 font-corpo text-sm font-medium text-white hover:text-green-200 transition-colors'
            : 'flex items-center gap-2 w-full lg:w-64 px-4 py-3 bg-sidebar text-sidebar-foreground border-2 border-sidebar-border/60 font-titulo text-sm font-semibold hover:bg-sidebar-accent transition-colors'
        }
      >
        <Menu size={16} />
        {navbar ? 'Categorias' : 'Todas as Categorias'}
      </button>

      {aberto && (
        <nav
          className={
            navbar
              ? 'absolute z-40 top-full left-0 mt-2 w-64 bg-sidebar text-sidebar-foreground border-2 border-sidebar-border/60 shadow-lg'
              : 'absolute z-40 top-full left-0 mt-1 w-full lg:w-64 bg-sidebar text-sidebar-foreground border-2 border-sidebar-border/60 shadow-lg'
          }
        >
          {categorias.map(cat => {
            const nome = cat.nome.toLowerCase().trim();
            const Icone = obterIconeCategoria(nome);

            const destino =
              nome === 'serviços'
                ? '/servicos'
                : `/pesquisa?categoria=${cat.id}`;

            return (
              <Link
                key={cat.id}
                to={destino}
                onClick={() => {
                  setAberto(false);

                  if (nome === 'serviços') return;
                  if (utilizador?.papel === 'admin') return;

                  guardarHistoricoPesquisa({
                    cliente_id: utilizador?.papel === 'cliente' ? utilizador.id : null,
                    categoria_id: cat.id,
                    tipo_comprador: tipoComprador,
                  });
                }}
                className="flex items-center gap-3 px-4 py-3 text-sm border-b border-sidebar-border/60 last:border-b-0 hover:bg-sidebar-accent transition-colors group"
              >
                <Icone size={18} className="shrink-0 text-sidebar-primary" />
                <span className="flex-1 truncate">{cat.nome}</span>
                <ChevronRight
                  size={14}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
