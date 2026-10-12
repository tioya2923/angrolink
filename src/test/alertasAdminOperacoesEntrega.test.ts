import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261001010000_alertar_admin_operacoes_entrega.sql'),
  'utf8',
);

describe('alertas administrativos de operações de entrega', () => {
  it('produz alertas apenas para entrega pronta e recusa do entregador', () => {
    expect(migration).toContain("v_evento.tipo_evento not in ('pronta_para_levantamento', 'entregador_recusou')");
    expect(migration).toContain("v_encomenda.modalidade_recebimento <> 'entrega'");
    expect(migration).toContain("v_tipo := 'entrega_pronta_atribuicao'");
    expect(migration).toContain("v_tipo := 'entrega_reatribuicao_necessaria'");
  });

  it('cria uma notificação privada e idempotente para cada administrador', () => {
    expect(migration).toContain('from public.administradores a');
    expect(migration).toContain("'admin'");
    expect(migration).toContain("'/dashboard/encomendas/' || v_encomenda.id::text");
    expect(migration).toContain("'admin:operacao-entrega:' || v_evento.id::text || ':admin:' || v_admin.user_id::text");
    expect(migration).toContain('perform public.criar_notificacao(');
  });

  it('isola a falha de notificação da transação comercial, mantendo aviso técnico mínimo', () => {
    expect(migration).toContain('exception when others then');
    expect(migration).toContain("raise warning 'Alerta administrativo de entrega ignorado (produtor=% evento=% sqlstate=%)'");
    expect(migration).toContain('tg_name, new.id, sqlstate');
    expect(migration).not.toContain('sqlerrm');
    expect(migration).toContain('return new;');
  });

  it('mantém os helpers internos fora do browser', () => {
    expect(migration).toContain('security definer');
    expect(migration).toContain('set search_path = pg_catalog, public');
    expect(migration).toContain('revoke all on function public.notificar_administradores_operacao_entrega(uuid), public.criar_alerta_admin_operacao_entrega()');
    expect(migration).not.toMatch(/grant execute on function public\.(notificar_administradores_operacao_entrega|criar_alerta_admin_operacao_entrega)/i);
    expect(migration).not.toContain('mensagens_encomenda');
    expect(migration).not.toContain('mensagens_pre_compra');
  });
});
