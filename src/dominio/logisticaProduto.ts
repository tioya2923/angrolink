export type OpcaoTriState = 'sim' | 'nao' | 'indefinido';

export interface AtributosLogisticosProduto {
  peso_por_unidade_comercial_kg: number | null;
  volume_por_unidade_comercial_m3: number | null;
  requer_refrigeracao: boolean | null;
  requer_caixa_carga: boolean | null;
  requer_paletes: boolean | null;
}

interface EntradaAtributosLogisticosProduto {
  unidade: string;
  pesoPorUnidade: string;
  volumePorUnidade: string;
  refrigeracao: OpcaoTriState;
  caixaCarga: OpcaoTriState;
  paletes: OpcaoTriState;
}

type ResultadoAtributosLogisticosProduto =
  | { valido: true; atributos: AtributosLogisticosProduto }
  | { valido: false; mensagem: string };

export function opcaoTriStateParaValor(valor: boolean | null | undefined): OpcaoTriState {
  if (valor === true) return 'sim';
  if (valor === false) return 'nao';
  return 'indefinido';
}

export function valorParaOpcaoTriState(opcao: OpcaoTriState): boolean | null {
  if (opcao === 'sim') return true;
  if (opcao === 'nao') return false;
  return null;
}

function numeroOpcionalPositivo(valor: string, campo: string): number | null | string {
  const normalizado = valor.trim().replace(',', '.');
  if (!normalizado) return null;

  const numero = Number(normalizado);
  if (!Number.isFinite(numero) || numero <= 0) {
    return `Indique um valor válido e maior que zero para ${campo}.`;
  }

  return numero;
}

export function normalizarAtributosLogisticosProduto(
  entrada: EntradaAtributosLogisticosProduto,
): ResultadoAtributosLogisticosProduto {
  const unidade = entrada.unidade.trim().toLowerCase();
  const peso = unidade === 'kg'
    ? null
    : numeroOpcionalPositivo(entrada.pesoPorUnidade, 'o peso aproximado');
  const volume = numeroOpcionalPositivo(entrada.volumePorUnidade, 'o volume aproximado');

  if (typeof peso === 'string') return { valido: false, mensagem: peso };
  if (typeof volume === 'string') return { valido: false, mensagem: volume };

  return {
    valido: true,
    atributos: {
      peso_por_unidade_comercial_kg: peso,
      volume_por_unidade_comercial_m3: volume,
      requer_refrigeracao: valorParaOpcaoTriState(entrada.refrigeracao),
      requer_caixa_carga: valorParaOpcaoTriState(entrada.caixaCarga),
      requer_paletes: valorParaOpcaoTriState(entrada.paletes),
    },
  };
}
