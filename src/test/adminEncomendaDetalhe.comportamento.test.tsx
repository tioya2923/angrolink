import { StrictMode, useEffect } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import AdminEncomendaDetalhe from "@/paginas/dashboard/admin/AdminEncomendaDetalhe";
import type { EncomendaAdminDetalhe } from "@/services/admin360";

const mocks = vi.hoisted(() => ({
  obter: vi.fn(),
  atribuicao: vi.fn(),
  compatibilidade: vi.fn(),
  atribuir: vi.fn(),
  incidente: vi.fn(),
  libertar: vi.fn(),
  registarIncidente: vi.fn(),
  resolverIncidente: vi.fn(),
  chave: vi.fn(),
  realtime: null as null | (() => void),
}));

vi.mock("@/services/admin360", () => ({
  obterEncomendaAdmin: mocks.obter,
  obterAtribuicaoEntregaEncomendaAdmin: mocks.atribuicao,
  listarCompatibilidadeLogisticaEncomendaAdmin: mocks.compatibilidade,
  atribuirEntregadorEncomenda: mocks.atribuir,
  obterIncidenteOperacionalEntregaAdmin: mocks.incidente,
  libertarAtribuicaoEntregaAdmin: mocks.libertar,
  registarIncidenteOperacionalEntregaAdmin: mocks.registarIncidente,
  resolverIncidenteOperacionalEntregaAdmin: mocks.resolverIncidente,
  criarChaveIdempotenciaAdmin: mocks.chave,
  mensagemErroLogisticaAdmin: () => "Não foi possível concluir a atribuição. Tenta novamente.",
  subscreverAtualizacoesEncomendaAdmin: (_id: string, callback: () => void) => {
    mocks.realtime = callback;
    return () => { mocks.realtime = null; };
  },
}));

function detalhe(id: string, estado = "pronta_para_levantamento"): EncomendaAdminDetalhe {
  return {
    encomenda: { id, codigo_publico: `ENC-${id.toUpperCase()}`, estado, modalidade: "entrega", criado_em: "2026-08-26T09:00:00Z", atualizado_em: "2026-08-26T09:00:00Z", observacoes_cliente: null, moeda: "AOA", motivo_cancelamento: null, motivo_recusa: null },
    cliente: { id: "cliente", nome: "Cliente", email: null, telefone: null, tipo_comprador: null, provincia: "Luanda", municipio: "Luanda" },
    vendedor: { id: "vendedor", nome_comercial: "Mercado", telefone: null, email: null, nome_responsavel: null, provincia: "Luanda", municipio: "Luanda", bairro: null, endereco_detalhado: null, conta_ativa: true, estado: "aprovado" },
    itens: [], eventos: [], financeiro: { total_centimos: 0, comissao_efetiva_centimos: 0 }, disputa: {}, origem: {}, destino: {}, requisitos_logisticos: {}, pagamento: {}, levantamento: {}, atribuicao_entrega: {},
  };
}

const candidato = (nome = "Entregador A") => ({
  parceiro_id: "parceiro-a", parceiro_nome: nome, veiculo_id: "veiculo-a", tipo_veiculo: "Mota", matricula: "LD-01-02-AA",
  capacidade_kg: 30, capacidade_volume_m3: null, possui_refrigeracao: false, possui_caixa_carga: true, aceita_paletes: false,
  areas_cobertura: [], estado: "compativel" as const, motivos: [],
});

function Arvore({ id = "a" }: { id?: string }) {
  return <MemoryRouter initialEntries={[`/dashboard/encomendas/${id}`]}><Routes><Route path="/dashboard/encomendas/:id" element={<AdminEncomendaDetalhe />} /><Route path="/dashboard/encomendas" element={<AdminEncomendaDetalhe />} /></Routes></MemoryRouter>;
}

function RotaMutavel({ id }: { id?: string }) {
  const navegar = useNavigate();
  useEffect(() => { navegar(id ? `/dashboard/encomendas/${id}` : "/dashboard/encomendas"); }, [id, navegar]);
  return <Routes><Route path="/dashboard/encomendas/:id" element={<AdminEncomendaDetalhe />} /><Route path="/dashboard/encomendas" element={<AdminEncomendaDetalhe />} /></Routes>;
}

