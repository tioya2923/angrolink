import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260814023000_criar_disputas_encomenda.sql'), 'utf8');

describe('fundação de disputas de encomenda', () => {
  it('mantém a reclamação de sete dias no servidor e independente do repasse', () => {
    expect(migration).toContain('prazo_reclamacao_horas integer not null default 168');
    expect(migration).toContain('concluido_em + make_interval(hours => v_config.prazo_reclamacao_horas)');
    expect(migration).not.toContain('prazo_repasse_horas = 168');
  });

  it('protege abertura, duplicação e efeitos financeiros indevidos', () => {
    expect(migration).toContain("where id = p_encomenda_id and cliente_id = auth.uid()");
    expect(migration).toContain("where estado in ('aberta', 'em_analise')");
    expect(migration).toContain("raise exception 'Já existe um problema em análise para esta encomenda.'");
    expect(migration).toContain('bloquear_conclusao_encomenda_com_disputa');
    expect(migration).toContain("new.estado = 'concluida'");
    expect(migration).not.toContain('insert into public.reembolsos_pagamento');
    expect(migration).not.toContain('insert into public.movimentos_financeiros');
    expect(migration).not.toContain('insert into public.repasses_vendedor');
  });

  it('cria evento mínimo e políticas de leitura para as duas partes', () => {
    expect(migration).toContain("'problema_reportado'");
    expect(migration).toContain("jsonb_build_object('tipo_problema', v_disputa.tipo_problema)");
    expect(migration).toContain('disputas_encomenda_leitura_cliente');
    expect(migration).toContain('disputas_encomenda_leitura_vendedor');
  });
});
