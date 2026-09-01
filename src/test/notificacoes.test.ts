import { describe, expect, it } from 'vitest';
import { eUrlDestinoInterna, normalizarNotificacao } from '@/services/notificacoes';

const base = {
  id: 'notificacao-1',
  utilizador_id: 'utilizador-1',
  contexto: 'compra',
  tipo: 'vendedor_confirmou',
  titulo: 'Encomenda confirmada',
  mensagem: 'O vendedor confirmou a tua encomenda.',
  entidade_tipo: 'encomenda',
  entidade_id: 'encomenda-1',
  url_destino: '/dashboard/encomendas/encomenda-1',
  lida: false,
  lida_em: null,
  metadata: {},
  criado_em: '2026-08-23T10:00:00.000Z',
};

describe('serviço de notificações', () => {
  it('normaliza apenas contratos de notificação completos e seguros para a UI', () => {
    expect(normalizarNotificacao(base)).toMatchObject({ id: 'notificacao-1', contexto: 'compra', lida: false });
    expect(normalizarNotificacao({ ...base, contexto: 'admin' })).toBeNull();
    expect(normalizarNotificacao({ ...base, lida: 'false' })).toBeNull();
    expect(normalizarNotificacao({ ...base, metadata: undefined })).toBeNull();
  });

  it('aceita apenas rotas internas de navegação', () => {
    expect(eUrlDestinoInterna('/dashboard/encomendas/abc')).toBe(true);
    expect(eUrlDestinoInterna('/dashboard/compras/abc')).toBe(true);
    expect(eUrlDestinoInterna('/dashboard/tarefas/abc')).toBe(true);
    expect(eUrlDestinoInterna('//outro-site')).toBe(false);
    expect(eUrlDestinoInterna('https://outro-site')).toBe(false);
    expect(eUrlDestinoInterna(null)).toBe(false);
  });
});
