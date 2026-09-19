import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contextos/AuthContexto';

export default function Rodape() {
  const { autenticado } = useAuth();

  return (
    <footer className="relative mt-20 overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute -top-20 left-1/2 size-[600px] -translate-x-1/2 rounded-full bg-primary blur-[120px]" />
      </div>

      <div className="relative container py-12 md:py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          <div className="space-y-4">
            <h3 className="font-titulo text-2xl font-bold tracking-tight text-white">ANGROLINK</h3>
            <p className="font-corpo text-sm leading-relaxed text-white/70">
              Ligamos compradores e vendedores para descobrir, conversar e comprar produtos na plataforma.
            </p>
            <Link
              to="/como-funciona"
              className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm text-white transition hover:bg-green-700"
            >
              Como funciona <ArrowUpRight size={14} />
            </Link>
          </div>

          <div>
            <h4 className="mb-4 font-titulo text-sm font-semibold text-white/90">Navegação</h4>
            <ul className="space-y-2">
              <li><Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-sm text-white/70 transition hover:text-green-400">Início</Link></li>
              <li><Link to="/pesquisa" className="text-sm text-white/70 transition hover:text-green-400">Produtos</Link></li>
              {!autenticado && <li><Link to="/anunciar" className="text-sm text-white/70 transition hover:text-green-400">Anunciar</Link></li>}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-titulo text-sm font-semibold text-white/90">Empresa</h4>
            <ul className="space-y-2">
              <li><Link to="/sobre-nos" className="text-sm text-white/70 transition hover:text-green-400">Sobre nós</Link></li>
              <li><Link to="/como-funciona" className="text-sm text-white/70 transition hover:text-green-400">Como funciona</Link></li>
              <li><Link to="/termos" className="text-sm text-white/70 transition hover:text-green-400">Termos</Link></li>
              <li><Link to="/privacidade" className="text-sm text-white/70 transition hover:text-green-400">Privacidade</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 md:flex-row">
          <p className="text-xs text-white/50">© {new Date().getFullYear()} ANGROLINK. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
