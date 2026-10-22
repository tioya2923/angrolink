import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
}));

vi.mock('@/services/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: mocks.from,
  },
}));

import { updateVendedor } from '@/services/api';

const vendedor = {
  id: 'a0000000-0000-4000-8000-000000000001',
  user_id: 'b0000000-0000-4000-8000-000000000001',
  nome_comercial: 'Loja sintética',
  status_aprovacao: 'pendente',
  conta_ativa: false,
};

describe('updateVendedor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: [vendedor], error: null });
    mocks.from.mockReturnValue({ update: mocks.update });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ select: mocks.select });
  });

  it('confirma uma atualização normal pelo id devolvido antes de recarregar o perfil', async () => {
    mocks.select.mockResolvedValue({ data: [{ id: vendedor.id }], error: null });

    await expect(updateVendedor(vendedor.id, { descricao: 'Atualizada' })).resolves.toMatchObject({
      id: vendedor.id,
    });

    expect(mocks.select).toHaveBeenCalledWith('id');
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it('recusa uma atualização que não afetou nenhuma linha e não recarrega o perfil', async () => {
    mocks.select.mockResolvedValue({ data: [], error: null });

    await expect(updateVendedor(vendedor.id, { descricao: 'Atualizada' })).rejects.toThrow(
      'Não foi possível confirmar a atualização do perfil.',
    );

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
});
