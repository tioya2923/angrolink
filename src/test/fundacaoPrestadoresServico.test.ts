import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20260908010000_criar_fundacao_prestadores_servicos.sql',
  'utf8',
);

describe('fundação isolada de prestadores de serviço', () => {
  it('é aditiva e preserva integralmente o vínculo legado do serviço', () => {
    expect(migration).toContain('add column prestador_id uuid null');
    expect(migration).toContain('add column categoria_id uuid null');
    expect(migration).not.toMatch(/drop column\s+vendedor_id/i);
    expect(migration).not.toMatch(/alter column\s+vendedor_id.*not null/i);
    expect(migration).not.toMatch(/rename column\s+vendedor_id/i);
  });

  it('cria prestadores como capacidade separada de auth.users', () => {
    expect(migration).toContain('create table public.prestadores_servico');
    expect(migration).toContain('user_id uuid not null unique references auth.users(id)');
    expect(migration).not.toMatch(
      /user_id uuid not null unique references auth\.users\(id\)\s+on delete cascade/i,
    );
    expect(migration).toContain("status_aprovacao text not null default 'pendente'");
    expect(migration).toContain("check (status_aprovacao in ('pendente', 'aprovado', 'rejeitado', 'suspenso'))");
    expect(migration).toContain("check (tipo_prestador is null or tipo_prestador in ('pessoa', 'empresa'))");
  });

  it('protege campos administrativos e não permite autoaprovação', () => {
    const trigger = migration.slice(
      migration.indexOf('create or replace function public.proteger_prestador_servico'),
      migration.indexOf('create or replace function public.atualizar_atualizado_em_categoria_servico'),
    );
    expect(trigger).toContain("new.status_aprovacao <> 'pendente'");
    expect(trigger).toContain('new.conta_ativa is not true');
    expect(trigger).toContain('new.verificado is not false');
    expect(trigger).toContain('Campos administrativos de prestador só podem ser definidos por um administrador.');
    expect(trigger).toContain('new.status_aprovacao is distinct from old.status_aprovacao');
    expect(trigger).toContain('new.conta_ativa is distinct from old.conta_ativa');
    expect(trigger).toContain('new.verificado is distinct from old.verificado');
    expect(trigger).toContain('new.user_id is distinct from old.user_id');
    expect(trigger).toContain("if tg_op = 'insert' then");
    expect(trigger).toContain('new.criado_em := now();');
    expect(trigger).toContain('new.atualizado_em := now();');
  });

  it('permite ao titular criar e editar somente o próprio perfil', () => {
    expect(migration).toContain('create policy prestadores_servico_criar_proprio');
    expect(migration).toMatch(/prestadores_servico_criar_proprio[\s\S]*with check \(user_id = auth\.uid\(\)\);/);
    expect(migration).toContain('create policy prestadores_servico_atualizar_proprio');
    const atualizar = migration.slice(
      migration.indexOf('create policy prestadores_servico_atualizar_proprio'),
      migration.indexOf('create policy prestadores_servico_admin_gerir'),
    );
    expect(atualizar).toContain('using (user_id = auth.uid())');
    expect(atualizar).toContain('with check (user_id = auth.uid())');
  });

  it('não concede SELECT público amplo nem DELETE próprio da tabela privada de prestadores', () => {
    expect(migration).toContain('alter table public.prestadores_servico enable row level security;');
    expect(migration).toContain('create policy prestadores_servico_ler_proprio');
    expect(migration).toContain('create policy prestadores_servico_admin_gerir');
    expect(migration).toContain('revoke all on table public.prestadores_servico from public, anon, authenticated;');
    expect(migration).toContain('grant select, insert, update on table public.prestadores_servico to authenticated;');
    expect(migration).not.toMatch(/grant[^;]*delete[^;]*on table public\.prestadores_servico/i);
    expect(migration).not.toMatch(/prestadores_servico_[^\n]*\n[\s\S]{0,120}for delete/i);
    expect(migration).not.toContain('create or replace function public.eliminar_prestador_servico_admin');
    expect(migration).not.toContain('public.eliminar_prestador_servico_admin(uuid)');
    expect(migration).not.toMatch(/grant select on table public\.prestadores_servico to anon/i);
    expect(migration).not.toMatch(/for select to anon[\s\S]{0,120}prestadores_servico/i);
  });

  it('expõe somente a projeção pública de prestadores aprovados e ativos por RPC', () => {
    const publico = migration.slice(
      migration.indexOf('create or replace function public.listar_prestadores_servicos_publicos'),
      migration.indexOf('create or replace function public.listar_prestadores_servico_admin'),
    );
    expect(publico).toContain('security definer');
    expect(publico).toContain('set search_path = public');
    expect(publico).toContain("p.status_aprovacao = 'aprovado'");
    expect(publico).toContain('p.conta_ativa = true');
    const contrato = publico.slice(
      publico.indexOf('returns table('),
      publico.indexOf('language sql'),
    );
    expect(contrato).not.toMatch(/\buser_id\b/);
    expect(contrato).not.toMatch(/\bemail\b/);
    expect(contrato).not.toMatch(/\bstatus_aprovacao\b/);
    expect(migration).toContain('grant execute on function public.listar_prestadores_servicos_publicos(uuid[]) to anon, authenticated;');
  });

  it('cria categorias profissionais sem logística interna da ANGROLINK', () => {
    expect(migration).toContain('create table public.categorias_servico');
    expect(migration).toContain('slug text not null unique');
    for (const categoria of [
      'preparacao-de-terreno',
      'mao-de-obra-agricola',
      'assistencia-tecnica',
      'consultoria-agricola',
      'veterinaria',
      'outros-servicos-profissionais',
    ]) {
      expect(migration).toContain(`'${categoria}'`);
    }
    expect(migration).not.toMatch(/['"](?:entrega|estafeta|transporte(?:-de-encomendas-angrolink)?)['"]/i);
  });

  it('mantém produtos, encomendas, checkout e logística fora da migration', () => {
    for (const dominio of ['produtos', 'encomendas', 'checkout', 'pagamentos', 'parceiros_entrega', 'atribuicoes_entrega_encomenda']) {
      expect(migration).not.toContain(`public.${dominio}`);
    }
  });
});
