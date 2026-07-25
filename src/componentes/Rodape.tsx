/**
 * ========================================
 * RODAPÉ — Versão premium
 * ========================================
 */

import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone, ArrowUpRight, Instagram, Facebook, MessageCircle } from 'lucide-react';
import { useAuth } from '@/contextos/AuthContexto';

export default function Rodape() {
  const { autenticado } = useAuth();

  return (
    <footer className="relative mt-20 bg-slate-950 text-white overflow-hidden">

      {/* Glow decorativo */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute -top-20 left-1/2 w-[600px] h-[600px] bg-primary blur-[120px] rounded-full -translate-x-1/2" />
      </div>

      <div className="relative container py-12 md:py-16">

        {/* GRID */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">

          {/* BRAND */}
          <div className="space-y-4">
            <h3 className="font-titulo text-2xl font-bold tracking-tight text-white">
              ANGROLINK
            </h3>

            <p className="font-corpo text-sm text-white/70 leading-relaxed">
              Conectamos produtores, vendedores, prestadores de serviços e
              compradores em Angola, criando visibilidade e oportunidades
              reais de negócio.
            </p>

            {/* CTA */}
            <a
              href="https://wa.me/244000000000"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition"
            >
              Falar no WhatsApp <ArrowUpRight size={14} />
            </a>
          </div>

          {/* NAVEGAÇÃO */}
          <div>
            <h4 className="font-titulo text-sm font-semibold mb-4 text-white/90">
              Navegação
            </h4>

            <ul className="space-y-2">
              <li>
                <Link
                  to="/"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="text-sm text-white/70 hover:text-green-400 transition"
                >
                  Início
                </Link>
              </li>
              <li>
                <Link to="/pesquisa" className="text-sm text-white/70 hover:text-green-400 transition">
                  Produtos
                </Link>
              </li>
              <li>
                <Link to="/servicos" className="text-sm text-white/70 hover:text-green-400 transition">
                  Serviços
                </Link>
              </li>
              {!autenticado && (
                <li>
                  <Link to="/anunciar" className="text-sm text-white/70 hover:text-green-400 transition">
                    Anunciar
                  </Link>
                </li>
              )}
            </ul>
          </div>

          {/* EMPRESA */}
          <div>
            <h4 className="font-titulo text-sm font-semibold mb-4 text-white/90">
              Empresa
            </h4>

            <ul className="space-y-2">
              <li>
                <Link
                  to="/sobre-nos"
                  className="text-sm text-white/70 hover:text-green-400 transition"
                >
                  Sobre nós
                </Link>
              </li>
              <li>
                <Link to="/como-funciona" className="text-sm text-white/70 hover:text-green-400 transition">
                  Como funciona
                </Link>
              </li>
              <li>
                <Link to="/termos" className="text-sm text-white/70 hover:text-green-400 transition">
                  Termos
                </Link>
              </li>
              <li>
                <Link to="/privacidade" className="text-sm text-white/70 hover:text-green-400 transition">
                  Privacidade
                </Link>
              </li>
            </ul>
          </div>

          {/* CONTACTOS */}
          <div>
            <h4 className="font-titulo text-sm font-semibold mb-4 text-white/90">
              Contactos
            </h4>

            <div className="space-y-3 text-sm text-white/70">
              <div className="flex items-center gap-2">
                <Mail size={16} />
                <span>info@angrolink.co.ao</span>
              </div>

              <div className="flex items-center gap-2">
                <Phone size={16} />
                <span>+244 900 000 000</span>
              </div>

              <div className="flex items-center gap-2">
                <MapPin size={16} />
                <span>Luanda, Angola</span>
              </div>
            </div>
          </div>
        </div>

        {/* DIVISOR */}
        <div className="border-t border-white/10 mt-12 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">

          <p className="text-xs text-white/50">
            © {new Date().getFullYear()} ANGROLINK. Todos os direitos reservados.
          </p>

          {/* SOCIAL / EXTRA */}
          <div className="flex items-center gap-4 text-xs text-white/50">
            <Instagram size={16} />
            <Facebook size={16} />
            <a
              href="https://wa.me/244000000000"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-green-400 transition"
            >
              <MessageCircle size={16} />
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
}