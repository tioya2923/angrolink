import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ler = (caminho: string) => readFileSync(resolve(process.cwd(), caminho), "utf8");
const pagina = ler("src/paginas/dashboard/admin/AdminEncomendaDetalhe.tsx");
const servico = ler("src/services/admin360.ts");
const util = ler("src/paginas/dashboard/admin/admin360Util.tsx");

describe("Admin Encomenda 360 — ciclo bilateral", () => {
  it("trata os marcos e estados terminais da atribuição sem oferecê-los como nova atribuição", () => {
    for (const valor of ["chegou_origem_em", "recolhida_em", "cancelado_em", "concluido_em", "motivo_cancelamento"]) {
      expect(pagina).toContain(valor);
    }
    expect(pagina).toContain('atribuicaoAtual.estado === "cancelada"');
    expect(pagina).toContain('atribuicaoAtual.estado === "concluida"');
    expect(pagina).toContain('["nao_atribuido", "recusada"].includes(atribuicaoAtual.estado)');
  });

  it("mantém Realtime administrativo no serviço e filtra pelo id da encomenda", () => {
    expect(servico).toContain("subscrcreverAtualizacoesEncomendaAdmin".replace("subscrcrever", "subscrever"));
    expect(servico).toContain("table: \"encomendas\"");
    expect(servico).toContain("table: \"eventos_encomenda\"");
    expect(servico).toContain("encomenda_id=eq.${encomendaId}");
    expect(pagina).not.toContain("supabase.channel(");
  });

  it("não expõe mensagens técnicas de logística e mantém os estados visuais deliberados", () => {
    expect(pagina).toContain('mensagemErroLogisticaAdmin(causa, "atribuicao")');
    expect(pagina).not.toContain("causa instanceof Error ? causa.message");
    expect(util).toContain("incompativel");
    expect(util).toContain("dados_incompletos");
    expect(util).toContain("chegou_origem");
    expect(util).toContain("valor ??");
  });
});
