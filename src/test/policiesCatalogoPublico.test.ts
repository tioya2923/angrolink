import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20260901020000_corrigir_policies_catalogo_publico.sql',
  'utf8',
);

const corpoDaPolicy = (nome: string) => {
  const inicio = migration.indexOf(`create policy "${nome}"`);
  expect(inicio).not.toBe(-1);
  const fim = migration.indexOf(';', inicio);
  return migration.slice(inicio, fim + 1);
};

describe('policies públicas de catálogo', () => {
  it('endurece o helper existente para vendedor aprovado e ativo', () => {
    expect(migration).toContain('create or replace function public.is_vendedor_publico_aprovado(vendedor_uuid uuid)');
    expect(migration).toContain('security definer');
    expect(migration).toContain('set search_path = public');
    expect(migration).toContain("v.status_aprovacao = 'aprovado'");
    expect(migration).toContain('coalesce(v.conta_ativa, false) = true');
    expect(migration).toContain('revoke all on function public.is_vendedor_publico_aprovado(uuid) from public;');
    expect(migration).toContain('grant execute on function public.is_vendedor_publico_aprovado(uuid) to anon, authenticated;');
  });

  it('remove a dependência direta de vendedores.user_id das policies públicas', () => {
    for (const nome of ['catalogo_publico', 'servicos_publicos']) {
      const policy = corpoDaPolicy(nome);
      expect(policy).toContain('public.is_vendedor_publico_aprovado(vendedor_id)');
      expect(policy).toContain('publicado = true');
      expect(policy).toContain('disponivel = true');
      expect(policy).not.toContain('vendedores');
      expect(policy).not.toContain('user_id');
    }
  });

  it('não reabre SELECT de tabela ou colunas privadas de vendedores', () => {
    expect(migration).not.toMatch(/grant\s+select\s+on\s+public\.vendedores/i);
    expect(migration).not.toMatch(/grant\s+select\s*\([^)]*user_id/i);
    for (const campo of ['email', 'email_login', 'plano']) {
      expect(migration).not.toMatch(new RegExp(`grant\\s+select\\s*\\([^)]*${campo}`, 'i'));
    }
  });
});
