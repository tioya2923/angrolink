import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260907010000_corrigir_ordem_otp_pagamento_conclusao.sql'), 'utf8');
const inicioTransicao = migration.indexOf('create or replace function public.transicionar_encomenda_levantamento');
const fimTransicao = migration.indexOf('create or replace function public.obter_tarefa_entregador', inicioTransicao);
const transicao = migration.slice(inicioTransicao, fimTransicao);

describe('conclusão da encomenda após levantamento', () => {
  it('remove o bypass legado de conclusão pelo cliente', () => {
    expect(migration).not.toContain("e.estado='levantada' and p_proximo_estado='concluida'");
    expect(migration).toContain("raise exception 'Esta transição não é permitida para o cliente.'");
  });

  it('bloqueia concorrência com lock, grava data e cria um único evento por transição', () => {
    expect(transicao).toContain('where id=p_encomenda_id for update');
    expect(transicao).toContain("concluido_em=case when p_proximo_estado='concluida' then now() else concluido_em end");
    expect(transicao).toContain('insert into public.eventos_encomenda');
  });

  it('não confirma pagamentos nem cria repasses', () => {
    expect(transicao).not.toContain('update public.pagamentos');
    expect(transicao).not.toContain('insert into public.repasses_vendedor');
  });
});
