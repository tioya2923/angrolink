import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const paginaCadastroParceiro = readFileSync(
  resolve(process.cwd(), "src/paginas/PaginaCadastroParceiroEntrega.tsx"),
  "utf8",
);

describe("território no cadastro de parceiro de entregas", () => {
  it("usa a taxonomia server-side, UUIDs nos selects e nunca as constantes antigas", () => {
    expect(paginaCadastroParceiro).toContain("listarProvinciasAngola");
    expect(paginaCadastroParceiro).toContain("listarMunicipiosAngola");
    expect(paginaCadastroParceiro).toContain("value={provincia.id}");
    expect(paginaCadastroParceiro).toContain("value={municipio.id}");
    expect(paginaCadastroParceiro).not.toMatch(/\b(PROVINCIAS|MUNICIPIOS)\b/);
  });

  it("expõe carregamento, erro e retry sem fallback territorial local", () => {
    expect(paginaCadastroParceiro).toContain("A carregar províncias...");
    expect(paginaCadastroParceiro).toContain("A carregar municípios...");
    expect(paginaCadastroParceiro).toContain(
      "Não foi possível carregar as províncias.",
    );
    expect(paginaCadastroParceiro).toContain(
      "Não foi possível carregar os municípios.",
    );
    expect(paginaCadastroParceiro).toContain("tentarNovamenteTerritorio");
    expect(paginaCadastroParceiro).toContain("setTentativaMunicipio");
  });

  it("limpa o município na troca de província e persiste apenas os nomes canónicos", () => {
    expect(paginaCadastroParceiro).toContain('set("municipio", "");');
    expect(paginaCadastroParceiro).toContain(
      "const provincia = provinciaSelecionada.nome;",
    );
    expect(paginaCadastroParceiro).toContain(
      "const municipio = municipioSelecionado.nome;",
    );
    expect(paginaCadastroParceiro).toContain(
      "Selecione uma província e um município válidos.",
    );
  });

  it("protege contra respostas antigas durante a troca de província", () => {
    expect(paginaCadastroParceiro).toContain("let ativo = true;");
    expect(paginaCadastroParceiro).toContain(
      "if (ativo) setMunicipios(dados);",
    );
    expect(paginaCadastroParceiro).toContain("ativo = false;");
  });
});
