import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/baseline/current/05_reference_data.sql', 'utf8');

describe('seed territorial da baseline', () => {
  it('contém 21 províncias e 326 municípios da fonte canónica', () => {
    const provincias = sql.match(/^ {2}\('[A-Z]{3}', '\d{2}', '[^']+', \d+\),?$/gm) ?? [];
    const municipios = sql.match(/^ {2}\('[A-Z]{3}', '\d{2}', '[^']+'\),?$/gm) ?? [];
    expect(provincias).toHaveLength(21);
    expect(municipios).toHaveLength(326);
  });

  it('resolve a província por chave natural, remove o gate e mantém Ingombota em Luanda', () => {
    expect(sql).toContain("p.codigo_oficial = dados.codigo_provincia");
    expect(sql).not.toContain('Falta o seed canónico autónomo');
    expect(sql).toContain("('LDA', '01', 'Ingombota')");
    expect(sql).toContain("('LDA', '05', 'Luanda', 5)");
    expect(sql).toContain('total_provincias <> 21 or total_municipios <> 326');
  });

  it('não contém marcadores típicos de mojibake', () => {
    expect(sql).not.toMatch(/[ÃƒÃ‚ï¿½]/);
  });
});