function ArvoreMutavel({ id }: { id?: string }) {
  return <MemoryRouter initialEntries={[`/dashboard/encomendas/${id ?? ""}`]}><RotaMutavel id={id} /></MemoryRouter>;
}

describe("AdminEncomendaDetalhe — comportamento", () => {
  beforeEach(() => {
    let sequencia = 0;
    mocks.chave.mockImplementation(() => `00000000-0000-4000-8000-${String(++sequencia).padStart(12, "0")}`);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.resetAllMocks(); mocks.realtime = null; });

  it("permite libertar apenas uma atribuição antes da recolha", async () => {
    mocks.obter.mockResolvedValue(detalhe("a"));
    mocks.atribuicao.mockResolvedValue({ id: "atr-a", estado: "aceite", atribuido_em: "2026-08-26T09:00:00Z", aceite_em: "2026-08-26T09:01:00Z" });
    mocks.incidente.mockResolvedValue(null);
    mocks.libertar.mockResolvedValue(undefined);
    render(<Arvore />);
    fireEvent.click(await screen.findByRole("button", { name: "Libertar atribuição" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Motivo" }), { target: { value: "Veículo avariado" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(mocks.libertar).toHaveBeenCalledWith("atr-a", "Veículo avariado", expect.any(String)));
  });

  it("reutiliza a mesma chave quando a mesma libertação é repetida após falha local", async () => {
    mocks.obter.mockResolvedValue(detalhe("a"));
    mocks.atribuicao.mockResolvedValue({ id: "atr-a", estado: "aceite", atribuido_em: "2026-08-26T09:00:00Z", aceite_em: "2026-08-26T09:01:00Z" });
    mocks.incidente.mockResolvedValue(null);
    mocks.libertar.mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce(undefined);
    render(<Arvore />);
    fireEvent.click(await screen.findByRole("button", { name: "Libertar atribuição" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Motivo" }), { target: { value: "Veículo avariado" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(mocks.libertar).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(mocks.libertar).toHaveBeenCalledTimes(2));
    expect(mocks.libertar.mock.calls[0][2]).toBe(mocks.libertar.mock.calls[1][2]);
    expect(mocks.libertar.mock.calls[0][2]).toBe("00000000-0000-4000-8000-000000000001");
    expect(mocks.chave).toHaveBeenCalledTimes(1);
  });

  it("gera nova chave quando o motivo muda materialmente", async () => {
    mocks.obter.mockResolvedValue(detalhe("a"));
    mocks.atribuicao.mockResolvedValue({ id: "atr-a", estado: "aceite", atribuido_em: "2026-08-26T09:00:00Z", aceite_em: "2026-08-26T09:01:00Z" });
    mocks.incidente.mockResolvedValue(null);
    mocks.libertar.mockRejectedValue(new Error("timeout"));
    render(<Arvore />);
    fireEvent.click(await screen.findByRole("button", { name: "Libertar atribuição" }));
    const motivo = screen.getByRole("textbox", { name: "Motivo" });
    fireEvent.change(motivo, { target: { value: "Veículo avariado" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(mocks.libertar).toHaveBeenCalledTimes(1));
    fireEvent.change(motivo, { target: { value: "Motor avariado" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(mocks.libertar).toHaveBeenCalledTimes(2));
    expect(mocks.libertar.mock.calls[0][2]).not.toBe(mocks.libertar.mock.calls[1][2]);
    expect(mocks.chave).toHaveBeenCalledTimes(2);
  });

  it("depois da recolha regista incidente e nunca oferece reatribuição", async () => {
    mocks.obter.mockResolvedValue(detalhe("a", "recolhida"));
    mocks.atribuicao.mockResolvedValue({ id: "atr-a", estado: "recolhida", atribuido_em: "2026-08-26T09:00:00Z", aceite_em: "2026-08-26T09:01:00Z", chegou_origem_em: "2026-08-26T09:02:00Z", recolhida_em: "2026-08-26T09:03:00Z" });
    mocks.incidente.mockResolvedValue(null);
    render(<Arvore />);
    expect(await screen.findByText("A mercadoria está sob custódia do entregador. Não é possível reatribuir esta tarefa.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Libertar atribuição" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registar incidente" })).toBeInTheDocument();
  });

  it("permite escolher novo entregador depois de libertação cancelada", async () => {
    mocks.obter.mockResolvedValue(detalhe("a"));
    mocks.atribuicao.mockResolvedValue({ id: "atr-a", estado: "cancelada", atribuido_em: "2026-08-26T09:00:00Z", cancelado_em: "2026-08-26T09:03:00Z" });
    mocks.incidente.mockResolvedValue(null);
    mocks.compatibilidade.mockResolvedValue([candidato("Entregador B")]);
    render(<Arvore />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver veículos avaliados" }));
    expect(await screen.findByRole("button", { name: "Atribuir" })).toBeEnabled();
  });

  it("mantém o último incidente resolvido e permite registar outro", async () => {
    mocks.obter.mockResolvedValue(detalhe("a", "recolhida"));
    mocks.atribuicao.mockResolvedValue({ id: "atr-a", estado: "recolhida", atribuido_em: "2026-08-26T09:00:00Z", recolhida_em: "2026-08-26T09:03:00Z" });
    mocks.incidente.mockResolvedValue({ id: "inc-1", atribuicao_id: "atr-a", tipo: "problema_veiculo", motivo: "Avaria resolvida", estado: "resolvido", criado_em: "2026-08-26T09:04:00Z", resolvido_em: "2026-08-26T09:05:00Z", observacao_resolucao: "Veículo recuperado" });
    render(<Arvore />);
    expect(await screen.findByText(/Último incidente resolvido/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registar incidente" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Resolver incidente" })).not.toBeInTheDocument();
  });

  it("apresenta loading, erro inicial e retry", async () => {
    mocks.obter.mockRejectedValueOnce(new Error("interno")).mockResolvedValueOnce(detalhe("a"));
    mocks.atribuicao.mockResolvedValue({ estado: "nao_atribuido" });
    render(<Arvore />);
    expect(screen.getByText("A carregar encomenda…")).toBeInTheDocument();
    expect(await screen.findByText("Não foi possível carregar esta encomenda.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("heading", { name: "ENC-A" })).toBeInTheDocument();
  });

  it("termina corretamente em React Strict Mode", async () => {
    mocks.obter.mockResolvedValue(detalhe("a"));
    mocks.atribuicao.mockResolvedValue({ estado: "nao_atribuido" });
    render(<StrictMode><Arvore /></StrictMode>);
    expect(await screen.findByRole("heading", { name: "ENC-A" })).toBeInTheDocument();
    expect(screen.queryByText("A carregar encomenda…")).not.toBeInTheDocument();
  });

  it("termina o loading com erro seguro quando a rota não tem id", async () => {
    render(<MemoryRouter initialEntries={["/dashboard/encomendas"]}><Routes><Route path="/dashboard/encomendas" element={<AdminEncomendaDetalhe />} /></Routes></MemoryRouter>);
    expect(await screen.findByText("Não foi possível carregar esta encomenda.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeEnabled();
  });

  it("não atualiza a interface após desmontagem durante uma consulta", async () => {
    let concluir!: (valor: EncomendaAdminDetalhe) => void;
    mocks.obter.mockReturnValue(new Promise((resolve) => { concluir = resolve; }));
    mocks.atribuicao.mockResolvedValue({ estado: "nao_atribuido" });
    const tela = render(<Arvore />);
    await waitFor(() => expect(mocks.obter).toHaveBeenCalledWith("a"));
    tela.unmount();
    await act(async () => { concluir(detalhe("a")); });
    expect(screen.queryByRole("heading", { name: "ENC-A" })).not.toBeInTheDocument();
  });

  it("nunca apresenta A depois da mudança para B durante carregamento", async () => {
    let resolverA!: (valor: EncomendaAdminDetalhe) => void;
    let resolverB!: (valor: EncomendaAdminDetalhe) => void;
    mocks.obter.mockImplementation((id: string) => new Promise((resolve) => { if (id === "a") resolverA = resolve; else resolverB = resolve; }));
    mocks.atribuicao.mockResolvedValue({ estado: "nao_atribuido" });
    const tela = render(<ArvoreMutavel id="a" />);
    await waitFor(() => expect(mocks.obter).toHaveBeenCalledWith("a"));
    tela.rerender(<ArvoreMutavel id="b" />);
    resolverA(detalhe("a"));
    await waitFor(() => expect(mocks.obter).toHaveBeenCalledWith("b"));
    expect(screen.queryByRole("heading", { name: "ENC-A" })).not.toBeInTheDocument();
    resolverB(detalhe("b"));
    expect(await screen.findByRole("heading", { name: "ENC-B" })).toBeInTheDocument();
  });

  it("preserva a página num refresh de background falhado e recupera no seguinte", async () => {
    mocks.obter.mockResolvedValueOnce(detalhe("a")).mockRejectedValueOnce(new Error("schema interno")).mockResolvedValueOnce(detalhe("a", "recolhida"));
    mocks.atribuicao.mockResolvedValue({ estado: "recolhida", atribuido_em: "2026-08-26T09:00:00Z", aceite_em: "2026-08-26T09:01:00Z", chegou_origem_em: "2026-08-26T09:02:00Z", recolhida_em: "2026-08-26T09:03:00Z" });
    render(<Arvore />);
    await screen.findByRole("heading", { name: "ENC-A" });
    await act(async () => { mocks.realtime?.(); });
    await screen.findByText("Não foi possível atualizar esta encomenda agora.");
    expect(screen.getByRole("heading", { name: "ENC-A" })).toBeInTheDocument();
    await act(async () => { mocks.realtime?.(); });
    expect(await screen.findByText("A custódia foi transferida para o entregador.")).toBeInTheDocument();
  });

  it("mostra marcos e não mostra o aviso de atribuição em recolhida", async () => {
    mocks.obter.mockResolvedValue(detalhe("a", "recolhida"));
    mocks.atribuicao.mockResolvedValue({ estado: "recolhida", atribuido_em: "2026-08-26T09:00:00Z", aceite_em: "2026-08-26T09:01:00Z", chegou_origem_em: "2026-08-26T09:02:00Z", recolhida_em: "2026-08-26T09:03:00Z" });
    render(<Arvore />);
    await screen.findByText("A custódia foi transferida para o entregador.");
    expect(screen.getByRole("list", { name: "Progresso da entrega" })).toBeInTheDocument();
    expect(screen.queryByText("A encomenda precisa estar pronta para recolha antes de atribuir um entregador.")).not.toBeInTheDocument();
    expect(screen.getAllByText((_, elemento) => elemento?.textContent?.includes("0,00") ?? false).length).toBeGreaterThan(0);
  });

  it("não deixa o loading de compatibilidade de A bloquear a rota B", async () => {
    let concluirCompatibilidade!: (valor: []) => void;
    mocks.obter.mockImplementation((id: string) => Promise.resolve(detalhe(id)));
    mocks.atribuicao.mockResolvedValue({ estado: "nao_atribuido" });
    mocks.compatibilidade.mockReturnValue(new Promise((resolve) => { concluirCompatibilidade = resolve; }));
    const tela = render(<ArvoreMutavel id="a" />);
    await screen.findByRole("heading", { name: "ENC-A" });
    fireEvent.click(screen.getByRole("button", { name: "Ver veículos avaliados" }));
    expect(screen.getByRole("button", { name: "A avaliar veículos…" })).toBeDisabled();
    tela.rerender(<ArvoreMutavel id="b" />);
    expect(await screen.findByRole("heading", { name: "ENC-B" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver veículos avaliados" })).toBeEnabled();
    concluirCompatibilidade([]);
  });

  it("mostra que uma atribuição recusada preserva o marco criado", async () => {
    mocks.obter.mockResolvedValue(detalhe("a", "pronta_para_levantamento"));
    mocks.atribuicao.mockResolvedValue({ estado: "recusada", atribuido_em: "2026-08-26T09:00:00Z", recusado_em: "2026-08-26T09:03:00Z", motivo_recusa: "Indisponível" });
    render(<Arvore />);
    await screen.findByText("Entregador recusou esta tarefa.");
    expect(screen.getByLabelText("Atribuição criada: concluído")).toBeInTheDocument();
    expect(screen.getByLabelText("Tarefa aceite: pendente")).toBeInTheDocument();
  });

  it("nunca apresenta o matching antigo de A depois de mudar para B", async () => {
    let concluirA!: (valor: ReturnType<typeof candidato>[]) => void;
    mocks.obter.mockImplementation((id: string) => Promise.resolve(detalhe(id)));
    mocks.atribuicao.mockResolvedValue({ estado: "nao_atribuido" });
    mocks.compatibilidade.mockImplementationOnce(() => new Promise((resolve) => { concluirA = resolve; }));
    const tela = render(<ArvoreMutavel id="a" />);
    await screen.findByRole("heading", { name: "ENC-A" });
    fireEvent.click(screen.getByRole("button", { name: "Ver veículos avaliados" }));
    tela.rerender(<ArvoreMutavel id="b" />);
    await screen.findByRole("heading", { name: "ENC-B" });
    concluirA([candidato("Veículo antigo de A")]);
    await act(async () => {});
    expect(screen.queryByText("Veículo antigo de A")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver veículos avaliados" })).toBeEnabled();
  });

  it("Realtime invalida matching pendente e apenas a nova avaliação aparece", async () => {
    let concluirAntiga!: (valor: ReturnType<typeof candidato>[]) => void;
    mocks.obter.mockResolvedValue(detalhe("a"));
    mocks.atribuicao.mockResolvedValue({ estado: "nao_atribuido" });
    mocks.compatibilidade.mockImplementationOnce(() => new Promise((resolve) => { concluirAntiga = resolve; })).mockResolvedValueOnce([candidato("Avaliação nova")]);
    render(<Arvore />);
    await screen.findByRole("heading", { name: "ENC-A" });
    fireEvent.click(screen.getByRole("button", { name: "Ver veículos avaliados" }));
    await act(async () => { mocks.realtime?.(); });
    concluirAntiga([candidato("Avaliação obsoleta")]);
    await act(async () => {});
    expect(screen.queryByText(/Avaliação obsoleta/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver veículos avaliados" }));
    await waitFor(() => expect(mocks.compatibilidade).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Avaliação nova/)).toBeInTheDocument();
  });

  it("uma atribuição pendente de A não altera a rota B e não duplica cliques", async () => {
    let concluirAtribuicao!: () => void;
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.obter.mockImplementation((id: string) => Promise.resolve(detalhe(id)));
    mocks.atribuicao.mockResolvedValue({ estado: "nao_atribuido" });
    mocks.compatibilidade.mockResolvedValue([candidato()]);
    mocks.atribuir.mockReturnValue(new Promise<void>((resolve) => { concluirAtribuicao = resolve; }));
    const tela = render(<ArvoreMutavel id="a" />);
    await screen.findByRole("heading", { name: "ENC-A" });
    fireEvent.click(screen.getByRole("button", { name: "Ver veículos avaliados" }));
    const atribuir = await screen.findByRole("button", { name: "Atribuir" });
    fireEvent.click(atribuir); fireEvent.click(atribuir);
    expect(mocks.atribuir).toHaveBeenCalledTimes(1);
    tela.rerender(<ArvoreMutavel id="b" />);
    await screen.findByRole("heading", { name: "ENC-B" });
    concluirAtribuicao();
    await act(async () => {});
    expect(screen.getByRole("heading", { name: "ENC-B" })).toBeInTheDocument();
    expect(screen.queryByText(/Avaliação foi atualizada/)).not.toBeInTheDocument();
  });
});
