import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260814014500_permitir_conclusao_cliente_levantamento.sql'), 'utf8');

describe('conclusão da encomenda após levantamento', () => {
  it('permite somente ao cliente dono concluir uma encomenda levantada', () => {
    expect(migration).toContain("v_encomenda.estado = 'levantada' and p_proximo_estado = 'concluida'");
    expect(migration).toContain("v_ator := 'cliente'");
    expect(migration).toContain("raise exception 'Esta transição não é permitida para o vendedor.'");
  });

  it('bloqueia concorrência com lock, grava data e cria um único evento por transição', () => {
    expect(migration).toContain('where id = p_encomenda_id for update');
    expect(migration).toContain("concluido_em = case when p_proximo_estado = 'concluida' then now()");
    expect(migration).toContain("v_evento := 'encomenda_concluida'");
    expect(migration).toContain('insert into public.eventos_encomenda');
  });

  it('não confirma pagamentos nem cria repasses', () => {
    expect(migration).not.toContain('update public.pagamentos');
    expect(migration).not.toContain('insert into public.repasses_vendedor');
  });
});
