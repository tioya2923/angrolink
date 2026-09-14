import { ShieldCheck } from 'lucide-react';

interface VendedorComVerificacao { verificado?: boolean | null; }
interface SeloVendedorProps { vendedor?: VendedorComVerificacao | null; compacto?: boolean; }

const explicacao = 'A ANGROLINK confirmou a identidade e os dados cadastrais deste vendedor.';
const limite = 'A verificação não representa garantia sobre produtos, entregas ou transações.';

export default function SeloVendedor({ vendedor, compacto = false }: SeloVendedorProps) {
  if (vendedor?.verificado !== true) return null;

  if (compacto) return <span aria-label="Identidade do vendedor verificada pela ANGROLINK" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-700/20 bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700"><ShieldCheck aria-hidden="true" size={12} />Verificado</span>;

  return <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-green-800"><span aria-label="Identidade do vendedor verificada pela ANGROLINK" title={explicacao} tabIndex={0} className="inline-flex items-center gap-1 rounded-full border border-green-700/20 bg-green-50 px-2 py-0.5 text-xs font-semibold"><ShieldCheck aria-hidden="true" size={14} />Identidade verificada</span><span className="sr-only">{explicacao}</span><span className="text-xs text-muted-foreground">{limite}</span></span>;
}
