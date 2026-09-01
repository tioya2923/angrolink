import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260813235000_criar_projecoes_financeiras_seguras.sql'),
  'utf8',
);

describe('contrato das projeções financeiras seguras', () => {
  it('limita a projeção do cliente à própria encomenda e omite comissão', () => {
    expect(migration).toContain('create or replace function public.obter_pagamento_encomenda_cliente');
    expect(migration).toContain('and e.cliente_id = auth.uid()');
    expect(migration).toContain("if auth.uid() is null then");
    expect(migration).not.toContain('comissao_bps_snapshot');
    expect(migration).not.toContain('valor_vendedor_centimos,\n  moeda');
  });

  it('mostra a tentativa mais recente enquanto pendente e apenas uma confirmada depois do pagamento', () => {
    expect(migration).toContain("and (p.estado <> 'confirmado' or t.estado = 'confirmada')");
    expect(migration).toContain('t.criado_em desc');
    expect(migration).toContain('limit 1');
  });

  it('limita o resumo ao vendedor titular, sem exigir elegibilidade comercial atual', () => {
    expect(migration).toContain('and v.user_id = auth.uid()');
    expect(migration).not.toContain('public.vendedor_pode_receber_encomendas(v.id)');
    expect(migration).toContain('public.calcular_valores_financeiros_efetivos(p.id)');
    expect(migration).toContain('valores.comissao_efetiva_centimos');
    expect(migration).toContain('valores.valor_vendedor_efetivo_centimos');
  });

  it('não expõe as projeções a visitantes e concede apenas a autenticados', () => {
    expect(migration).toContain('revoke all on function public.obter_pagamento_encomenda_cliente(uuid) from public, anon');
    expect(migration).toContain('grant execute on function public.obter_pagamento_encomenda_cliente(uuid) to authenticated');
    expect(migration).toContain('grant execute on function public.obter_resumo_financeiro_encomenda_vendedor(uuid) to authenticated');
  });
});
