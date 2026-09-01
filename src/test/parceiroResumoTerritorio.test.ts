import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pagina = readFileSync(
  resolve(process.cwd(), "src/paginas/dashboard/parceiro/ParceiroResumo.tsx"),
  "utf8",
);

describe("taxonomia territorial no resumo do parceiro", () => {
  it("resolve a localização existente e preserva explicitamente valores legado ou incompletos", () => {
    expect(pagina).toContain("resolverSelecaoTerritorialExistente");
    expect(pagina).toContain("estadoTerritorialOriginal");
    expect(pagina).toContain("provinciaOriginal");
    expect(pagina).toContain("municipioOriginal");
    expect(pagina).toContain("Localização antiga:");
    expect(pagina).toContain("Localização incompleta:");
  });

  it("usa UUIDs apenas nos selects e nomes canónicos no payload após alteração deliberada", () => {
    expect(pagina).toContain("value={provincia.id}");
    expect(pagina).toContain("value={municipio.id}");
    expect(pagina).toContain("const provinciaSelecionada = provincias.find");
    expect(pagina).toContain("const municipioSelecionado = municipios.find");
    expect(pagina).toContain("provinciaSelecionada?.nome");
    expect(pagina).toContain("municipioSelecionado?.nome");
  });

  it("limpa município, permite retry e impede respostas antigas de substituir a província atual", () => {
    expect(pagina).toContain('setMunicipioId("");');
    expect(pagina).toContain("tentarNovamenteTerritorio");
    expect(pagina).toContain("setTentativaMunicipio");
    expect(pagina).toContain("let ativo = true;");
    expect(pagina).toContain("if (ativo) setMunicipios(dados);");
    expect(pagina).toContain("ativo = false;");
  });

  it("não mantém dependência das constantes territoriais antigas", () => {
    expect(pagina).not.toMatch(/\b(PROVINCIAS|MUNICIPIOS)\b/);
    expect(pagina).toContain("listarProvinciasAngola");
    expect(pagina).toContain("listarMunicipiosAngola");
  });
});
