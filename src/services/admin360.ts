import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/services/supabase";
import type { Database, Json } from "@/types/database.types";

type Rpc = Database["public"]["Functions"];

export type EncomendaAdminResumo =
  Rpc["listar_encomendas_admin"]["Returns"][number];
export type FinanceiroAdminResumo =
  Rpc["listar_financeiro_admin"]["Returns"][number];
export type DisputaAdminResumo =
  Rpc["listar_disputas_admin"]["Returns"][number];
export type DisputaAdmin = Rpc["assumir_disputa_admin"]["Returns"];

export interface FiltrosEncomendasAdmin {
  estado?: string;
  estadoPagamento?: string;
  comDisputa?: boolean;
  de?: string;
  ate?: string;
}

export interface ItemAdminEncomenda {
  id: string;
  nome: string;
  descricao: string | null;
  imagem_url: string | null;
  quantidade: number;
  unidade: string | null;
  valor_unitario_centimos: number;
  subtotal_centimos: number;
  tipo_preco: string | null;
  peso_por_unidade_comercial_kg: number | null;
  volume_por_unidade_comercial_m3: number | null;
  requer_refrigeracao: boolean | null;
  requer_caixa_carga: boolean | null;
  requer_paletes: boolean | null;
}

export interface EventoAdminEncomenda {
  tipo: string;
  ator: string;
  estado_anterior: string | null;
  estado_novo: string | null;
  criado_em: string;
  metadados: Json;
}

export interface EncomendaAdminDetalhe {
  encomenda: {
    id: string;
    codigo_publico: string;
    estado: string;
    modalidade: string;
    criado_em: string;
  atualizado_em: string;
  observacoes_cliente: string | null;
  moeda: string;
  motivo_cancelamento: string | null;
  motivo_recusa: string | null;
  };
  cliente: {
    id: string;
    nome: string;
    email: string | null;
  telefone: string | null;
  tipo_comprador: string | null;
  provincia: string | null;
  municipio: string | null;
  };
  vendedor: {
    id: string;
    nome_comercial: string;
  telefone: string | null;
  email: string | null;
  nome_responsavel: string | null;
  provincia: string | null;
  municipio: string | null;
  bairro: string | null;
  endereco_detalhado: string | null;
  conta_ativa: boolean | null;
    estado: string;
  };
  itens: ItemAdminEncomenda[];
  eventos: EventoAdminEncomenda[];
  financeiro: Record<string, Json>;
  disputa: Record<string, Json>;
  origem: Record<string, Json>;
  destino: Record<string, Json>;
  requisitos_logisticos: Record<string, Json>;
  pagamento: Record<string, Json>;
  levantamento: Record<string, Json>;
  atribuicao_entrega: Record<string, Json>;
}

export interface CompatibilidadeLogisticaAdmin {
  parceiro_id: string;
  parceiro_nome: string;
  veiculo_id: string;
  tipo_veiculo: string;
  matricula: string;
  capacidade_kg: number;
  capacidade_volume_m3: number | null;
  possui_refrigeracao: boolean;
  possui_caixa_carga: boolean;
  aceita_paletes: boolean;
  areas_cobertura: Json;
  estado: "compativel" | "incompativel" | "dados_incompletos";
  motivos: string[];
}

export interface AtribuicaoEntregaAdmin {
  id?: string;
  estado: "atribuida" | "aceite" | "chegou_origem" | "recolhida" | "chegou_destino" | "recusada" | "cancelada" | "concluida" | "nao_atribuido";
  atribuido_em?: string;
  aceite_em?: string | null;
  chegou_origem_em?: string | null;
  recolhida_em?: string | null;
  chegou_destino_em?: string | null;
  recusado_em?: string | null;
  cancelado_em?: string | null;
  concluido_em?: string | null;
  motivo_recusa?: string | null;
  motivo_cancelamento?: string | null;
  parceiro_id?: string;
  parceiro_nome?: string;
  veiculo_id?: string;
  veiculo_tipo?: string;
  matricula?: string;
  atribuido_por?: string;
  admin_nome?: string | null;
}

type OperacaoLogisticaAdmin = "carregar" | "compatibilidade" | "atribuicao" | "libertacao" | "incidente";

class ErroLogisticaAdminSeguro extends Error {
  readonly seguro = true;

