import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ler = (ficheiro: string) => readFileSync(resolve(process.cwd(), ficheiro), 'utf8');
const migration = ler('supabase/migrations/20260907010000_corrigir_ordem_otp_pagamento_conclusao.sql');
const parceiro = ler('src/paginas/dashboard/parceiro/ParceiroTarefaDetalhe.tsx');
const comprador = ler('src/paginas/dashboard/cliente/ClienteEncomendaDetalhe.tsx');
const vendedor = ler('src/paginas/dashboard/vendedor/VendedorEncomendaDetalhe.tsx');
const checkout = ler('src/paginas/PaginaCheckoutPendente.tsx');

describe('OTP → pagamento → conclusão', () => {
  it('mantém OTP de entrega como confirmação física, sem concluir nem confirmar pagamento', () => {
    const inicio = migration.indexOf('create or replace function public.validar_codigo_entrega_entregador');
    const fim = migration.indexOf('create or replace function public.registar_pagamento_na_entrega_entregador', inicio);
    const funcao = migration.slice(inicio, fim);
    expect(funcao).toContain("'codigo_entrega_validado'");
    expect(funcao).toContain("estado_encomenda:='chegou_destino'");
    expect(funcao).not.toContain("set estado='confirmado'");
    expect(funcao).not.toContain("set estado='concluida'");
  });

  it('bloqueia dinheiro na entrega antes do OTP e conclui atomicamente depois', () => {
    const inicio = migration.indexOf('create or replace function public.registar_pagamento_na_entrega_entregador');
    const fim = migration.indexOf('create or replace function public.validar_codigo_levantamento_vendedor', inicio);
    const funcao = migration.slice(inicio, fim);
    expect(funcao).toContain('Valide primeiro o código de entrega antes de registar o pagamento.');
    expect(funcao).toContain("set estado='confirmada'");
    expect(funcao).toContain("set estado='confirmado'");
    expect(funcao).toContain("'entrega_confirmada'");
    expect(funcao).toContain("update public.atribuicoes_entrega_encomenda set estado='concluida'");
  });

  it('separa OTP e dinheiro no levantamento e fecha o bypass do comprador', () => {
    const inicio = migration.indexOf('create or replace function public.validar_codigo_levantamento_vendedor');
    const fim = migration.indexOf('create or replace function public.registar_pagamento_no_levantamento_vendedor', inicio);
    const validar = migration.slice(inicio, fim);
    const pagar = migration.slice(fim);
    expect(validar).toContain("'codigo_levantamento_validado'");
    expect(validar).toContain("estado_encomenda:='pronta_para_levantamento'");
    expect(validar).not.toContain("set estado='confirmado'");
    expect(pagar).toContain('Valide primeiro o código de levantamento antes de registar o pagamento.');
    expect(pagar).toContain("'levantamento_confirmado'");
    expect(migration).not.toContain("e.estado='levantada' and p_proximo_estado='concluida'");
    expect(migration).toContain("concluido_em=case when p_proximo_estado='concluida' then now() else concluido_em end");
  });

  it('preserva os eventos administrativos no CHECK e acrescenta apenas os dois eventos de validação', () => {
    expect(migration).toContain("'atribuicao_liberada_admin'");
    expect(migration).toContain("'incidente_operacional_aberto'");
    expect(migration).toContain("'incidente_operacional_resolvido'");
    expect(migration).toContain("'codigo_entrega_validado'");
    expect(migration).toContain("'codigo_levantamento_validado'");
  });

  it('não expõe código, hash ou OTP em eventos e usa indicadores seguros no frontend', () => {
    expect(migration).not.toMatch(/jsonb_build_object\([^)]*(codigo_hash|p_codigo|apresentado)/i);
    expect(migration).toContain("'codigo_entrega_validado',exists");
    expect(parceiro).toContain('codigo_entrega_validado');
    expect(comprador).toContain('codigo_entrega_validado');
    expect(comprador).toContain('estado_levantamento?.codigo_validado');
    expect(vendedor).toContain('Confirmar pagamento recebido');
  });

  it('mantém cliente e vendedor-comprador no detalhe partilhado', () => {
    const rotas = ler('src/paginas/dashboard/DashboardRouter.tsx');
    expect(rotas).toContain('path="compras/:id" element={<ClienteEncomendaDetalhe rotaVoltar="/dashboard/compras"/>}');
    expect(rotas).toContain('path="encomendas/:id" element={<ClienteEncomendaDetalhe/>}');
  });

  it('alinha todos os textos e ações do frontend com OTP antes do pagamento', () => {
    expect(checkout).toContain('O vendedor valida primeiro o seu código de levantamento e só depois confirma o pagamento presencial.');
    expect(checkout).not.toContain('O pagamento será confirmado quando o vendedor validar o seu código de levantamento.');
    expect(parceiro).toContain('Valida presencialmente o código do comprador. Só depois confirma o pagamento recebido quando aplicável.');
    expect(parceiro).toContain('const aguardaPagamento = pagamentoNaEntrega && codigoEntregaValidado && !pagamentoConfirmado;');
    expect(comprador).not.toContain("transicionarEncomendaLevantamento(encomenda.id, 'concluida')");
    expect(comprador).not.toContain('Confirmar receção');
  });
});
