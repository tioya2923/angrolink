import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const mocks = vi.hoisted(() => {
  const upload = vi.fn();
  const remove = vi.fn();
  const rpc = vi.fn();
  return {
    getUser: vi.fn(),
    upload,
    remove,
    rpc,
    storageFrom: vi.fn(() => ({ upload, remove })),
  };
});

vi.mock('@/services/supabase', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    storage: { from: mocks.storageFrom },
    rpc: mocks.rpc,
  },
}));

vi.mock('@/lib/uuid', () => ({
  gerarUuidV4: vi.fn()
    .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
    .mockReturnValueOnce('22222222-2222-4222-8222-222222222222'),
}));

import { reenviarDocumentoParceiro } from '@/services/api';

const documentoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ficheiroNovoFrente = new File(['imagem-frente-nova-vermelha'], 'frente-nova.png', { type: 'image/png' });
const ficheiroNovoVerso = new File(['imagem-verso-nova-azul'], 'verso-novo.png', { type: 'image/png' });

describe('reenviarDocumentoParceiro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-sintetico' } }, error: null });
    mocks.upload.mockResolvedValue({ error: null });
    mocks.remove.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ error: null });
  });

  it('envia os dois ficheiros novos, usa os caminhos novos na RPC e nunca referencia a versao anterior', async () => {
    await reenviarDocumentoParceiro(documentoId, ficheiroNovoFrente, ficheiroNovoVerso);

    expect(mocks.upload).toHaveBeenNthCalledWith(
      1,
      `user-sintetico/reenvio-${documentoId}-frente-11111111-1111-4111-8111-111111111111.png`,
      ficheiroNovoFrente,
      { contentType: 'image/png' },
    );
    expect(mocks.upload).toHaveBeenNthCalledWith(
      2,
      `user-sintetico/reenvio-${documentoId}-verso-22222222-2222-4222-8222-222222222222.png`,
      ficheiroNovoVerso,
      { contentType: 'image/png' },
    );
    expect(mocks.rpc).toHaveBeenCalledWith('reenviar_documento_parceiro', {
      p_documento_id: documentoId,
      p_frente_path: `user-sintetico/reenvio-${documentoId}-frente-11111111-1111-4111-8111-111111111111.png`,
      p_verso_path: `user-sintetico/reenvio-${documentoId}-verso-22222222-2222-4222-8222-222222222222.png`,
    });
  });

  it('nao chama a RPC quando o upload falha', async () => {
    mocks.upload.mockResolvedValueOnce({ error: new Error('falha de upload') });

    await expect(reenviarDocumentoParceiro(documentoId, ficheiroNovoFrente, ficheiroNovoVerso)).rejects.toThrow('falha de upload');

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('mantem a referencia da versao atual e reabre imagens quando os caminhos mudam', () => {
    const raiz = process.cwd();
    const migration = readFileSync(resolve(raiz, 'supabase/migrations/20260928010000_reabrir_analise_parceiro_documentos.sql'), 'utf8');
    const painelParceiro = readFileSync(resolve(raiz, 'src/paginas/dashboard/parceiro/ParceiroResumo.tsx'), 'utf8');
    const painelAdmin = readFileSync(resolve(raiz, 'src/paginas/dashboard/admin/AdminEntregadorDetalhe.tsx'), 'utf8');

    expect(migration).toContain('frente_path = p_frente_path');
    expect(migration).toContain('verso_path = p_verso_path');
    expect(migration).toContain('versao_atual_id = v_nova_versao');
    expect(painelParceiro).toContain('[documento.frente_path, documento.verso_path]');
    expect(painelAdmin).toContain('obterDocumentoEntregadorAdmin(versaoId, recurso)');
  });
});
