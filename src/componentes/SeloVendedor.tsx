import { ShieldCheck, Star, Flame, Clock, AlertTriangle } from 'lucide-react';

type Props = {
  vendedor?: any;
  compacto?: boolean;
};

export default function SeloVendedor({ vendedor, compacto = false }: Props) {
  if (!vendedor) return null;

  const status = vendedor.status_aprovacao || 'pendente';
  const verificado = vendedor.verificado === true;
  const plano = vendedor.plano || 'gratuito';
  const podeDestacar = vendedor.pode_destacar === true;

  if (status === 'suspenso' || status === 'rejeitado') {
    return (
      <span className="inline-flex items-center gap-1 border border-red-500/30 bg-red-50 text-red-700 px-2 py-0.5 text-[10px] font-medium">
        <AlertTriangle size={12} />
        {compacto ? 'Indisponível' : 'Vendedor indisponível'}
      </span>
    );
  }

  if (status === 'pendente') {
    return (
      <span className="inline-flex items-center gap-1 border border-yellow-500/30 bg-yellow-50 text-yellow-700 px-2 py-0.5 text-[10px] font-medium">
        <Clock size={12} />
        {compacto ? 'Em análise' : 'Vendedor em análise'}
      </span>
    );
  }

  if (status === 'aprovado' && verificado && plano === 'premium') {
    return (
      <span className="inline-flex items-center gap-1 border border-green-700 bg-green-700 text-white px-2 py-0.5 text-[10px] font-semibold">
        <Flame size={12} />
        {compacto ? 'Top' : 'Top vendedor'}
      </span>
    );
  }

  if (status === 'aprovado' && verificado && (plano === 'destaque' || podeDestacar)) {
    return (
      <span className="inline-flex items-center gap-1 border border-green-700/30 bg-green-50 text-green-800 px-2 py-0.5 text-[10px] font-semibold">
        <Star size={12} />
        {compacto ? 'Recomendado' : 'Vendedor recomendado'}
      </span>
    );
  }

  if (status === 'aprovado' && verificado) {
    return (
      <span className="inline-flex items-center gap-1 border border-green-700/20 bg-green-50 text-green-700 px-2 py-0.5 text-[10px] font-semibold">
        <ShieldCheck size={12} />
        {compacto ? 'Verificado' : 'Vendedor verificado'}
      </span>
    );
  }

  if (status === 'aprovado') {
    return (
      <span className="inline-flex items-center gap-1 border border-green-700/10 bg-green-50/40 text-green-700 px-2 py-0.5 text-[10px] font-medium">
        <ShieldCheck size={12} />
        {compacto ? 'Ativo' : 'Vendedor ativo'}
      </span>
    );
  }

  return null;
}