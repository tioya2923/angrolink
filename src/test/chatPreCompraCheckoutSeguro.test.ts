import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260915020000_integrar_chat_pre_compra_checkout.sql'), 'utf8');

describe('checkout com chat pré-compra — contrato SQL', () => {
  it('mantém idempotência compatível e uma conversa por intenção', () => {
    expect(migration).toContain('add column conversa_pre_compra_id uuid references public.conversas_pre_compra(id) on delete restrict');
    expect(migration).toContain('where conversa_pre_compra_id is not null');
    expect(migration).toContain('for update');
    expect(migration).toContain('is distinct from p_conversa_pre_compra_id');
  });
  it('usa RPCs distintas, retornos atuais, locks e vínculo antes da atualização', () => {
    expect(migration).toContain('criar_encomenda_levantamento_com_conversa');
    expect(migration).toContain('criar_encomenda_entrega_com_conversa');
    expect(migration).toContain('returns public.encomendas');
    expect(migration).toContain('returns jsonb');
    expect(migration).toContain("':levantamento:'");
    expect(migration).toContain("':entrega:'");
    expect(migration).toContain('public.criar_encomenda_levantamento(');
    expect(migration).toContain('public.criar_encomenda_entrega(');
    expect(migration).not.toContain('create or replace function public.criar_encomenda_levantamento(');
    expect(migration).not.toContain('create or replace function public.criar_encomenda_entrega(');
    expect(migration.indexOf('vincular_conversa_pre_compra_encomenda')).toBeLessThan(migration.indexOf('get diagnostics v_atualizados'));
  });
  it('não expõe o helper interno nem introduz clientes.user_id', () => {
    expect(migration).toContain('from public,anon');
    expect(migration).toContain('to authenticated');
    expect(migration).not.toContain('clientes.user_id');
    expect(migration).toContain('if v_atualizados<>1');
  });
});
