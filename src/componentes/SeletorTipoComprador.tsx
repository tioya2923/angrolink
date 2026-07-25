/**
 * ========================================
 * SELETOR TIPO COMPRADOR
 * ========================================
 * Permite escolher se compra para casa ou negócio.
 * Funciona mesmo sem login e afeta apenas produtos.
 */

import { Home, Building2 } from 'lucide-react';
import { useAuth } from '@/contextos/AuthContexto';
import { TipoComprador } from '@/tipos';

export default function SeletorTipoComprador() {
  const { tipoComprador, atualizarTipoComprador } = useAuth();

  const opcoes: {
    valor: TipoComprador;
    rotulo: string;
    icone: React.ReactNode;
    desc: string;
  }[] = [
    {
      valor: 'casa',
      rotulo: 'Para Casa',
      icone: <Home size={16} />,
      desc: 'Compras em pequenas quantidades',
    },
    {
      valor: 'negocio',
      rotulo: 'Para Negócio',
      icone: <Building2 size={16} />,
      desc: 'Compras por grosso',
    },
  ];

  return (
    <div className="flex gap-2">
      {opcoes.map(op => (
        <button
          key={op.valor}
          type="button"
          onClick={() => atualizarTipoComprador(op.valor)}
          className={`flex items-center gap-2 px-4 py-2 border-2 font-corpo text-sm transition-colors ${
            tipoComprador === op.valor
              ? 'border-green-600 bg-green-600 text-primary-foreground hover:border-primary/50'
              : 'border-border bg-background text-foreground hover:border-primary/50'
          }`}
          title={op.desc}
        >
          {op.icone}
          {op.rotulo}
        </button>
      ))}
    </div>
  );
}
