import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function ler(caminho: string) {
  return readFileSync(resolve(process.cwd(), caminho), 'utf8');
}

const paginaServicos = ler('src/paginas/PaginaServicos.tsx');
const paginaPesquisa = ler('src/paginas/PaginaPesquisa.tsx');
const adminCompradores = ler('src/paginas/dashboard/admin/AdminCompradores.tsx');
const adminUtilizadores = ler('src/paginas/dashboard/admin/AdminUtilizadores.tsx');
const seletorMunicipio = ler('src/componentes/SeletorMunicipio.tsx');
const hook = ler('src/hooks/useFiltroTerritorialAngola.ts');
const api = ler('src/services/api.ts');

describe('filtros territoriais server-side', () => {
  it('não mantém dependência das constantes territoriais nos cinco consumidores auditados', () => {
    for (const pagina of [paginaServicos, paginaPesquisa, adminCompradores, adminUtilizadores, seletorMunicipio]) {
      expect(pagina).not.toMatch(/\b(PROVINCIAS|MUNICIPIOS)\b/);
    }
  });

  it('centraliza o carregamento canónico, retry e race condition no hook de filtro', () => {
    for (const trecho of [
      'listarProvinciasAngola',
      'listarMunicipiosAngola',
      'Não foi possível carregar as províncias.',
      'Não foi possível carregar os municípios.',
      'let ativo = true;',
      'ativo = false;',
      'recarregarMunicipios',
      "setMunicipioId('')",
    ]) {
      expect(hook).toContain(trecho);
    }
  });

  it('mantém UUIDs internos e converte filtros de serviços e administração para nomes textuais', () => {
    expect(paginaServicos).toContain('value={p.id}');
    expect(paginaServicos).toContain('value={m.id}');
    expect(paginaServicos).toContain('provinciaSelecionada?.nome');
    expect(paginaServicos).toContain('municipioSelecionado?.nome');
    expect(adminCompradores).toContain('provincia: filtroTerritorial.provinciaSelecionada?.nome ?? null');
    expect(adminCompradores).toContain('municipio: filtroTerritorial.municipioSelecionado?.nome ?? null');
    expect(adminUtilizadores).toContain('provincia: filtroTerritorial.provinciaSelecionada?.nome ?? null');
    expect(adminCompradores).not.toContain('provincia: filtroTerritorial.provinciaId');
    expect(adminCompradores).not.toContain('municipio: filtroTerritorial.municipioId');
  });

  it('preserva o filtro Todas e desativa município até existir província', () => {
    expect(paginaServicos).toContain('Todas as províncias');
    expect(paginaServicos).toContain('Selecione primeiro a província');
    expect(adminCompradores).toContain("valor === 'todas' ? '' : valor");
    expect(adminCompradores).toContain("valor === 'todos' ? '' : valor");
    expect(seletorMunicipio).toContain('Todas as províncias');
    expect(seletorMunicipio).toContain('Todos os municípios');
  });

  it('mantém a pesquisa de produtos integrada no seletor canónico e envia nomes à query', () => {
    expect(paginaPesquisa).toContain('SeletorMunicipio');
    expect(paginaPesquisa).toContain('provinciaNome');
    expect(paginaPesquisa).toContain('provincia: provinciaNome || undefined');
    expect(paginaPesquisa).toContain('municipio: municipioNome || undefined');
    expect(paginaPesquisa).not.toContain('provincia: provinciaId');
    expect(paginaPesquisa).not.toContain('municipio: municipioId');
    expect(api).toContain('if (params?.provincia)');
    expect(api).toContain('params.provincia');
  });

  it('preserva zona de atuação fora do modelo de filtro territorial de serviços', () => {
    expect(paginaServicos).not.toContain('zona_atuacao');
  });
});
