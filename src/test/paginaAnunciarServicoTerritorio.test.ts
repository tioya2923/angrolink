import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pagina = readFileSync('src/paginas/PaginaAnunciarServico.tsx', 'utf8');

describe('PaginaAnunciarServico — território canónico', () => {
  it('usa o filtro territorial server-side, sem constantes legadas', () => {
    expect(pagina).toContain('useFiltroTerritorialAngola');
    expect(pagina).not.toMatch(/\bPROVINCIAS\b|\bMUNICIPIOS\b/);
  });

  it('mantém UUIDs apenas nos selects e envia nomes canónicos ao serviço', () => {
    expect(pagina).toContain('value={filtroTerritorial.provinciaId}');
    expect(pagina).toContain('value={filtroTerritorial.municipioId}');
    expect(pagina).toContain('provincia: filtroTerritorial.provinciaSelecionada?.nome');
    expect(pagina).toContain('municipio: filtroTerritorial.municipioSelecionado?.nome');
  });

  it('preserva loading, erros e retry independentes da taxonomia', () => {
    for (const contrato of [
      'aCarregarProvincias',
      'aCarregarMunicipios',
      'erroProvincias',
      'erroMunicipios',
      'carregarProvincias',
      'recarregarMunicipios',
    ]) {
      expect(pagina).toContain(contrato);
    }
  });
});
