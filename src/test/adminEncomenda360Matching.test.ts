import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = process.cwd();
const migration = readFileSync(resolve(raiz, "supabase/migrations/20260822170000_expandir_admin_encomenda_360_matching_logistico.sql"), "utf8");
const atribuicaoMigration = readFileSync(resolve(raiz, "supabase/migrations/20260822180000_criar_atribuicao_logistica_transacional.sql"), "utf8");
const pagina = readFileSync(resolve(raiz, "src/paginas/dashboard/admin/AdminEncomendaDetalhe.tsx"), "utf8");

describe("Admin Encomenda 360 e matching explicável", () => {
  it("mantém snapshots e não usa o produto atual como fonte histórica", () => {
    expect(migration).toContain("nome_produto_snapshot");
    expect(migration).toContain("descricao_snapshot");
    expect(migration).toContain("imagem_principal_snapshot");
    expect(migration).not.toMatch(/join public\.produtos/i);
  });

  it("mantém matching separado, lazy e permite atribuição transacional explícita", () => {
    expect(migration).toContain("listar_compatibilidade_logistica_encomenda_admin");
    expect(migration).toContain("avaliar_compatibilidade_veiculo_encomenda");
    expect(pagina).toContain("Ver veículos avaliados");
    expect(pagina).toContain("Não atribuído");
    expect(pagina).toContain("Confirmar atribuição");
  });

  it("traduz os motivos estruturados e preserva os três estados", () => {
    expect(pagina).toContain("Capacidade de peso insuficiente");
    expect(pagina).toContain("dados_incompletos");
    expect(pagina).toContain("incompativel");
    expect(pagina).toContain("compativel");
  });

  it("não expõe hashes, paths privados ou media do veículo", () => {
    expect(migration).not.toMatch(/foto_veiculo_path|foto_perfil_url|frente_path|verso_path|codigo_hash/i);
  });
});

describe("atribuição logística transacional", () => {
  it("usa entidade histórica e índice parcial, sem gravar a responsabilidade na encomenda", () => {
    expect(atribuicaoMigration).toContain("create table public.atribuicoes_entrega_encomenda");
    expect(atribuicaoMigration).toContain("atribuicoes_entrega_uma_ativa_por_encomenda_idx");
    expect(atribuicaoMigration).not.toMatch(/alter table public\.encomendas[\s\S]*parceiro_entrega_id/i);
  });

  it("revalida o candidato e cria evento seguro antes de atribuir", () => {
    expect(atribuicaoMigration).toContain("entregador_pode_receber_entregas");
    expect(atribuicaoMigration).toContain("veiculo_operacional_para_entregas");
    expect(atribuicaoMigration).toContain("avaliar_compatibilidade_veiculo_encomenda");
    expect(atribuicaoMigration).toContain("entregador_atribuido");
    expect(atribuicaoMigration).not.toMatch(/foto_veiculo_path|frente_path|codigo_hash/i);
  });

  it("preserva os doze eventos históricos e adiciona apenas o evento de atribuição", () => {
    for (const evento of [
      "encomenda_criada", "vendedor_confirmou", "vendedor_recusou",
      "preparacao_iniciada", "pronta_para_levantamento", "levantamento_confirmado",
      "encomenda_concluida", "cliente_cancelou", "codigo_levantamento_gerado",
      "codigo_levantamento_regenerado", "tentativa_levantamento_falhou",
      "problema_reportado", "entregador_atribuido",
    ]) expect(atribuicaoMigration).toContain(`'${evento}'`);
    expect(atribuicaoMigration).not.toContain("'entregador'");
  });

  it("oferece atribuição somente a candidatos compatíveis e mantém confirmação", () => {
    expect(pagina).toContain('veiculo.estado === "compativel"');
    expect(pagina).toContain("Confirmar atribuição");
    expect(pagina).toContain("A atribuir…");
    expect(pagina).toContain("Não atribuído");
  });

  it("preserva a última atribuição terminal no contrato administrativo", () => {
    const correcao = readFileSync(resolve(raiz, "supabase/migrations/20260825110000_corrigir_atribuicao_admin_entrega_fase_2.sql"), "utf8");
    expect(correcao).toContain("order by a.atribuido_em desc, a.id desc");
    expect(correcao).not.toContain("a.estado in ('atribuida'");
    for (const campo of ["chegou_origem_em", "recolhida_em", "cancelado_em", "concluido_em", "motivo_cancelamento"]) {
      expect(correcao).toContain(`'${campo}'`);
    }
  });
});
