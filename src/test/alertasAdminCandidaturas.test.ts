import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260923010000_alertar_admin_candidaturas_prontas.sql'),
  'utf8',
);

describe('alertas administrativos de candidaturas', () => {
  it('usa administradores como fonte autoritativa e cria uma notificação privada por administrador', () => {
    expect(migration).toContain('from public.administradores a');
    expect(migration).toContain("'admin'");
    expect(migration).toContain("p_contexto not in ('compra', 'venda', 'entrega', 'admin')");
    expect(migration).toContain('create table public.candidaturas_vendedor_revisoes');
    expect(migration).toContain('unique (vendedor_id, numero)');
    expect(migration).toContain('transacao_submissao bigint not null');
    expect(migration).toContain('transacao_pronta bigint');
    expect(migration).toContain("':revisao:' || v_revisao.numero::text");
    expect(migration).toContain("p_chave_evento || ':admin:' || v_admin.user_id::text");
    expect(migration).toContain('perform public.criar_notificacao(');
  });

  it('só alerta vendedor quando os documentos obrigatórios estão completos e pendentes de análise', () => {
    expect(migration).toContain('public.documentos_obrigatorios_vendedor_fase1');
    expect(migration).toContain("d.estado in ('pendente', 'em_analise', 'aprovado')");
    expect(migration).toContain("new.estado is distinct from 'pendente'");
    expect(migration).toContain("'candidatura_vendedor_pronta'");
    expect(migration).toContain("'/dashboard/pedidos-vendedores'");
  });

  it('abre uma revisão posterior somente no reenvio de documento rejeitado e não por documento opcional', () => {
    expect(migration).toContain("and old.estado = 'rejeitado'");
    expect(migration).toContain("and new.estado = 'pendente'");
    expect(migration).toContain('and v_revisao.pronta_em is not null');
    expect(migration).toContain('and v_revisao.transacao_pronta is distinct from txid_current()');
    expect(migration).toContain('values (v_vendedor.id, v_revisao.numero + 1, txid_current())');
    expect(migration).toContain('if v_revisao.pronta_em is not null then\n    return new;');
  });

  it('alerta parceiro na transição controlada para em análise, incluindo reenvio documental', () => {
    expect(migration).toContain("new.estado is distinct from 'em_analise'");
    expect(migration).toContain("old.estado not in ('rascunho', 'documentos_pendentes', 'documentacao_expirada')");
    expect(migration).toContain('after update of estado on public.parceiros_entrega');
    expect(migration).toContain("'candidatura_parceiro_entrega_pronta'");
    expect(migration).toContain("'/dashboard/pedidos-entregadores'");
  });

  it('preserva o isolamento: helpers internos não recebem execute do browser', () => {
    expect(migration).toContain('security definer');
    expect(migration).toContain('set search_path = pg_catalog, public');
    expect(migration).toContain('revoke all on function public.notificar_administradores_candidatura_pronta');
    expect(migration).not.toMatch(/grant execute on function public\.notificar_(administradores|candidatura)/i);
    expect(migration).not.toContain('mensagens_encomenda');
    expect(migration).not.toContain('mensagens_pre_compra');
  });
});
