import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ler = (ficheiro: string) => readFileSync(resolve(process.cwd(), ficheiro), 'utf8');
const migration = ler('supabase/migrations/20260928010000_reabrir_analise_parceiro_documentos.sql');
const admin = ler('src/paginas/dashboard/admin/AdminEntregadores.tsx');

describe('reabertura administrativa do parceiro com documentos rejeitados', () => {
  it('converte a reabertura em pendência documental somente quando há documento rejeitado', () => {
    expect(migration).toContain("old.estado in ('rejeitado', 'suspenso', 'documentacao_expirada')");
    expect(migration).toContain("tg_op = 'UPDATE'");
    expect(migration).toContain("tg_op = 'INSERT'");
    expect(migration).not.toContain("tg_op = 'update'");
    expect(migration).not.toContain("tg_op = 'insert'");
    expect(migration).toContain('security invoker');
    expect(migration).toContain("current_user not in ('authenticated', 'anon')");
    expect(migration).toContain('create or replace function public.proteger_verificacao_logistica()');
    expect(migration).toContain("old.estado in ('rejeitado', 'expirado')");
    expect(migration).toContain("new.estado = 'em_analise'");
    expect(migration).toContain("documento.estado = 'rejeitado'");
    expect(migration).toContain("new.estado := 'documentos_pendentes'");
    expect(migration).toContain("new.motivo_rejeicao := null");
    expect(migration).toContain("new.motivo_suspensao := null");
  });

  it('recusa reenvio antes da reabertura e mantém a transição posterior para análise', () => {
    expect(migration).toContain("parceiro.estado in ('documentos_pendentes', 'documentacao_expirada')");
    expect(migration).toContain('O documento só pode ser reenviado depois de a análise ser reaberta para correção.');
    expect(migration).toContain("else 'em_analise'");
    expect(migration).toContain("then 'documentos_pendentes'");
    expect(migration).toContain("then 'documentacao_expirada'");
    expect(migration).not.toContain("set estado = 'aprovado'");
  });

  it('preserva a assinatura e as permissões da RPC de reenvio', () => {
    expect(migration).toContain('p_documento_id uuid');
    expect(migration).toContain('security definer');
    expect(migration).toContain('set search_path = public');
    expect(migration).toContain('revoke all on function public.reenviar_documento_parceiro(uuid, text, text, text, date) from public, anon');
    expect(migration).toContain('grant execute on function public.reenviar_documento_parceiro(uuid, text, text, text, date) to authenticated');
  });

  it('reflete o estado efetivamente devolvido pelo servidor no painel administrativo', () => {
    expect(admin).toContain('const atualizado = await atualizarEstadoParceiroEntrega');
    expect(admin).toContain('estado: atualizado.estado');
    expect(admin).toContain("atualizado.estado === 'documentos_pendentes'");
  });
});
