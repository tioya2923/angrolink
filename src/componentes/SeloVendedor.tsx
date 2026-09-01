import { ShieldCheck, Clock, AlertTriangle } from 'lucide-react';

type Props = {
  vendedor?: any;
  compacto?: boolean;
};

export default function SeloVendedor({ vendedor, compacto = false }: Props) {
  if (!vendedor) return null;

  // Perfis públicos são filtrados no servidor para vendedores aprovados e
  // ativos. O estado administrativo não integra o contrato público.
  const status = vendedor.status_aprovacao || 'aprovado';
  const verificado = vendedor.verificado === true;

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
