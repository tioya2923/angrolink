import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260828120000_fechar_ciclo_operacional_entrega_fase_1.sql'),
  'utf8',
);
const checkout = readFileSync(
  resolve(process.cwd(), 'src/paginas/PaginaCheckoutPendente.tsx'),
  'utf8',
);
const ordemAtual = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260907010000_corrigir_ordem_otp_pagamento_conclusao.sql'),
  'utf8',
);

describe('pagamento no levantamento atómico — Fase 1', () => {
  it('mantém a idempotência de checkout privada e partilhada entre modalidades', () => {
    expect(migration).toContain('create table public.idempotencia_checkout_encomenda');
    expect(migration).toContain("unique (cliente_id, modalidade_recebimento, chave_idempotencia)");
    expect(migration).toContain('alter table public.idempotencia_checkout_encomenda enable row level security');
    expect(migration).toContain('revoke all on table public.idempotencia_checkout_encomenda from public, anon, authenticated');
    expect(migration).toContain("'modalidade_recebimento', 'levantamento'");
    expect(migration).toContain("'modalidade_recebimento', 'entrega'");
  });

  it('fecha o bypass das assinaturas antigas e expõe somente as idempotentes', () => {
    expect(migration).toContain('revoke all on function public.criar_encomenda_levantamento(jsonb,text,text,text,text) from public,anon,authenticated');
    expect(migration).toContain('revoke all on function public.criar_encomenda_entrega(jsonb,text,text,text,text,text,text,text,text,text) from public,anon,authenticated');
    expect(migration).toContain('grant execute on function public.criar_encomenda_levantamento(jsonb,text,text,text,text,uuid),public.criar_encomenda_entrega(jsonb,text,text,text,text,text,text,text,text,text,uuid) to authenticated');
  });

  it('usa hash canónico de intenção sem receber preços do browser', () => {
    expect(migration).toContain('normalizar_itens_checkout_idempotencia');
    expect(migration).toContain('calcular_hash_intencao_checkout');
    expect(migration).toContain("jsonb_build_object('produto_id', v_produto_id, 'quantidade', v_quantidade)");
    expect(migration).not.toContain("'preco_browser'");
    expect(migration).not.toContain("'total_browser'");
  });

  it('cria obrigação e tentativa de levantamento dentro da RPC idempotente', () => {
    const inicio = migration.indexOf('create function public.criar_encomenda_levantamento(');
    const fim = migration.indexOf('create function public.criar_encomenda_entrega(', inicio);
    const funcao = migration.slice(inicio, fim);
    expect(funcao).toContain('p_idempotency_key uuid');
    expect(funcao).toContain('pg_advisory_xact_lock');
    expect(funcao).toContain('criar_pagamento_encomenda');
    expect(funcao).toContain("criar_tentativa_pagamento(v_pagamento_id, 'pagamento_no_levantamento'");
    expect(funcao).toContain('set encomenda_id = v_encomenda.id, concluida_em = now()');
  });

  it('mantém o OTP separado do pagamento no contrato atualmente aplicado', () => {
    const inicio = ordemAtual.indexOf('create or replace function public.validar_codigo_levantamento_vendedor(');
    const fim = ordemAtual.indexOf('create or replace function public.registar_pagamento_no_levantamento_vendedor', inicio);
    const validar = ordemAtual.slice(inicio, fim);
    const pagar = ordemAtual.slice(fim);
    expect(validar).toContain("'codigo_levantamento_validado'");
    expect(validar).not.toContain("set estado='confirmado'");
    expect(validar).not.toContain("set estado='concluida'");
    expect(pagar).toContain("set estado='confirmada'");
    expect(pagar).toContain("set estado='confirmado'");
    expect(pagar).toContain("set estado='concluida'");
    expect(pagar).toContain("'levantamento_confirmado'");
  });

  it('não deixa o frontend criar o pagamento depois da encomenda', () => {
    expect(checkout).not.toContain('criarObrigacaoPagamentoNoLevantamento');
    expect(checkout).toContain('criarEncomendaLevantamento');
  });

  it('explica que a validação do OTP precede a confirmação presencial do pagamento', () => {
    expect(checkout).toContain('Pague ao vendedor quando levantar a encomenda.');
    expect(checkout).toContain('O vendedor valida primeiro o seu código de levantamento e só depois confirma o pagamento presencial.');
    expect(checkout).toContain('Confirmar encomenda para levantamento');
    expect(checkout).not.toContain('Confirmar e pagar no levantamento');
  });
});
