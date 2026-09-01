import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function ler(caminho: string) {
  return readFileSync(resolve(process.cwd(), caminho), 'utf8');
}

const perfil = ler('src/paginas/dashboard/vendedor/VendedorPerfil.tsx');
const servico = ler('src/paginas/dashboard/vendedor/VendedorAdicionarServico.tsx');
const produto = ler('src/paginas/dashboard/vendedor/VendedorAdicionarProduto.tsx');

describe('taxonomia territorial nos formulários restantes de vendedor', () => {
  it('elimina as constantes territoriais antigas dos três formulários', () => {
    for (const pagina of [perfil, servico, produto]) {
      expect(pagina).toContain('useFiltroTerritorialAngola');
      expect(pagina).not.toMatch(/\b(PROVINCIAS|MUNICIPIOS)\b/);
    }
  });

  it('preserva valores existentes em Perfil quando a localização não é alterada', () => {
    expect(perfil).toContain('resolverSelecaoTerritorialExistente');
    expect(perfil).toContain('provinciaOriginal');
    expect(perfil).toContain('municipioOriginal');
    expect(perfil).toContain('estadoTerritorialOriginal');
    expect(perfil).toContain('territorioAlterado');
    expect(perfil).toContain("estadoTerritorialOriginal === 'LEGADO'");
    expect(perfil).toContain("estadoTerritorialOriginal === 'INCOMPLETO'");
    expect(perfil).toContain('provincia: territorioAlterado ? provinciaSelecionada?.nome ?? null : provinciaOriginal');
    expect(perfil).toContain('municipio: territorioAlterado ? municipioSelecionado?.nome ?? null : municipioOriginal');
  });

  it('usa UUID apenas nos selects, limpa município ao mudar província e persiste nomes nos anúncios', () => {
    for (const pagina of [servico, produto]) {
      expect(pagina).toContain('value={p.id}');
      expect(pagina).toContain('value={m.id}');
      expect(pagina).toContain("filtroTerritorial.selecionarProvincia(e.target.value)");
      expect(pagina).toContain('filtroTerritorial.provinciaSelecionada');
      expect(pagina).toContain('filtroTerritorial.municipioSelecionado');
      expect(pagina).toContain('usarNomeCanonico');
      expect(pagina).not.toContain('provincia: filtroTerritorial.provinciaId');
      expect(pagina).not.toContain('municipio: filtroTerritorial.municipioId');
    }
  });

  it('permite editar texto legado sem o converter e exige taxonomia para dados novos ou alterados', () => {
    for (const pagina of [servico, produto]) {
      expect(pagina).toContain('resolverSelecaoTerritorialExistente');
      expect(pagina).toContain('const usarNomeCanonico = !isEdit || territorioAlterado');
      expect(pagina).toContain('usarNomeCanonico && (!provinciaSelecionada || !municipioSelecionado)');
      expect(pagina).toContain('provinciaOriginal');
      expect(pagina).toContain('municipioOriginal');
    }
  });

  it('mantém zona de atuação do serviço separada da localização administrativa', () => {
    expect(servico).toContain('zona_atuacao: zonaAtuacao');
    expect(servico).toContain('<Label>Zona de atuação</Label>');
    expect(servico).not.toContain('zona_atuacao: municipioSelecionado');
  });

  it('mantém loading, retry e proteção contra resposta tardia fornecidos pelo filtro partilhado', () => {
    for (const pagina of [perfil, servico, produto]) {
      expect(pagina).toContain('A carregar províncias...');
      expect(pagina).toContain('A carregar municípios...');
      expect(pagina).toContain('Selecione primeiro a província');
      expect(pagina).toContain('Tentar novamente');
      expect(pagina).toContain('recarregarMunicipios');
    }
  });
});
