import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ler = (ficheiro: string) => readFileSync(resolve(process.cwd(), ficheiro), "utf8");

const carrinho = ler("src/paginas/PaginaCarrinho.tsx");
const checkout = ler("src/paginas/PaginaCheckoutPendente.tsx");
const admin = ler("src/paginas/dashboard/admin/AdminEncomendaDetalhe.tsx");
const tarefas = ler("src/paginas/dashboard/parceiro/ParceiroTarefas.tsx");
const cobertura = ler("src/componentes/parceiro/GestaoAreasCobertura.tsx");
const migration = ler("supabase/migrations/20260823030000_corrigir_fluxo_atribuicao_e_cobertura_entrega.sql");

describe("fluxo até aceite do entregador", () => {
  it("permite cliente e vendedor comprador continuarem do carrinho ao checkout", () => {
    expect(carrinho).toMatch(/utilizador\.papel !== ['"]cliente['"]\s*&&\s*utilizador\.papel !== ['"]vendedor['"]/);
    expect(checkout).toMatch(/utilizador\?\.papel === ['"]vendedor['"]\s*\?\s*['"]\/dashboard\/compras['"]\s*:\s*['"]\/dashboard\/encomendas['"]/);
  });

  it("exige no servidor que a encomenda esteja pronta para recolha antes da atribuição", () => {
    expect(migration).toContain("v_encomenda.estado <> 'pronta_para_levantamento'");
    expect(migration).toContain("A encomenda precisa estar pronta para recolha antes de atribuir um entregador.");
    expect(migration).toContain("a.estado in ('atribuida', 'aceite')");
  });

  it("expõe reatribuição somente depois de uma recusa e sem substituir atribuições ativas", () => {
    expect(admin).toContain('["nao_atribuido", "recusada"].includes(atribuicaoAtual.estado)');
    expect(admin).toContain("Entregador recusou esta tarefa.");
    expect(admin).toContain("Escolher outro entregador");
  });

  it("permite gerir cobertura apenas com província e município canónicos", () => {
    for (const contrato of [
      "listarProvinciasAngola",
      "listarMunicipiosAngola",
      "criarAreaCobertura",
      "atualizarAreaCobertura",
      "removerAreaCobertura",
      "Editar bairro",
    ]) expect(cobertura).toContain(contrato);
    expect(migration).toContain("territorio_angola_valido(p_provincia, p_municipio)");
    expect(migration).toContain("p.user_id=auth.uid()");
  });

  it("separa os estados territoriais e protege a carga de municípios contra respostas tardias", () => {
    for (const contrato of [
      "aCarregarProvincias",
      "erroProvincias",
      "carregarProvincias",
      "aCarregarMunicipios",
      "erroMunicipios",
      "recarregarMunicipios",
      "tentativaMunicipios",
      "let ativo = true",
      "if (ativo) setMunicipios(dados)",
      "ativo = false",
      "A carregar províncias...",
      "A carregar municípios...",
      "Não foi possível carregar as províncias.",
      "Não foi possível carregar os municípios.",
      "Tentar novamente",
    ]) expect(cobertura).toContain(contrato);
  });

  it("limpa o município, impede seleção inválida e envia somente nomes canónicos", () => {
    expect(cobertura).toContain("setMunicipioId(\"\")");
    expect(cobertura).toContain("item.id === municipioId && item.provinciaId === provinciaId");
    expect(cobertura).toContain("provincia: provincia.nome");
    expect(cobertura).toContain("municipio: municipio.nome");
    expect(cobertura).toContain("const municipioIndisponivel");
    expect(cobertura).not.toContain("PROVINCIAS");
    expect(cobertura).not.toContain("MUNICIPIOS");
  });

  it("reutiliza a notificação global para atualizar a lista, sem nova subscrição", () => {
    expect(tarefas).toContain("useNotificacoesSessao");
    expect(tarefas).toMatch(/ultimaRealtime\.tipo === ['"]nova_tarefa['"]/);
    expect(tarefas).toContain("void carregar()");
    expect(tarefas).not.toContain("supabase.channel(");
  });
});
