import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { verificarAdminNoServidor } from '@/lib/autorizacaoAdmin';

describe('autorização administrativa', () => {
  it('aceita apenas a confirmação explícita do servidor', async () => {
    await expect(verificarAdminNoServidor(async () => ({ data: true, error: null }))).resolves.toBe(true);
    await expect(verificarAdminNoServidor(async () => ({ data: false, error: null }))).resolves.toBe(false);
  });

  it('falha fechada quando a RPC devolve erro ou falha na rede', async () => {
    await expect(verificarAdminNoServidor(async () => ({ data: true, error: new Error('falha') }))).resolves.toBe(false);
    await expect(verificarAdminNoServidor(async () => { throw new Error('rede'); })).resolves.toBe(false);
  });

  it('não usa e-mail ou user_metadata como autoridade administrativa', () => {
    const contexto = readFileSync(join(process.cwd(), 'src/contextos/AuthContexto.tsx'), 'utf8');
    expect(contexto).not.toContain("authUser.email === 'admin@angrolink.ao'");
    expect(contexto).not.toContain("authUser.user_metadata?.papel === 'admin'");
    expect(contexto).toContain("supabase.rpc('eh_admin')");
  });
});
