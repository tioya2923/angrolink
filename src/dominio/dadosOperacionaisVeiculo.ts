export type RespostaEquipamentoVeiculo = "sim" | "nao" | "";

export interface EntradaDadosOperacionaisVeiculo {
  capacidadeKg: string;
  volume: string;
  refrigeracao: RespostaEquipamentoVeiculo;
  caixa: RespostaEquipamentoVeiculo;
  paletes: RespostaEquipamentoVeiculo;
}

export interface DadosOperacionaisVeiculo {
  capacidade_kg: number;
  capacidade_volume_m3: number | null;
  possui_refrigeracao: boolean;
  possui_caixa_carga: boolean;
  aceita_paletes: boolean;
}

export type ResultadoDadosOperacionaisVeiculo =
  | { valido: true; dados: DadosOperacionaisVeiculo }
  | { valido: false; mensagem: string };

export function respostaEquipamentoParaBoolean(
  resposta: RespostaEquipamentoVeiculo,
): boolean | null {
  if (resposta === "sim") return true;
  if (resposta === "nao") return false;
  return null;
}

export function booleanParaRespostaEquipamento(
  possuiEquipamento: boolean,
): Exclude<RespostaEquipamentoVeiculo, ""> {
  return possuiEquipamento ? "sim" : "nao";
}

function numeroDecimalDaEntrada(valor: string): number {
  const normalizado = valor.trim().replace(',', '.');

  // Aceita a vírgula usada habitualmente em português, mas não tenta adivinhar
  // formatos ambíguos como "1,000.5" ou texto parcial.
  if (!/^\d+(?:\.\d+)?$/.test(normalizado)) return Number.NaN;
  return Number(normalizado);
}

export function normalizarDadosOperacionaisVeiculo(
  entrada: EntradaDadosOperacionaisVeiculo,
): ResultadoDadosOperacionaisVeiculo {
  const capacidadeKg = numeroDecimalDaEntrada(entrada.capacidadeKg);
  if (!Number.isFinite(capacidadeKg) || capacidadeKg <= 0) {
    return { valido: false, mensagem: "Indique uma capacidade máxima de carga válida." };
  }

  const volumePreenchido = entrada.volume.trim() !== "";
  const volume = volumePreenchido
    ? numeroDecimalDaEntrada(entrada.volume)
    : null;
  if (volumePreenchido && (!Number.isFinite(volume) || volume === null || volume <= 0)) {
    return { valido: false, mensagem: "Indique um volume aproximado válido ou deixe o campo em branco." };
  }

  const refrigeracao = respostaEquipamentoParaBoolean(entrada.refrigeracao);
  const caixa = respostaEquipamentoParaBoolean(entrada.caixa);
  const paletes = respostaEquipamentoParaBoolean(entrada.paletes);
  if (refrigeracao === null || caixa === null || paletes === null) {
    return { valido: false, mensagem: "Responda às três perguntas sobre o equipamento do veículo." };
  }

  return {
    valido: true,
    dados: {
      capacidade_kg: capacidadeKg,
      capacidade_volume_m3: volume,
      possui_refrigeracao: refrigeracao,
      possui_caixa_carga: caixa,
      aceita_paletes: paletes,
    },
  };
}
