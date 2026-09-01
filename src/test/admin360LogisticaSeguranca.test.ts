import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  on: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
}));

vi.mock("@/services/supabase", () => ({
  supabase: {
    rpc: mocks.rpc,
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  },
}));

import {
  atribuirEntregadorEncomenda,
  listarCompatibilidadeLogisticaEncomendaAdmin,
  mensagemErroLogisticaAdmin,
  subscreverAtualizacoesEncomendaAdmin,
} from "@/services/admin360";

describe("segurança do service Admin 360", () => {
  afterEach(() => { vi.resetAllMocks(); });

  it("expõe apenas erro P0001 permitido e oculta schema cache", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "Encomenda não encontrada." } });
    await expect(listarCompatibilidadeLogisticaEncomendaAdmin("e")).rejects.toSatisfy((erro: unknown) => mensagemErroLogisticaAdmin(erro, "compatibilidade") === "Encomenda não encontrada.");
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "schema cache rpc interna" } });
    await expect(listarCompatibilidadeLogisticaEncomendaAdmin("e")).rejects.toSatisfy((erro: unknown) => mensagemErroLogisticaAdmin(erro, "compatibilidade") === "Não foi possível avaliar os veículos. Tenta novamente.");
  });

  it("não reutiliza um erro seguro numa operação diferente", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "Encomenda não encontrada." } });
    let erro: unknown;
    try { await listarCompatibilidadeLogisticaEncomendaAdmin("e"); } catch (causa) { erro = causa; }
    expect(mensagemErroLogisticaAdmin(erro, "atribuicao")).toBe("Não foi possível concluir a atribuição. Tenta novamente.");
  });

  it("converte incompatibilidade dinâmica em mensagem fixa sem códigos internos", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "O veículo deixou de ser compatível com esta encomenda: fora_area_cobertura." } });
    let erro: unknown;
    try { await atribuirEntregadorEncomenda("e", "p", "v"); } catch (causa) { erro = causa; }
    expect(mensagemErroLogisticaAdmin(erro, "atribuicao")).toBe("O veículo deixou de ser compatível com esta encomenda. Atualiza a avaliação e escolhe outro.");
    expect(mensagemErroLogisticaAdmin(erro, "atribuicao")).not.toContain("fora_area_cobertura");
  });

  it("oculta P0001 desconhecido", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "relation privada interna" } });
    let erro: unknown;
    try { await listarCompatibilidadeLogisticaEncomendaAdmin("e"); } catch (causa) { erro = causa; }
    expect(mensagemErroLogisticaAdmin(erro, "compatibilidade")).toBe("Não foi possível avaliar os veículos. Tenta novamente.");
  });

  it("usa filtros de Realtime e limpa o canal", () => {
    const canal = { on: mocks.on, subscribe: vi.fn() };
    canal.subscribe.mockReturnValue(canal);
    mocks.on.mockReturnValue(canal);
    mocks.channel.mockReturnValue(canal);
    const limpar = subscreverAtualizacoesEncomendaAdmin("encomenda-a", vi.fn());
    expect(mocks.on).toHaveBeenCalledWith("postgres_changes", expect.objectContaining({ table: "encomendas", filter: "id=eq.encomenda-a" }), expect.any(Function));
    expect(mocks.on).toHaveBeenCalledWith("postgres_changes", expect.objectContaining({ table: "eventos_encomenda", filter: "encomenda_id=eq.encomenda-a" }), expect.any(Function));
    limpar();
    expect(mocks.removeChannel).toHaveBeenCalledWith(canal);
  });

  it("cancela a atualização agendada ao limpar o canal", () => {
    vi.useFakeTimers();
    const canal = { on: mocks.on, subscribe: vi.fn() };
    canal.subscribe.mockReturnValue(canal);
    mocks.on.mockReturnValue(canal);
    mocks.channel.mockReturnValue(canal);
    const atualizar = vi.fn();
    const limpar = subscreverAtualizacoesEncomendaAdmin("encomenda-a", atualizar);
    const callback = mocks.on.mock.calls[0][2] as () => void;
    callback();
    limpar();
    vi.advanceTimersByTime(150);
    expect(atualizar).not.toHaveBeenCalled();
    expect(mocks.removeChannel).toHaveBeenCalledWith(canal);
    vi.useRealTimers();
  });
});
