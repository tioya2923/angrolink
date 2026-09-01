import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260823020000_criar_notificacoes_realtime_v1.sql'),
  'utf8',
);

const triggerFunction = migration.slice(
  migration.indexOf('create or replace function public.notificar_evento_encomenda()'),
  migration.indexOf('drop trigger if exists criar_notificacao_evento_encomenda'),
);

describe('notificações Realtime V1 — backend', () => {
  it('permite apenas leitura própria por utilizador autenticado', () => {
    expect(migration).toContain('alter table public.notificacoes enable row level security;');
    expect(migration).toMatch(/create policy notificacoes_leitura_propria[\s\S]*using \(utilizador_id = auth\.uid\(\)\)/i);
    expect(migration).toContain('grant select on table public.notificacoes to authenticated;');
    expect(migration).toContain('revoke all on table public.notificacoes from public, anon, authenticated;');
  });

  it('aceita apenas URLs internas e bloqueia caminhos protocol-relative', () => {
    expect(migration).toContain("left(url_destino, 1) = '/' and left(url_destino, 2) <> '//'");
    expect(migration).toContain("left(p_url_destino, 1) <> '/' or left(p_url_destino, 2) = '//'");
  });

  it('preserva a primeira notificação em retries idempotentes', () => {
    expect(migration).toMatch(/on conflict \(chave_idempotencia\)[\s\S]*do nothing/i);
    expect(migration).toMatch(/if v_id is null and p_chave is not null[\s\S]*where chave_idempotencia = p_chave/i);
    expect(migration).not.toMatch(/do update set chave_idempotencia/i);
  });

  it('resolve rotas de compra por identidade e tarefa por atribuição determinística', () => {
    expect(triggerFunction).toContain("'/dashboard/compras/' || v_encomenda.id");
    expect(triggerFunction).toContain("'/dashboard/encomendas/' || v_encomenda.id");
    expect(triggerFunction).toContain("new.metadados ->> 'atribuicao_id'");
    expect(triggerFunction).toContain("'/dashboard/tarefas/' || v_atribuicao_id");
    expect(triggerFunction).not.toMatch(/a\.encomenda_id[\s\S]*limit 1/i);
  });

  it('isola falhas de notificação e mantém mensagens específicas', () => {
    expect(triggerFunction).toMatch(/begin[\s\S]*exception when others then[\s\S]*raise warning/i);
    for (const texto of [
      'Nova encomenda recebida',
      'Encomenda confirmada',
      'Encomenda recusada',
      'Encomenda pronta',
      'Nova entrega atribuída',
      'Entregador confirmado',
    ]) {
      expect(triggerFunction).toContain(texto);
    }
  });

  it('publica notificações apenas se ainda não estiverem na publication', () => {
    expect(migration).toMatch(/from pg_publication_tables[\s\S]*tablename = 'notificacoes'/i);
    expect(migration).toContain('alter publication supabase_realtime add table public.notificacoes;');
  });
});
