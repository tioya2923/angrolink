import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const draft = readFileSync(resolve(process.cwd(), 'supabase/drafts/reserva_stock_v1.sql'), 'utf8');

describe('draft da Reserva Transacional de Stock V1 — inventário do vendedor', () => {
  it('expõe apenas uma projeção agregada e autorizada ao proprietário', () => {
    expect(draft).toContain('function public.obter_inventario_produto_vendedor');
    expect(draft).toContain('security definer');
    expect(draft).toContain('set search_path = public');
    expect(draft).toContain('v.user_id = auth.uid()');
    expect(draft).toContain("'quantidade_reservada'");
    expect(draft).not.toContain('grant select on public.reservas_stock_encomenda to authenticated');
  });

  it('mantém a escrita controlada por RPC e não aceita físico abaixo do reservado', () => {
    expect(draft).toContain('function public.definir_inventario_produto_vendedor');
    expect(draft).toContain('p_quantidade_fisica < v_reservado');
    expect(draft).toContain('desativar o controlo de stock enquanto existirem reservas ativas');
    expect(draft).toContain('grant execute on function public.obter_inventario_produto_vendedor(uuid) to authenticated');
    expect(draft).toContain('rollback;');
  });

  it('protege alterações de unidade no próprio servidor, inclusive por update direto', () => {
    expect(draft).toContain('function public.proteger_unidade_produto_com_reservas_ativas');
    expect(draft).toContain('before update of unidade on public.produtos');
    expect(draft).toContain("r.estado = 'ativa'");
    expect(draft).toContain('r.expira_em is null or r.expira_em > now()');
    expect(draft).toContain('Não é possível alterar a unidade enquanto existirem quantidades reservadas.');
  });

  it('devolve valores quantitativos como texto para preservar numeric(18,3)', () => {
    expect(draft).toContain('v_inventario.quantidade_fisica::text');
    expect(draft).toContain('v_reservado::text');
    expect(draft).toContain('(v_inventario.quantidade_fisica - v_reservado)::text');
  });
});
