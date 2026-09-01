import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260813213248_implementar_politica_financeira_piloto.sql'),
  'utf8',
);

describe('contrato da política financeira V1', () => {
  it('centraliza os valores piloto na configuração ativa, não no frontend', () => {
    expect(migration).toContain('set comissao_bps = 500, prazo_repasse_horas = 48');
    expect(migration).toContain("where chave = 'padrao' and ativo = true");
  });

  it('mantém snapshots e calcula a base efetiva sem comissão sobre entrega', () => {
    expect(migration).toContain('p.subtotal_centimos - p.desconto_centimos - coalesce(r.produtos, 0)');
    expect(migration).toContain('valor_logistica_centimos - entrega_reembolsada');
    expect(migration).toContain('comissao_bps_snapshot');
  });

  it('protege reembolsos aprovados contra excedentes, incluindo cada componente', () => {
    expect(migration).toContain('from public.pagamentos where id = new.pagamento_id for update');
    expect(migration).toContain("estado in ('aprovado', 'processando', 'concluido')");
    expect(migration).toContain('Os reembolsos aprovados não podem exceder os valores efetivamente pagos.');
    expect(migration).toContain('O reembolso solicitado não pode exceder os valores da obrigação financeira.');
    expect(migration).toContain('reembolsos_produtos_aprovados_nao_superam_solicitados');
    expect(migration).toContain('reembolsos_entrega_aprovada_nao_supera_solicitada');
    expect(migration).toContain('reembolsos_taxa_aprovada_nao_supera_solicitada');
  });

  it('mantém ledger append-only e bloqueia escrita direta do browser', () => {
    expect(migration).toContain('Movimentos financeiros são append-only');
    expect(migration).toContain('revoke all on table public.reembolsos_pagamento, public.movimentos_financeiros from public, anon, authenticated');
    expect(migration).not.toContain('grant execute on function public.calcular_valores_financeiros_efetivos');
  });

  it('valida vínculos do ledger contra o pagamento e completa identidades ausentes', () => {
    expect(migration).toContain('create trigger validar_referencias_movimento_financeiro');
    expect(migration).toContain('A encomenda do movimento deve corresponder à encomenda do pagamento.');
    expect(migration).toContain('O vendedor do movimento deve corresponder ao vendedor do pagamento.');
    expect(migration).toContain('O cliente do movimento deve corresponder ao cliente do pagamento.');
    expect(migration).toContain('new.vendedor_id := v_pagamento.vendedor_id');
    expect(migration).toContain('new.cliente_id := v_pagamento.cliente_id');
  });
});
