import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20260901030000_corrigir_policies_operacionais_catalogo.sql',
  'utf8',
);

const corpoDaPolicy = (nome: string) => {
  const inicio = migration.indexOf(`create policy "${nome}"`);
  expect(inicio).not.toBe(-1);
  const fim = migration.indexOf(';', inicio);
  return migration.slice(inicio, fim + 1);
};

describe('policies operacionais de catálogo', () => {
  it('move a titularidade de vendedor para helpers SECURITY DEFINER estreitos', () => {
    for (const nome of ['vendedor_eh_dono', 'vendedor_eh_dono_aprovado']) {
      const inicio = migration.indexOf(`function public.${nome}(vendedor_uuid uuid)`);
      const fim = migration.indexOf('$$;', inicio);
      const funcao = migration.slice(inicio, fim + 3);
      expect(funcao).toContain('security definer');
      expect(funcao).toContain('set search_path = public');
      expect(funcao).toContain('from public.vendedores v');
      expect(funcao).toContain('v.user_id = auth.uid()');
    }
    expect(migration).toContain("v.status_aprovacao = 'aprovado'");
  });

  it('não deixa policies de produtos ou serviços consultar vendedores diretamente', () => {
    for (const nome of [
      'produtos_gerir_proprios',
      'servicos_gerir_proprios',
      'vendedor aprovado pode atualizar seus produtos',
      'vendedor aprovado pode atualizar seus servicos',
      'vendedor aprovado pode criar produto',
      'vendedor aprovado pode criar servico',
      'vendedor aprovado pode eliminar seus produtos',
      'vendedor aprovado pode eliminar seus servicos',
      'vendedor pode ver seus produtos',
      'vendedor pode ver seus servicos',
    ]) {
      const policy = corpoDaPolicy(nome);
      expect(policy).not.toContain('vendedores');
      expect(policy).toMatch(/public\.vendedor_eh_dono(?:_aprovado)?\(vendedor_id\)|public\.eh_admin\(\)/);
    }
  });

  it('não reabre SELECT direto em vendedores', () => {
    expect(migration).not.toMatch(/grant\s+select\s+on\s+public\.vendedores/i);
    expect(migration).not.toMatch(/grant\s+select\s*\(/i);
  });
});
