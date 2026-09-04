import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ownership = readFileSync(
  'supabase/migrations/20260904030000_corrigir_ownership_documentos_vendedor.sql',
  'utf8',
);
const hardening = readFileSync(
  'supabase/migrations/20260830020000_endurecer_rls_legado_clientes_vendedores_storage_produtos.sql',
  'utf8',
);
const onboarding = readFileSync('src/paginas/PaginaAnunciar.tsx', 'utf8');

function policy(name: string) {
  const start = ownership.indexOf(`create policy ${name}`);
  const end = ownership.indexOf('create policy ', start + 1);
  return ownership.slice(start, end === -1 ? undefined : end);
}

describe('ownership documental de vendedor', () => {
  it('define um helper SECURITY DEFINER estável sem aceitar user_id', () => {
    expect(ownership).toContain('vendedor_pertence_ao_utilizador_autenticado(p_vendedor_id uuid)');
    expect(ownership).toContain('returns boolean');
    expect(ownership).toContain('stable');
    expect(ownership).toContain('security definer');
    expect(ownership).toContain('set search_path = public');
    expect(ownership).toContain('auth.uid() is not null');
    expect(ownership).toContain('v.id = p_vendedor_id');
    expect(ownership).toContain('v.user_id = auth.uid()');
    expect(ownership).not.toContain('p_user_id');
    expect(ownership).toContain('revoke all on function public.vendedor_pertence_ao_utilizador_autenticado(uuid) from public, anon;');
    expect(ownership).toContain('grant execute on function public.vendedor_pertence_ao_utilizador_autenticado(uuid) to authenticated;');
  });

  it('usa a mesma fronteira segura nas policies de leitura, criação e atualização', () => {
    for (const name of [
      'documentos_vendedor_leitura_propria_admin',
      'documentos_vendedor_criar_proprio',
      'documentos_vendedor_atualizar_proprio_admin',
    ]) {
      const body = policy(name);
      expect(body).toContain('public.vendedor_pertence_ao_utilizador_autenticado(vendedor_id)');
      expect(body).not.toContain('from public.vendedores');
    }
  });

  it('não reabre SELECT amplo em vendedores e preserva o insert sem returning do onboarding', () => {
    expect(hardening).not.toMatch(/grant\s+select\s+on\s+public\.vendedores\s+to\s+authenticated/i);
    expect(onboarding).toContain('.insert(novoVendedor);');
    expect(onboarding).not.toContain('.insert(novoVendedor)\n        .select("id")\n        .single();');
  });
});
