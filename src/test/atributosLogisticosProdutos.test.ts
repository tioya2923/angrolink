import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260821111710_adicionar_atributos_logisticos_produtos.sql'),
  'utf8',
);
const testeSql = readFileSync(
  resolve(process.cwd(), 'supabase/tests/atributos_logisticos_produtos.sql'),
  'utf8',
);

describe('atributos logísticos de produtos', () => {
  it('mantém os atributos físicos explícitos e desconhecidos como null', () => {
    for (const coluna of [
      'peso_por_unidade_comercial_kg', 'volume_por_unidade_comercial_m3',
      'requer_refrigeracao', 'requer_caixa_carga', 'requer_paletes',
    ]) expect(migration).toContain(coluna);

    expect(migration).not.toMatch(/requer_refrigeracao boolean\s+not null/i);
    expect(migration).not.toMatch(/requer_caixa_carga boolean\s+not null/i);
    expect(migration).not.toMatch(/requer_paletes boolean\s+not null/i);
  });

  it('cria snapshots por item e não altera produtos ou encomendas históricas', () => {
    expect(migration).toContain('preencher_snapshot_logistico_item_encomenda');
    expect(migration).toContain('before insert on public.itens_encomenda');
    expect(migration).not.toMatch(/update\s+public\.itens_encomenda/i);
    expect(migration).not.toMatch(/update\s+public\.produtos/i);
  });

  it('calcula apenas a partir de snapshots, com regra explícita para kg', () => {
    expect(migration).toContain("lower(btrim(i.unidade)) = 'kg'");
    expect(migration).toMatch(/produtos_kg_sem_peso_unitario_comercial[\s\S]*peso_por_unidade_comercial_kg is null/i);
    expect(migration).toMatch(/itens_encomenda_kg_sem_peso_snapshot[\s\S]*peso_por_unidade_comercial_kg_snapshot is null/i);
    expect(migration).toContain('peso_total_conhecido');
    expect(migration).toContain('volume_total_conhecido');
    expect(migration).toContain('requisitos_especiais_conhecidos');
    expect(migration).not.toContain('listar_entregadores_candidatos');
  });

  it('mantém o agregado interno sem execução direta de anon ou authenticated', () => {
    expect(migration).toContain('revoke all on function public.calcular_requisitos_logisticos_encomenda(uuid) from public, anon, authenticated');
    expect(migration).toMatch(/security definer[\s\S]*set search_path = public/i);
    expect(migration).toContain('desconhecido não significa requisito zero');
  });

  it('testa com fixture sintética reversível, sem rowtypes compostos ou encomendas históricas', () => {
    expect(testeSql).toMatch(/\bbegin;/i);
    expect(testeSql).toMatch(/\brollback;\s*$/i);
    expect(testeSql).toContain('vendedor_pode_receber_encomendas');
    expect(testeSql).toContain('join auth.users u on u.id = c.id');
    expect(testeSql).toContain('join public.profiles p on p.id = c.id');
    expect(testeSql).toContain('c.conta_ativa is true');
    expect(testeSql).toContain('Pré-requisito da fixture: crie uma conta de cliente de teste ativa');
    expect(testeSql).toContain('Pré-requisito da fixture: crie um vendedor de teste elegível');
    expect(testeSql).toContain('gen_random_uuid()');
    expect(testeSql).not.toMatch(/select\s+p\.\*,\s*i\.\*\s+into/i);
    expect(testeSql).not.toMatch(/public\.itens_encomenda\s+i\s+join\s+public\.produtos/i);
  });

  it('cobre snapshots históricos, peso, volume e os quatro resultados tri-state', () => {
    for (const cenario of [
      'Snapshot histórico não permaneceu imutável',
      'Peso kg não foi calculado diretamente',
      'Desconhecido foi tratado como zero',
      'Known + unknown não preservou semântica',
      'false + false incorreto',
      'true + false incorreto',
      'null + false incorreto',
      'Trigger aceitou produto inexistente',
    ]) {
      expect(testeSql).toContain(cenario);
    }
  });
});
