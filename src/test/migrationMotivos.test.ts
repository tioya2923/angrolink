import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260813184017_exigir_motivos_cancelamento_recusa.sql'),
  'utf8',
);

describe('contrato da migration de motivos de encomenda', () => {
  it('delega a elegibilidade operacional à função central do vendedor', () => {
    expect(migration).toContain('v.id = v_encomenda.vendedor_id and v.user_id = auth.uid()');
    expect(migration).toContain('public.vendedor_pode_receber_encomendas(v.id) = true');
    expect(migration).not.toMatch(/v\.status_aprovacao\s*=|coalesce\(v\.conta_ativa/);
  });

  it('mantém motivos apenas nos eventos de cancelamento e recusa', () => {
    expect(migration).toContain("v_evento in ('cliente_cancelou', 'vendedor_recusou')");
    expect(migration).toContain("else '{}'::jsonb");
    expect(migration).toContain("jsonb_build_object('motivo', v_motivo)");
  });

  it('exige e persiste um motivo normalizado apenas nas transições corretas', () => {
    expect(migration).toContain("v_motivo text := nullif(btrim(p_motivo), '')");
    expect(migration).toContain("'Indique um motivo de cancelamento entre 3 e 500 caracteres.'");
    expect(migration).toContain("'Indique um motivo de recusa entre 3 e 500 caracteres.'");
    expect(migration).toContain("motivo_cancelamento = case when v_ator = 'cliente' and p_proximo_estado = 'cancelada'");
    expect(migration).toContain("motivo_recusa = case when v_ator = 'vendedor' and p_proximo_estado = 'recusada'");
  });
});
