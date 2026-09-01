import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260822160000_corrigir_arrays_motivos_elegibilidade_logistica.sql',
  ),
  'utf8',
);
const testeSql = readFileSync(
  resolve(process.cwd(), 'supabase/tests/elegibilidade_logistica_entregadores.sql'),
  'utf8',
);

describe('correção de arrays na elegibilidade logística', () => {
  it('substitui todos os acréscimos ambíguos por array_append', () => {
    expect(migration).not.toMatch(/v_motivos\s*:=\s*v_motivos\s*\|\|/i);
    expect(migration.match(/array_append\(v_motivos,/gi)?.length).toBeGreaterThanOrEqual(19);
    expect(migration).toContain("array_append(v_motivos, 'indisponivel')");
    expect(migration).toContain("array_append(v_motivos, 'parceiro_nao_aprovado')");
    expect(migration).toContain("array_append(v_motivos, 'sem_area_ativa')");
  });

  it('corrige o veículo operacional e o matching, mantendo os três contratos seguros', () => {
    expect(migration).toContain('public.motivos_operacionais_veiculo_entrega');
    expect(migration).toContain('public.motivos_elegibilidade_entregador');
    expect(migration).toContain('public.avaliar_compatibilidade_veiculo_encomenda');
    expect(migration.match(/security definer/gi)?.length).toBe(3);
    expect(migration.match(/set search_path = public/gi)?.length).toBe(3);
  });

  it('mantém um teste SQL de parceiro indisponível e da ausência de concatenação ambígua', () => {
    expect(testeSql).toContain("'indisponivel' = any(v_motivos)");
    expect(testeSql).toContain('public.entregador_pode_receber_entregas(v_parceiro_id)');
    expect(testeSql).toContain('Função ainda possui concatenação ambígua de motivos.');
    expect(testeSql).toContain('rollback;');
  });
});
