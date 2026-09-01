import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260814002000_impedir_multiplas_tentativas_confirmadas.sql'),
  'utf8',
);

describe('integridade de tentativas de pagamento', () => {
  it('permite no máximo uma tentativa confirmada por pagamento no banco', () => {
    expect(migration).toContain('create unique index if not exists tentativas_pagamento_uma_confirmada_por_pagamento_idx');
    expect(migration).toContain('on public.tentativas_pagamento (pagamento_id)');
    expect(migration).toContain("where estado = 'confirmada'");
  });

  it('não cria RPC nem limita tentativas que ainda não estão confirmadas', () => {
    expect(migration).not.toContain('create function');
    expect(migration).not.toContain("where estado in ('confirmada'");
  });
});
