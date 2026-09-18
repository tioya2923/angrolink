import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260917010000_corrigir_notificacoes_leitura_chat_pre_compra.sql', 'utf8');
const router = readFileSync('src/paginas/dashboard/DashboardRouter.tsx', 'utf8');

describe('correção de notificações do chat pré-compra', () => {
  it('usa URL canónica sem expor o corpo da mensagem', () => {
    expect(migration).toContain("'/dashboard/conversas-produtos/'||new.conversa_id::text");
    expect(migration).toContain("'Nova mensagem','Recebeste uma nova mensagem.'");
    expect(migration).not.toContain('new.corpo');
  });

  it('marca apenas notificações da conversa e do utilizador autenticado', () => {
    expect(migration).toContain('n.utilizador_id=auth.uid()');
    expect(migration).toContain("n.tipo='mensagem_pre_compra'");
    expect(migration).toContain("n.entidade_tipo='conversa_pre_compra'");
    expect(migration).toContain('n.entidade_id=p_conversa_id');
  });

  it('mantém deep-link canónico e legado para comprador e vendedor', () => {
    expect(router).toContain('conversas-produtos/:conversaId');
    expect(router).toContain('mensagens/pre-compra/:conversaId');
  });
});
