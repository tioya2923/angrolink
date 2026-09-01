import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('@/services/supabase', () => ({ supabase: { rpc: mocks.rpc } }));

import { aceitarTarefaEntrega, mensagemApresentavelTarefa, mensagemErroTarefa } from '@/services/tarefasEntregador';

describe('sanitização dos erros de tarefas do entregador', () => {
  it('preserva apenas erro de domínio P0001 controlado pelo servidor', () => {
    expect(mensagemErroTarefa({ code: 'P0001', message: 'Esta tarefa já não está disponível para aceite.' }, 'aceitar')).toBe('Esta tarefa já não está disponível para aceite.');
  });

  it('oculta PGRST202, schema cache, RPC e detalhes técnicos', () => {
    const tecnico = { code: 'PGRST202', message: "Could not find the function public.confirmar_chegada_origem_entregador in the schema cache", details: 'p_atribuicao_id uuid', hint: 'Reload schema cache' };
    const mensagem = mensagemErroTarefa(tecnico, 'chegada');
    expect(mensagem).toBe('Não foi possível confirmar a chegada. Tenta novamente.');
    for (const proibido of ['PGRST202', 'confirmar_chegada_origem_entregador', 'schema cache', 'p_atribuicao_id']) expect(mensagem).not.toContain(proibido);
  });

  it('não confia num P0001 técnico ou fora do contrato da operação', () => {
    const mensagem = mensagemErroTarefa({ code: 'P0001', message: 'relation public.interna não existe' }, 'chegada');
    expect(mensagem).toBe('Não foi possível confirmar a chegada. Tenta novamente.');
    expect(mensagem).not.toContain('relation');
  });

  it('não permite que um erro arbitrário mostre texto técnico no componente', () => {
    expect(mensagemApresentavelTarefa(new Error('stack interno'), 'aceitar')).toBe('Não foi possível aceitar a tarefa. Tenta novamente.');
  });

  it('preserva o erro seguro apenas na operação que o serviço classificou', async () => {
    mocks.rpc.mockResolvedValue({ error: { code: 'P0001', message: 'Esta tarefa já não está disponível para aceite.' } });
    let erro: unknown;
    try { await aceitarTarefaEntrega('atribuicao-teste'); } catch (causa) { erro = causa; }
    expect(mensagemApresentavelTarefa(erro, 'aceitar')).toBe('Esta tarefa já não está disponível para aceite.');
    expect(mensagemApresentavelTarefa(erro, 'chegada')).toBe('Não foi possível confirmar a chegada. Tenta novamente.');
  });

  beforeEach(() => { mocks.rpc.mockReset(); });
});