  constructor(
    readonly operacao: OperacaoLogisticaAdmin,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

const MENSAGENS_DOMINIO_LOGISTICA: Record<OperacaoLogisticaAdmin, readonly string[]> = {
  carregar: ["Encomenda não encontrada.", "Sem permissão administrativa."],
  compatibilidade: ["Encomenda não encontrada.", "Sem permissão administrativa."],
  atribuicao: [
    "Encomenda não encontrada.",
    "Sem permissão administrativa.",
    "A encomenda precisa estar pronta para recolha antes de atribuir um entregador.",
    "Esta encomenda já possui uma atribuição ativa.",
    "O veículo indicado não pertence ao parceiro de entrega.",
    "O parceiro de entrega já não está elegível para receber entregas.",
    "O veículo já não está operacional para entregas.",
  ],
  libertacao: ["Sem permissão administrativa.", "Atribuição não encontrada.", "Esta encomenda já não pode ter a atribuição libertada."],
  incidente: ["Sem permissão administrativa.", "Atribuição não encontrada.", "Incidente operacional não encontrado.", "Já existe um incidente operacional aberto para esta tarefa.", "Este incidente operacional já foi resolvido."],
};

function erroLogisticaSeguro(
  operacao: OperacaoLogisticaAdmin,
  erro: { code?: string; message?: string } | null,
): Error {
  const mensagem = erro?.message?.trim() ?? "";
  const incompatibilidadeDinamica = operacao === "atribuicao"
    && mensagem.startsWith("O veículo deixou de ser compatível com esta encomenda:");
  const permitida = MENSAGENS_DOMINIO_LOGISTICA[operacao].includes(mensagem);
  if (erro?.code === "P0001" && (permitida || incompatibilidadeDinamica)) {
    return new ErroLogisticaAdminSeguro(
      operacao,
      incompatibilidadeDinamica
        ? "O veículo deixou de ser compatível com esta encomenda. Atualiza a avaliação e escolhe outro."
        : mensagem,
    );
  }
  return new Error("Erro administrativo de logística.");
}

function registarFalhaLogistica(operacao: OperacaoLogisticaAdmin, erro: unknown): void {
  if (!import.meta.env.DEV || typeof erro !== "object" || erro === null) return;
  const candidato = erro as { code?: unknown; message?: unknown };
  console.warn("Falha administrativa de logística", {
    operacao,
    code: typeof candidato.code === "string" ? candidato.code : undefined,
    message: typeof candidato.message === "string" ? candidato.message : undefined,
  });
}

export function mensagemErroLogisticaAdmin(
  erro: unknown,
  operacao: OperacaoLogisticaAdmin,
): string {
  if (erro instanceof ErroLogisticaAdminSeguro && erro.operacao === operacao) {
    return erro.message;
  }
  return {
    carregar: "Não foi possível carregar esta encomenda.",
    compatibilidade: "Não foi possível avaliar os veículos. Tenta novamente.",
    atribuicao: "Não foi possível concluir a atribuição. Tenta novamente.",
    libertacao: "Não foi possível libertar esta atribuição. Tenta novamente.",
    incidente: "Não foi possível registar a intervenção operacional. Tenta novamente.",
  }[operacao];
}

type RespostaRpc<T> = {
  data: T | null;
  error: { code?: string; message: string } | null;
};

type RpcCompatibilidadeLogistica = (
  nome: "listar_compatibilidade_logistica_encomenda_admin",
  argumentos: { p_encomenda_id: string },
) => Promise<RespostaRpc<CompatibilidadeLogisticaAdmin[]>>;

type RpcAtribuirEntrega = (
  nome: "atribuir_entregador_encomenda",
  argumentos: { p_encomenda_id: string; p_parceiro_id: string; p_veiculo_id: string },
) => Promise<RespostaRpc<{ id: string; estado: string }>>;

type RpcIntervencaoEntrega = (
  nome: "libertar_atribuicao_entrega_admin" | "registar_incidente_operacional_entrega_admin" | "resolver_incidente_operacional_entrega_admin",
  argumentos: Record<string, string>,
) => Promise<RespostaRpc<{ id: string; estado: string }>>;

// A assinatura ainda não existe em database.types.ts porque a migration está
// deliberadamente pendente. O contrato local é removível após a regeneração.
const rpcCompatibilidadeLogistica = supabase.rpc.bind(supabase) as unknown as RpcCompatibilidadeLogistica;
const rpcAtribuirEntrega = supabase.rpc.bind(supabase) as unknown as RpcAtribuirEntrega;
const rpcIntervencaoEntrega = supabase.rpc.bind(supabase) as unknown as RpcIntervencaoEntrega;

export interface IncidenteOperacionalEntregaAdmin {
  id: string;
  atribuicao_id: string;
  tipo: string;
  motivo: string;
  estado: "aberto" | "resolvido";
  criado_em: string;
  resolvido_em: string | null;
  observacao_resolucao: string | null;
}

export interface AuditoriaAdministrativa {
  acao: string;
  estado_anterior: string | null;
  estado_novo: string;
  motivo: string | null;
  criado_em: string;
}

export interface DisputaAdminDetalhe {
  disputa: {
    id: string;
    estado: string;
    tipo: string;
    descricao: string;
    valor_reclamado_centimos: number | null;
    criado_em: string;
    atualizado_em: string;
    analisado_por: string | null;
    analisado_em: string | null;
    resolvido_por: string | null;
    resolvido_em: string | null;
    decisao: string | null;
    observacao_resolucao: string | null;
  };
  encomenda: EncomendaAdminDetalhe;
  auditoria: AuditoriaAdministrativa[];
}

function comoDetalheEncomenda(data: Json): EncomendaAdminDetalhe {
  return data as unknown as EncomendaAdminDetalhe;
}

function comoDetalheDisputa(data: Json): DisputaAdminDetalhe {
  return data as unknown as DisputaAdminDetalhe;
}

export async function listarEncomendasAdmin(
  filtros: FiltrosEncomendasAdmin = {},
): Promise<EncomendaAdminResumo[]> {
  const { data, error } = await supabase.rpc("listar_encomendas_admin", {
    p_estado: filtros.estado || null,
    p_estado_pagamento: filtros.estadoPagamento || null,
    p_com_disputa: filtros.comDisputa,
    p_de: filtros.de || null,
    p_ate: filtros.ate || null,
  });
  if (error) throw error;
  return data ?? [];
}

export async function obterEncomendaAdmin(
  encomendaId: string,
): Promise<EncomendaAdminDetalhe> {
  const { data, error } = await supabase.rpc("obter_encomenda_admin", {
    p_encomenda_id: encomendaId,
  });
  if (error) throw error;
  return comoDetalheEncomenda(data);
}

export async function listarCompatibilidadeLogisticaEncomendaAdmin(
  encomendaId: string,
): Promise<CompatibilidadeLogisticaAdmin[]> {
  const { data, error } = await rpcCompatibilidadeLogistica(
    "listar_compatibilidade_logistica_encomenda_admin",
    { p_encomenda_id: encomendaId },
  );
  if (error) {
    registarFalhaLogistica("compatibilidade", error);
    throw erroLogisticaSeguro("compatibilidade", error);
  }
  return data ?? [];
}

export async function obterAtribuicaoEntregaEncomendaAdmin(
  encomendaId: string,
): Promise<AtribuicaoEntregaAdmin> {
  const { data, error } = await supabase.rpc(
    "obter_atribuicao_entrega_encomenda_admin",
    { p_encomenda_id: encomendaId },
  );
  if (error) {
    registarFalhaLogistica("carregar", error);
    throw erroLogisticaSeguro("carregar", error);
  }
  return data ? data as unknown as AtribuicaoEntregaAdmin : { estado: "nao_atribuido" };
}

export async function atribuirEntregadorEncomenda(
  encomendaId: string,
  parceiroId: string,
  veiculoId: string,
): Promise<void> {
  const { error } = await rpcAtribuirEntrega("atribuir_entregador_encomenda", {
    p_encomenda_id: encomendaId,
    p_parceiro_id: parceiroId,
    p_veiculo_id: veiculoId,
  });
  if (error) {
    registarFalhaLogistica("atribuicao", error);
    throw erroLogisticaSeguro("atribuicao", error);
  }
}

export async function libertarAtribuicaoEntregaAdmin(atribuicaoId: string, motivo: string, chaveIdempotencia: string): Promise<void> {
  const { error } = await rpcIntervencaoEntrega("libertar_atribuicao_entrega_admin", {
    p_atribuicao_id: atribuicaoId, p_motivo: motivo.trim(), p_chave_idempotencia: chaveIdempotencia,
  });
  if (error) { registarFalhaLogistica("libertacao", error); throw erroLogisticaSeguro("libertacao", error); }
}

export async function registarIncidenteOperacionalEntregaAdmin(atribuicaoId: string, tipo: string, motivo: string, chaveIdempotencia: string): Promise<void> {
  const { error } = await rpcIntervencaoEntrega("registar_incidente_operacional_entrega_admin", {
    p_atribuicao_id: atribuicaoId, p_tipo: tipo, p_motivo: motivo.trim(), p_chave_idempotencia: chaveIdempotencia,
  });
  if (error) { registarFalhaLogistica("incidente", error); throw erroLogisticaSeguro("incidente", error); }
}

export async function resolverIncidenteOperacionalEntregaAdmin(incidenteId: string, observacao: string, chaveIdempotencia: string): Promise<void> {
  const { error } = await rpcIntervencaoEntrega("resolver_incidente_operacional_entrega_admin", {
    p_incidente_id: incidenteId, p_observacao: observacao.trim(), p_chave_idempotencia: chaveIdempotencia,
  });
  if (error) { registarFalhaLogistica("incidente", error); throw erroLogisticaSeguro("incidente", error); }
}

export async function obterIncidenteOperacionalEntregaAdmin(encomendaId: string): Promise<IncidenteOperacionalEntregaAdmin | null> {
  const rpcObterIncidente = supabase.rpc.bind(supabase) as unknown as (
    nome: "obter_incidente_operacional_entrega_admin",
    argumentos: { p_encomenda_id: string },
  ) => Promise<RespostaRpc<IncidenteOperacionalEntregaAdmin | Record<string, never>>>;
  const { data, error } = await rpcObterIncidente(
    "obter_incidente_operacional_entrega_admin", { p_encomenda_id: encomendaId },
  );
  if (error) { registarFalhaLogistica("incidente", error); throw erroLogisticaSeguro("incidente", error); }
  return data && "id" in data ? data as IncidenteOperacionalEntregaAdmin : null;
}

export function subscreverAtualizacoesEncomendaAdmin(
  encomendaId: string,
  aoAtualizar: () => void,
): () => void {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const agendarAtualizacao = () => {
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(aoAtualizar, 150);
  };
  const canal: RealtimeChannel = supabase
    .channel(`admin-encomenda-${encomendaId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "encomendas", filter: `id=eq.${encomendaId}` }, agendarAtualizacao)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "eventos_encomenda", filter: `encomenda_id=eq.${encomendaId}` }, agendarAtualizacao)
    .subscribe();

  return () => {
    if (temporizador) clearTimeout(temporizador);
    void supabase.removeChannel(canal);
  };
}

export async function listarFinanceiroAdmin(): Promise<
  FinanceiroAdminResumo[]
> {
  const { data, error } = await supabase.rpc("listar_financeiro_admin");
  if (error) throw error;
  return data ?? [];
}

export async function listarDisputasAdmin(
  estado?: string,
): Promise<DisputaAdminResumo[]> {
  const { data, error } = await supabase.rpc("listar_disputas_admin", {
    p_estado: estado || null,
  });
  if (error) throw error;
  return data ?? [];
}

export async function obterDisputaAdmin(
  disputaId: string,
): Promise<DisputaAdminDetalhe> {
  const { data, error } = await supabase.rpc("obter_disputa_admin", {
    p_disputa_id: disputaId,
  });
  if (error) throw error;
  return comoDetalheDisputa(data);
}

export async function assumirDisputaAdmin(
  disputaId: string,
): Promise<DisputaAdmin> {
  const { data, error } = await supabase.rpc("assumir_disputa_admin", {
    p_disputa_id: disputaId,
  });
  if (error) throw error;
  return data;
}

export async function resolverDisputaSemReembolsoAdmin(
  disputaId: string,
  observacao: string,
): Promise<DisputaAdmin> {
  const { data, error } = await supabase.rpc(
    "resolver_disputa_sem_reembolso_admin",
    {
      p_disputa_id: disputaId,
      p_observacao: observacao.trim(),
    },
  );
  if (error) throw error;
  return data;
}

export interface ReembolsoParcialAdminInput {
  disputaId: string;
  valorProdutosCentimos: number;
  valorEntregaCentimos: number;
  observacao: string;
  chaveIdempotencia: string;
}

export async function resolverDisputaReembolsoParcialAdmin(
  input: ReembolsoParcialAdminInput,
): Promise<DisputaAdmin> {
  const { data, error } = await supabase.rpc(
    "resolver_disputa_reembolso_parcial_admin",
    {
      p_disputa_id: input.disputaId,
      p_valor_produtos_centimos: input.valorProdutosCentimos,
      p_valor_entrega_centimos: input.valorEntregaCentimos,
      p_valor_taxa_processador_centimos: 0,
      p_observacao: input.observacao.trim(),
      p_chave_idempotencia: input.chaveIdempotencia,
    },
  );
  if (error) throw error;
  return data;
}

export async function resolverDisputaReembolsoTotalAdmin(
  disputaId: string,
  observacao: string,
  chaveIdempotencia: string,
): Promise<DisputaAdmin> {
  const { data, error } = await supabase.rpc(
    "resolver_disputa_reembolso_total_admin",
    {
      p_disputa_id: disputaId,
      p_observacao: observacao.trim(),
      p_chave_idempotencia: chaveIdempotencia,
    },
  );
  if (error) throw error;
  return data;
}

export function criarChaveIdempotenciaAdmin(): string {
  return crypto.randomUUID();
}
