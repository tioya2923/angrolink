import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const publicSchema = readFileSync('supabase/baseline/current/01_public_schema.sql', 'utf8');
const authCustom = readFileSync('supabase/baseline/current/02_auth_custom.sql', 'utf8');
const storageCustom = readFileSync('supabase/baseline/current/03_storage_custom.sql', 'utf8');
const realtime = readFileSync('supabase/baseline/current/04_realtime.sql', 'utf8');

describe('baseline pós-hardening', () => {
  it('mantém os contratos estreitos de vendedores, clientes e RPCs', () => {
    expect(publicSchema).toContain('CREATE POLICY "vendedores_leitura_publica"');
    expect(publicSchema).toContain('"status_aprovacao" = \'aprovado\'');
    expect(publicSchema).toContain('COALESCE("conta_ativa", false) = true');
    expect(publicSchema).toMatch(/GRANT SELECT\("criado_em"\).*"vendedores" TO "anon"/);
    expect(publicSchema).not.toMatch(/GRANT SELECT\("plano"\).*"vendedores" TO "anon"/);
    expect(publicSchema).not.toMatch(/GRANT SELECT\("email"\).*"vendedores" TO "anon"/);
    expect(publicSchema).not.toMatch(/GRANT SELECT\("email_login"\).*"vendedores" TO "anon"/);
    expect(publicSchema).toContain('CREATE POLICY "clientes_leitura_propria_ou_admin"');

    for (const rpc of [
      'obter_meu_vendedor',
      'listar_vendedores_admin',
      'atualizar_estado_vendedor_admin',
      'atualizar_plano_vendedor_admin',
      'atualizar_verificacao_vendedor_admin',
      'eliminar_vendedor_admin',
      'listar_contactos_produtos_vendedor',
      'listar_contactos_servicos_vendedor',
      'verificar_disponibilidade_cadastro',
    ]) {
      expect(publicSchema).toContain(`\"public\".\"${rpc}\"`);
    }

    expect(publicSchema).toContain('ALTER DEFAULT PRIVILEGES FOR ROLE "postgres"');
    expect(publicSchema).not.toContain('ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin"');
  });

  it('preserva os triggers Auth e Storage hardened sem objetos', () => {
    expect(authCustom).toContain('create trigger on_auth_user_created');
    expect(authCustom).toContain('public.handle_new_user()');
    expect(authCustom).toContain('create trigger on_auth_user_created_profile');
    expect(authCustom).toContain('public.handle_new_user_profile()');
    expect(authCustom).not.toMatch(/INSERT INTO "auth"\."users"|COPY "auth"\."users"/);

    expect(storageCustom).toContain('produtos_upload_proprio');
    expect(storageCustom).toContain('produtos_atualizar_proprio');
    expect(storageCustom).toContain('produtos_eliminar_proprio');
    expect(storageCustom).toContain('auth.uid()::text');
    expect(storageCustom).not.toContain('create policy "Permitir upload publico produtos"');
    expect(storageCustom).not.toMatch(/INSERT INTO storage\.objects|COPY storage\.objects/);
  });

  it('mantém somente a publicação Realtime confirmada', () => {
    for (const tabela of ['documentos_vendedor', 'encomendas', 'eventos_encomenda', 'notificacoes']) {
      expect(realtime).toContain(`'${tabela}'`);
    }
    expect(realtime).toContain("pubname = 'supabase_realtime'");
  });
});
