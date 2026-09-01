import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagina = readFileSync(
  resolve(process.cwd(), 'src/paginas/dashboard/cliente/ClienteDefinicoes.tsx'),
  'utf8',
);

describe('taxonomia territorial em ClienteDefinicoes', () => {
  it('consulta a taxonomia server-side e não recorre às constantes antigas', () => {
    expect(pagina).toContain('listarProvinciasAngola');
    expect(pagina).toContain('listarMunicipiosAngola');
    expect(pagina).toContain('resolverSelecaoTerritorialExistente');
    expect(pagina).not.toMatch(/\b(PROVINCIAS|MUNICIPIOS)\b/);
  });

  it('mantém UUIDs apenas nos selects e persiste nomes textuais no cliente', () => {
    expect(pagina).toContain('value={p.id}');
    expect(pagina).toContain('value={m.id}');
    expect(pagina).toContain('provincia: territorioAlterado ? provinciaSelecionada?.nome ?? null : provinciaOriginal');
    expect(pagina).toContain('municipio: territorioAlterado ? municipioSelecionado?.nome ?? null : municipioOriginal');
    expect(pagina).not.toContain('provincia: provinciaSelecionada?.id');
    expect(pagina).not.toContain('municipio: municipioSelecionado?.id');
  });

  it('resolve localização existente sem normalizar silenciosamente os valores persistidos', () => {
    expect(pagina).toContain('setProvinciaOriginal(provinciaTexto)');
    expect(pagina).toContain('setMunicipioOriginal(municipioTexto)');
    expect(pagina).toContain("setEstadoTerritorialOriginal(resultado.estado)");
    expect(pagina).toContain("estadoTerritorialOriginal === 'LEGADO'");
    expect(pagina).toContain("estadoTerritorialOriginal === 'INCOMPLETO'");
    expect(pagina).toContain('Os valores existentes serão preservados.');
  });

  it('só permite gravar nova localização após uma alteração deliberada e válida', () => {
    expect(pagina).toContain('setTerritorioAlterado(true)');
    expect(pagina).toContain("setMunicipio('')");
    expect(pagina).toContain('territorioAlterado && (!provinciaSelecionada || !municipioSelecionado)');
    expect(pagina).toContain('item.id === municipio && item.provinciaId === provincia');
  });

  it('trata carregamento, erros e retries de províncias e municípios de forma independente', () => {
    for (const trecho of [
      'aCarregarProvincias',
      'aCarregarMunicipios',
      'erroProvincias',
      'erroMunicipios',
      'carregarProvincias',
      'recarregarMunicipios',
      'tentativaMunicipios',
      'A carregar províncias...',
      'A carregar municípios...',
    ]) {
      expect(pagina).toContain(trecho);
    }

    expect(pagina).not.toContain('setTimeout(() => setProvincia');
  });

  it('protege a lista de municípios contra respostas antigas e não limpa a localização em falha de rede', () => {
    expect(pagina).toContain('let ativo = true;');
    expect(pagina).toContain('if (ativo) setMunicipios(dados)');
    expect(pagina).toContain('ativo = false;');
    expect(pagina).toContain("setErroMunicipios('Não foi possível carregar os municípios.')");
    expect(pagina).not.toContain("catch(() => { setProvincia('')");
    expect(pagina).not.toContain("catch(() => { setMunicipio('')");
  });
});
