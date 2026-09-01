import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function ler(caminho: string) {
  return readFileSync(resolve(process.cwd(), caminho), 'utf8');
}

function semConstantesTerritoriaisLegadas(caminho: string) {
  return !/\b(PROVINCIAS|MUNICIPIOS)\b/.test(ler(caminho));
}

const constantes = ler('src/dados/constantes.ts');
const territorio = ler('src/services/territorioAngola.ts');
const filtro = ler('src/hooks/useFiltroTerritorialAngola.ts');
const seletor = ler('src/componentes/SeletorMunicipio.tsx');
const contexto = ler('src/contextos/MunicipioContexto.tsx');

describe('encerramento da taxonomia territorial frontend', () => {
  it('remove apenas as coleções territoriais estáticas e preserva as constantes de domínio', () => {
    expect(constantes).not.toMatch(/export\s+const\s+PROVINCIAS\b/);
    expect(constantes).not.toMatch(/export\s+const\s+MUNICIPIOS\b/);
    for (const nome of ['CATEGORIAS', 'TIPOS_VENDEDOR', 'TIPOS_SERVICO', 'UNIDADES', 'TIPOS_VENDA']) {
      expect(constantes).toMatch(new RegExp(`export\\s+const\\s+${nome}\\b`));
    }
  });

  it('mantém o serviço canónico e o hook com callbacks estáveis', () => {
    expect(territorio).toContain('listarProvinciasAngola');
    expect(territorio).toContain('listarMunicipiosAngola');
    for (const callback of ['selecionarProvincia', 'selecionarMunicipio', 'definirSelecao', 'recarregarMunicipios']) {
      expect(filtro).toMatch(new RegExp(`const\\s+${callback}\\s*=\\s*useCallback`));
    }
  });

  it('mantém seletor e contexto dependentes da taxonomia canónica', () => {
    expect(seletor).toContain('useFiltroTerritorialAngola');
    expect(contexto).toContain("from '@/services/territorioAngola'");
    expect(contexto).toContain('MunicipioAngola');
    expect(contexto).toContain('ProvinciaAngola');
    expect(semConstantesTerritoriaisLegadas('src/componentes/SeletorMunicipio.tsx')).toBe(true);
    expect(semConstantesTerritoriaisLegadas('src/contextos/MunicipioContexto.tsx')).toBe(true);
  });

  it('não deixa consumidores de produção nas constantes territoriais antigas', () => {
    for (const caminho of [
      'src/paginas/PaginaAnunciar.tsx',
      'src/paginas/PaginaCadastroParceiroEntrega.tsx',
      'src/paginas/PaginaPesquisa.tsx',
      'src/paginas/PaginaServicos.tsx',
      'src/paginas/dashboard/cliente/ClienteDefinicoes.tsx',
      'src/paginas/dashboard/parceiro/ParceiroResumo.tsx',
      'src/paginas/dashboard/vendedor/VendedorPerfil.tsx',
      'src/paginas/dashboard/vendedor/VendedorAdicionarProduto.tsx',
      'src/paginas/dashboard/vendedor/VendedorAdicionarServico.tsx',
      'src/paginas/dashboard/admin/AdminCompradores.tsx',
      'src/paginas/dashboard/admin/AdminUtilizadores.tsx',
    ]) {
      expect(semConstantesTerritoriaisLegadas(caminho)).toBe(true);
    }
  });
});
