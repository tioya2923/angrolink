import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20260830020000_endurecer_rls_legado_clientes_vendedores_storage_produtos.sql', 'utf8');
const baseline = readFileSync('supabase/baseline/current/01_public_schema.sql', 'utf8');

describe('hardening RLS legado', () => {
  it('fecha grants amplos e aplica RLS público estrito', () => {
    expect(sql).toContain('revoke all on table public.vendedores from anon, authenticated;');
    expect(sql).toMatch(/revoke select \([^)]*user_id[^)]*email_login[^)]*aprovado_por[^)]*\) on public\.vendedores from anon, authenticated;/i);
    expect(sql).not.toMatch(/grant\s+select\s+on\s+public\.vendedores\s+to\s+(anon|authenticated)/i);
    expect(sql).toContain('grant select (id,nome_comercial');
    expect(sql).toContain("status_aprovacao='aprovado' and coalesce(conta_ativa,false)=true");
    expect(sql).not.toContain('admin@angrolink.ao');
  });

  it('protege cadastro, edição própria e clientes de terceiros', () => {
    expect(sql).toContain("with check (user_id=auth.uid())");
    expect(sql).toContain("using (user_id=auth.uid()) with check (user_id=auth.uid())");
    expect(sql).toContain('new.aprovado_em is not null');
    expect(sql).toContain('new.aprovado_por is not null');
    expect(sql).toContain('clientes_leitura_propria_ou_admin');
    expect(sql).not.toContain('clientes_contactos_do_vendedor" on public.clientes for select');
  });

  it('declara RPCs estreitas, administrativas e de contactos', () => {
    for (const nome of ['obter_meu_vendedor', 'listar_vendedores_admin', 'atualizar_estado_vendedor_admin', 'atualizar_plano_vendedor_admin', 'atualizar_verificacao_vendedor_admin', 'eliminar_vendedor_admin', 'listar_contactos_produtos_vendedor', 'listar_contactos_servicos_vendedor']) {
      expect(sql).toContain(`function public.${nome}`);
    }
    expect(sql).toContain('public.eh_admin()');
    expect(sql).toContain('aprovado_por=case when p_estado=');
    expect(sql).toContain('auth.uid()');
    expect(sql).toContain('revoke all on function public.obter_meu_vendedor() from public,anon;');
    expect(sql).toContain('security definer set search_path=public');
  });

  it('não reabre grants privados para authenticated', () => {
    const grantPublico = sql.match(/grant select \([^)]*\) on public\.vendedores to anon, authenticated;/i)?.[0] || '';
    for (const campo of ['user_id', 'email', 'email_login', 'aprovado_por', 'motivo_rejeicao', 'conta_ativa', 'plano']) expect(grantPublico).not.toContain(campo);
  });

  it('mantém a RPC própria sem marcadores administrativos ou de login desnecessários', () => {
    const inicio = sql.indexOf('function public.obter_meu_vendedor');
    const fim = sql.indexOf('revoke all on function public.obter_meu_vendedor()', inicio);
    const funcao = sql.slice(inicio, fim);
    for (const campo of ['email_login', 'aprovado_por', 'proximo_destaque_produto_em', 'proximo_destaque_servico_em']) expect(funcao).not.toContain(campo);
  });

  it('endurece defaults futuros e o namespace de Storage', () => {
    expect(sql).toContain('alter default privileges for role postgres');
    expect(sql).not.toContain('alter default privileges for role supabase_admin');
    expect(sql).toContain('revoke all on tables from anon,authenticated');
    expect(sql).toContain('revoke all on sequences from anon,authenticated');
    expect(sql).toContain('revoke execute on functions from public,anon,authenticated');
    expect(sql).toContain("bucket_id='produtos' and (storage.foldername(name))[1]=auth.uid()::text");
  });

  it('mantém a titularidade de produtos no servidor', () => {
    for (const policy of [
      'vendedor aprovado pode criar produto',
      'vendedor aprovado pode atualizar seus produtos',
      'vendedor aprovado pode eliminar seus produtos',
    ]) expect(baseline).toContain(`CREATE POLICY "${policy}" ON "public"."produtos"`);
    expect(baseline).toContain('"v"."user_id" = "auth"."uid"()');
  });
});
