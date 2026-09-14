import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260912010000_criar_feedback_piloto.sql'), 'utf8');

describe('Feedback do piloto V1', () => {
  it('define a tabela isolada, validações e RLS sem acesso direto', () => {
    expect(migration).toContain('create table public.feedback_piloto');
    expect(migration).toContain("papel in ('cliente', 'vendedor', 'parceiro_entrega')");
    expect(migration).toContain("categoria in ('compra', 'vendedor', 'entrega', 'pagamento', 'aplicacao', 'outro')");
    expect(migration).toContain("estado in ('novo', 'em_analise', 'resolvido')");
    expect(migration).toContain('nota is null or nota between 1 and 5');
    expect(migration).toContain('feedback_piloto_nota_ou_comentario_check');
    expect(migration).toContain('feedback_piloto_resolucao_check');
    expect(migration).toContain('alter table public.feedback_piloto enable row level security');
    expect(migration).toContain('revoke all on table public.feedback_piloto from public, anon, authenticated');
  });

  it('mantém criação e administração exclusivamente por RPCs seguras', () => {
    expect(migration).toContain('create or replace function public.criar_feedback_piloto');
    expect(migration).toContain('create or replace function public.listar_feedback_piloto_admin');
    expect(migration).toContain('create or replace function public.atualizar_estado_feedback_piloto_admin');
    expect(migration).toMatch(/security definer set search_path = pg_catalog, public/g);
    expect(migration).toContain('if v_user_id is null');
    expect(migration).toContain('if not public.eh_admin()');
    expect(migration).toContain('v_atribuicao.encomenda_id <> p_encomenda_id');
    expect(migration).toContain("v_encomenda.estado <> 'concluida'");
    expect(migration).toContain("resolvido_em=case when p_estado='resolvido'");
    expect(migration).not.toContain('obter_feedback_piloto_admin');
  });
});
