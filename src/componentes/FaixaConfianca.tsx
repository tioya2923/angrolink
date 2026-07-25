/**
 * ========================================
 * FAIXA DE CONFIANÇA
 * ========================================
 * Selos curtos ao estilo "Trade Assurance" da Alibaba,
 * para reforçar confiança logo na hero da homepage.
 */

import { ShieldCheck, Package, MessageCircle, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';

const ITENS = [
  {
    Icone: ShieldCheck,
    texto: 'Vendedores verificados',
    destino: '/como-funciona#verificados',
  },
  {
    Icone: Package,
    texto: 'Grosso & Retalho',
    destino: '/pesquisa',
  },
  {
    Icone: MessageCircle,
    texto: 'Contacto direto por WhatsApp',
    destino: '/como-funciona#whatsapp',
  },
  {
    Icone: Truck,
    texto: 'Entrega em várias províncias',
    destino: '/como-funciona#entrega',
  },
];

export default function FaixaConfianca() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {ITENS.map(({ Icone, texto, destino }) => (
        <Link
          key={texto}
          to={destino}
          className="flex items-center gap-2 px-2.5 py-2 bg-white/10 border border-white/20 hover:bg-white/20 transition-colors"
        >
          <Icone size={16} className="shrink-0 text-white" />
          <span className="font-corpo text-xs text-white leading-tight">
            {texto}
          </span>
        </Link>
      ))}
    </div>
  );
}
