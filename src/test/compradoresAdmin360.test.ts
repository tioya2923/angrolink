import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260814160000_criar_backend_admin_compradores_360.sql'),
  'utf8',
);

type Tentativa = { estado: string; metodo: string; criadoEm: number };

function metodoProjetado(estadoPagamento: string, tentativas: Tentativa[]): string | null {
  const elegiveis = estadoPagamento === 'confirmado'
    ? tentativas.filter(tentativa => tentativa.estado === 'confirmada')
    : tentativas;

  return [...elegiveis].sort((a, b) => b.criadoEm - a.criadoEm)[0]?.metodo ?? null;
}

describe('método de pagamento no Comprador 360', () => {
  it('mantém a regra SQL que exclui tentativas não confirmadas de pagamentos confirmados', () => {
    expect(migration).toContain("and (p.estado <> 'confirmado' or t.estado = 'confirmada')");
    expect(migration).toContain('order by t.criado_em desc');
  });

  it('mostra a tentativa pendente quando o pagamento ainda está pendente', () => {
    expect(metodoProjetado('pendente', [{ estado: 'pendente', metodo: 'referencia', criadoEm: 1 }])).toBe('referencia');
  });

  it('mostra a tentativa mais recente, mesmo falhada, quando o pagamento não está confirmado', () => {
    expect(metodoProjetado('pendente', [
      { estado: 'pendente', metodo: 'referencia', criadoEm: 1 },
      { estado: 'falhada', metodo: 'online', criadoEm: 2 },
    ])).toBe('online');
  });

  it('mostra apenas uma tentativa confirmada para pagamento confirmado e retorna nulo se faltar', () => {
    expect(metodoProjetado('confirmado', [{ estado: 'confirmada', metodo: 'online', criadoEm: 1 }])).toBe('online');
    expect(metodoProjetado('confirmado', [{ estado: 'falhada', metodo: 'online', criadoEm: 2 }])).toBeNull();
  });

  it('mantém a confirmada mesmo que uma falhada seja mais recente', () => {
    expect(metodoProjetado('confirmado', [
      { estado: 'confirmada', metodo: 'pagamento_no_levantamento', criadoEm: 1 },
      { estado: 'falhada', metodo: 'online', criadoEm: 2 },
    ])).toBe('pagamento_no_levantamento');
  });
});
