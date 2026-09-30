import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260930010000_publicar_realtime_parceiros_entrega.sql'),
  'utf8',
);

describe('publicação Realtime de parceiros de entrega', () => {
  it('publica apenas o parceiro e os seus documentos sem alterar RLS, grants ou dados', () => {
    expect(migration).toContain("array['parceiros_entrega', 'documentos_parceiro_entrega']");
    expect(migration).toContain("alter publication supabase_realtime add table public.%I");
    expect(migration).not.toMatch(/create policy|alter policy|grant |revoke |insert |update |delete /i);
  });

  it('é idempotente e falha explicitamente se a publicação não existir', () => {
    expect(migration).toContain("if not exists (select 1 from pg_publication where pubname = 'supabase_realtime')");
    expect(migration).toContain("if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'");
  });
});
