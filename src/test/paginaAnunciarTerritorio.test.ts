import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pagina = readFileSync(
  resolve(process.cwd(), "src/paginas/PaginaAnunciar.tsx"),
  "utf8",
);

describe("taxonomia territorial em PaginaAnunciar", () => {
  it("elimina constantes antigas e o terceiro par territorial órfão", () => {
    expect(pagina).not.toMatch(/\b(PROVINCIAS|MUNICIPIOS)\b/);
    expect(pagina).not.toContain("formVendedor.provincia");
    expect(pagina).not.toContain("formVendedor.municipio");
    expect(pagina).not.toContain("municipiosVendedor");
  });

  it("mantém comprador e localização comercial como domínios independentes", () => {
    expect(pagina).toContain("formComprador.provincia");
    expect(pagina).toContain("formComprador.municipio");
    expect(pagina).toContain("formPerfil.provincia_atividade");
    expect(pagina).toContain("formPerfil.municipio_atividade");
    expect(pagina).toContain("setMunicipiosComprador");
    expect(pagina).toContain("setMunicipiosAtividade");
  });

  it("usa a taxonomia RPC, loading, erro, retry e cancelamento lógico por domínio", () => {
    for (const trecho of [
      "listarProvinciasAngola",
      "listarMunicipiosAngola",
      "A carregar províncias...",
      "A carregar municípios...",
      "erroMunicipioComprador",
      "erroMunicipioAtividade",
      "tentarNovamenteComprador",
      "tentarNovamenteAtividade",
      "let ativo = true;",
      "ativo = false;",
    ]) {
      expect(pagina).toContain(trecho);
    }
  });

  it("limpa somente o município do domínio alterado e persiste nomes canónicos", () => {
    expect(pagina).toContain(
      'provincia: e.target.value,\n                          municipio: "",',
    );
    expect(pagina).toContain(
      'provincia_atividade: e.target.value,\n                            municipio_atividade: "",',
    );
    expect(pagina).toContain(
      "item.id === municipioId && item.provinciaId === provinciaId",
    );
    expect(pagina).toContain(
      "provincia: provincia.nome, municipio: municipio.nome",
    );
    expect(pagina).toContain("provincia: provinciaAtividadeNome");
    expect(pagina).toContain("municipio: municipioAtividadeNome");
  });
});
