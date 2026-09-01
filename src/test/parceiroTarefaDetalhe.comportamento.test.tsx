import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useEffect } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import ParceiroTarefaDetalhe from '@/paginas/dashboard/parceiro/ParceiroTarefaDetalhe';
import type { TarefaEntregaDetalhe } from '@/services/tarefasEntregador';

const mocks = vi.hoisted(() => ({
  obter: vi.fn(),
  aceitar: vi.fn(),
  recusar: vi.fn(),
  chegada: vi.fn(),
  toast: vi.fn(),
  notificacoes: { ultimaRealtime: null as null | { contexto: string; entidade_tipo: string; entidade_id: string } },
}));

vi.mock('@/services/tarefasEntregador', async () => {
  const atual = await vi.importActual<typeof import('@/services/tarefasEntregador')>('@/services/tarefasEntregador');
  return {
    ...atual,
    obterTarefaEntregador: mocks.obter,
    aceitarTarefaEntrega: mocks.aceitar,
    recusarTarefaEntrega: mocks.recusar,
    confirmarChegadaOrigemEntregador: mocks.chegada,
  };
});

describe('ParceiroTarefaDetalhe — robustez de operações', () => {
  it('mantém o diálogo aberto e não faz refetch quando a ação falha', async () => {
    mocks.chegada.mockRejectedValue(new Error('Não foi possível confirmar a chegada. Tenta novamente.'));
    renderizar('aceite');
    await aguardarTarefa();
    fireEvent.click(screen.getByRole('button', { name: 'Cheguei ao vendedor' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title: 'Não foi possível confirmar a chegada. Tenta novamente.', variant: 'destructive' }));
    expect(screen.getByRole('heading', { name: 'Confirmar chegada ao vendedor' })).toBeInTheDocument();
    expect(mocks.obter).toHaveBeenCalledTimes(1);
  });

  it('mostra erro seguro quando o parâmetro da atribuição está ausente', async () => {
    render(<MemoryRouter initialEntries={['/']}><ParceiroTarefaDetalhe /></MemoryRouter>);
    expect(await screen.findByText('Não foi possível carregar a tarefa.')).toBeInTheDocument();
    expect(mocks.obter).not.toHaveBeenCalled();
  });

  it('recupera de um erro inicial através de retry', async () => {
    mocks.obter.mockRejectedValueOnce(new Error('Falha temporária')).mockResolvedValueOnce(criarTarefa('aceite'));
    render(arvore());
    expect(await screen.findByText('Não foi possível carregar a tarefa.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await aguardarTarefa();
    expect(mocks.obter).toHaveBeenCalledTimes(2);
  });

  it('enfileira atualização recebida durante carregamento em curso', async () => {
    let concluirPrimeiro: ((valor: TarefaEntregaDetalhe) => void) | undefined;
    const primeiro = new Promise<TarefaEntregaDetalhe>((resolve) => { concluirPrimeiro = resolve; });
    const maisRecente = criarTarefa('recolhida');
    maisRecente.encomenda.codigo_publico = 'ENC-ATUALIZADA';
    mocks.obter.mockImplementationOnce(() => primeiro).mockResolvedValueOnce(maisRecente);
    const tela = render(arvore());
    mocks.notificacoes.ultimaRealtime = { contexto: 'entrega', entidade_tipo: 'atribuicao_entrega', entidade_id: 'atribuicao-teste' };
    tela.rerender(arvore());
    concluirPrimeiro?.(criarTarefa('aceite'));
    expect(await screen.findByRole('heading', { name: 'ENC-ATUALIZADA' })).toBeInTheDocument();
    expect(mocks.obter).toHaveBeenCalledTimes(2);
  });

  it('fecha o progresso em concluída sem marco atual', async () => {
    renderizar('concluida');
    await aguardarTarefa();
    expect(screen.getAllByRole('listitem').filter((item) => item.getAttribute('aria-current') === 'step')).toHaveLength(0);
    expect(screen.getAllByLabelText(/concluído$/)).toHaveLength(3);
  });

  it('nunca apresenta a tarefa A depois de a rota mudar para B durante o carregamento', async () => {
    let concluirA: ((tarefa: TarefaEntregaDetalhe) => void) | undefined;
    let concluirB: ((tarefa: TarefaEntregaDetalhe) => void) | undefined;
    const pendenteA = new Promise<TarefaEntregaDetalhe>((resolve) => { concluirA = resolve; });
    const pendenteB = new Promise<TarefaEntregaDetalhe>((resolve) => { concluirB = resolve; });
    const tarefaA = criarTarefa('aceite'); tarefaA.encomenda.codigo_publico = 'ENC-TAREFA-A';
    const tarefaB = criarTarefa('recolhida'); tarefaB.tarefa.id = 'tarefa-b'; tarefaB.encomenda.codigo_publico = 'ENC-TAREFA-B';
    mocks.obter.mockImplementation((id: string) => id === 'tarefa-a' ? pendenteA : pendenteB);
    const tela = render(arvoreMutavel('tarefa-a'));
    await waitFor(() => expect(mocks.obter).toHaveBeenCalledWith('tarefa-a'));
    tela.rerender(arvoreMutavel('tarefa-b'));
    concluirA?.(tarefaA);
    await waitFor(() => expect(mocks.obter).toHaveBeenLastCalledWith('tarefa-b'));
    expect(screen.queryByRole('heading', { name: 'ENC-TAREFA-A' })).not.toBeInTheDocument();
    concluirB?.(tarefaB);
    expect(await screen.findByRole('heading', { name: 'ENC-TAREFA-B' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'ENC-TAREFA-A' })).not.toBeInTheDocument();
    expect(mocks.obter).toHaveBeenLastCalledWith('tarefa-b');
  });

  it('invalida a resposta pendente quando o id deixa de existir', async () => {
    let concluir: ((tarefa: TarefaEntregaDetalhe) => void) | undefined;
    mocks.obter.mockReturnValue(new Promise<TarefaEntregaDetalhe>((resolve) => { concluir = resolve; }));
    const tela = render(arvoreMutavel('tarefa-a'));
    await waitFor(() => expect(mocks.obter).toHaveBeenCalledTimes(1));
    tela.rerender(arvoreMutavel());
    concluir?.(criarTarefa('aceite'));
    expect(await screen.findByText('Não foi possível carregar a tarefa.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'ENC-2026-001' })).not.toBeInTheDocument();
  });

  it('preserva a tarefa num refresh em segundo plano que falha e recupera no seguinte', async () => {
    const atualizada = criarTarefa('recolhida'); atualizada.encomenda.codigo_publico = 'ENC-RECUPERADA';
    mocks.obter.mockResolvedValueOnce(criarTarefa('aceite')).mockRejectedValueOnce(new Error('schema interno')).mockResolvedValueOnce(atualizada);
    const tela = render(arvore());
    await aguardarTarefa();
    mocks.notificacoes.ultimaRealtime = { contexto: 'entrega', entidade_tipo: 'atribuicao_entrega', entidade_id: 'atribuicao-teste' };
    tela.rerender(arvore());
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title: 'Não foi possível atualizar a tarefa. Tenta novamente.', variant: 'destructive' }));
    expect(screen.getByRole('heading', { name: 'ENC-2026-001' })).toBeInTheDocument();
    mocks.notificacoes.ultimaRealtime = { contexto: 'entrega', entidade_tipo: 'atribuicao_entrega', entidade_id: 'atribuicao-teste' };
    tela.rerender(arvore());
    expect(await screen.findByRole('heading', { name: 'ENC-RECUPERADA' })).toBeInTheDocument();
  });

  it('mantém oculta uma mensagem técnica P0001 não marcada pelo serviço', async () => {
    const erroTecnico = Object.assign(new Error('relation public.interna não existe'), { code: 'P0001' });
    mocks.chegada.mockRejectedValue(erroTecnico);
    renderizar('aceite');
    await aguardarTarefa();
    fireEvent.click(screen.getByRole('button', { name: 'Cheguei ao vendedor' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title: 'Não foi possível confirmar a chegada. Tenta novamente.', variant: 'destructive' }));
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('relation public') }));
  });

  it('aguarda o refetch enfileirado antes de terminar a ação', async () => {
    let concluirPrimeiroRefetch: ((tarefa: TarefaEntregaDetalhe) => void) | undefined;
    const primeiroRefetch = new Promise<TarefaEntregaDetalhe>((resolve) => { concluirPrimeiroRefetch = resolve; });
    const final = criarTarefa('aceite'); final.encomenda.codigo_publico = 'ENC-REFETCH-FINAL';
    mocks.aceitar.mockResolvedValue(undefined);
    mocks.obter.mockResolvedValueOnce(criarTarefa('atribuida')).mockReturnValueOnce(primeiroRefetch).mockResolvedValueOnce(final);
    const tela = render(arvore());
    await aguardarTarefa();
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar tarefa' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.obter).toHaveBeenCalledTimes(2));
    mocks.notificacoes.ultimaRealtime = { contexto: 'entrega', entidade_tipo: 'atribuicao_entrega', entidade_id: 'atribuicao-teste' };
    tela.rerender(arvore());
    expect(screen.getByRole('button', { name: 'Aceitar tarefa' })).toBeDisabled();
    concluirPrimeiroRefetch?.(criarTarefa('aceite'));
    expect(await screen.findByRole('heading', { name: 'ENC-REFETCH-FINAL' })).toBeInTheDocument();
    expect(mocks.obter).toHaveBeenCalledTimes(3);
  });

  it('fecha o diálogo de A ao mudar para B e nunca executa a ação em B', async () => {
    const tarefaA = criarTarefa('atribuida'); tarefaA.tarefa.id = 'tarefa-a'; tarefaA.encomenda.codigo_publico = 'ENC-A';
    const tarefaB = criarTarefa('atribuida'); tarefaB.tarefa.id = 'tarefa-b'; tarefaB.encomenda.codigo_publico = 'ENC-B';
    mocks.obter.mockImplementation((id: string) => Promise.resolve(id === 'tarefa-a' ? tarefaA : tarefaB));
    const tela = render(arvoreMutavel('tarefa-a'));
    expect(await screen.findByRole('heading', { name: 'ENC-A' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar tarefa' }));
    expect(await screen.findByRole('heading', { name: 'Aceitar tarefa de entrega' })).toBeInTheDocument();
    tela.rerender(arvoreMutavel('tarefa-b'));
    expect(await screen.findByRole('heading', { name: 'ENC-B' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Aceitar tarefa de entrega' })).not.toBeInTheDocument();
    expect(mocks.aceitar).not.toHaveBeenCalled();
  });

  it('não deixa o motivo de recusa de A permanecer na tarefa B', async () => {
    const tarefaA = criarTarefa('atribuida'); tarefaA.tarefa.id = 'tarefa-a';
    const tarefaB = criarTarefa('atribuida'); tarefaB.tarefa.id = 'tarefa-b';
    mocks.obter.mockImplementation((id: string) => Promise.resolve(id === 'tarefa-a' ? tarefaA : tarefaB));
    const tela = render(arvoreMutavel('tarefa-a'));
    await screen.findByRole('heading', { name: 'ENC-2026-001' });
    fireEvent.click(screen.getByRole('button', { name: 'Recusar tarefa' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Motivo da recusa' }), { target: { value: 'Motivo exclusivo de A' } });
    tela.rerender(arvoreMutavel('tarefa-b'));
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Motivo da recusa' })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Recusar tarefa' }));
    expect((await screen.findByRole('textbox', { name: 'Motivo da recusa' }) as HTMLTextAreaElement).value).toBe('');
  });

  it('não apresenta sucesso nem altera B quando uma ação de A termina depois da mudança de rota', async () => {
    let concluirAceite: (() => void) | undefined;
    const tarefaA = criarTarefa('atribuida'); tarefaA.tarefa.id = 'tarefa-a'; tarefaA.encomenda.codigo_publico = 'ENC-A';
    const tarefaB = criarTarefa('atribuida'); tarefaB.tarefa.id = 'tarefa-b'; tarefaB.encomenda.codigo_publico = 'ENC-B';
    mocks.obter.mockImplementation((id: string) => Promise.resolve(id === 'tarefa-a' ? tarefaA : tarefaB));
    mocks.aceitar.mockReturnValue(new Promise<void>((resolve) => { concluirAceite = resolve; }));
    const tela = render(arvoreMutavel('tarefa-a'));
    await screen.findByRole('heading', { name: 'ENC-A' });
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar tarefa' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    expect(mocks.aceitar).toHaveBeenCalledWith('tarefa-a');
    tela.rerender(arvoreMutavel('tarefa-b'));
    expect(await screen.findByRole('heading', { name: 'ENC-B' })).toBeInTheDocument();
    concluirAceite?.();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aceitar tarefa' })).toBeEnabled());
    expect(mocks.toast).not.toHaveBeenCalledWith({ title: 'Tarefa aceite.' });
    expect(screen.getByRole('heading', { name: 'ENC-B' })).toBeInTheDocument();
  });
});

vi.mock('@/contextos/NotificacoesContexto', () => ({
  useNotificacoesSessao: () => mocks.notificacoes,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  mocks.notificacoes.ultimaRealtime = null;
});

function criarTarefa(estado: TarefaEntregaDetalhe['tarefa']['estado']): TarefaEntregaDetalhe {
  return {
    tarefa: {
      id: 'atribuicao-teste',
      estado,
      atribuido_em: '2026-08-25T09:00:00.000Z',
      aceite_em: '2026-08-25T09:05:00.000Z',
      chegou_origem_em: '2026-08-25T09:10:00.000Z',
      recolhida_em: '2026-08-25T09:15:00.000Z',
      recusado_em: null,
      motivo_recusa: null,
    },
    encomenda: { id: 'encomenda-teste', codigo_publico: 'ENC-2026-001', estado: 'pronta_para_levantamento', modalidade: 'entrega' },
    veiculo: { tipo: 'Mota', matricula: 'LD-12-34-AA' },
    origem: { nome_vendedor: 'Mercado Seguro', telefone: '+244900000001', endereco: 'Rua da Recolha, 42', referencia: 'Portão verde', bairro: 'Mutamba', municipio: 'Luanda', provincia: 'Luanda' },
    destino: { nome: 'Cliente Seguro', telefone: '+244900000002', endereco: 'Avenida do Destino, 88', referencia: 'Prédio azul', bairro: 'Maianga', municipio: 'Luanda', provincia: 'Luanda' },
    itens: [{ nome: 'Tomate fresco', quantidade: 4, unidade: 'kg' }, { nome: 'Cebola', quantidade: 2, unidade: 'sacos' }],
    requisitos_logisticos: { peso_total_conhecido: true, peso_total_kg: 18.5, volume_total_conhecido: true, volume_total_m3: 0.4, requer_refrigeracao: true, requer_caixa_carga: false, requer_paletes: true },
  };
}

function arvore() {
  return (
    <MemoryRouter initialEntries={['/dashboard/tarefas/atribuicao-teste']}>
      <Routes><Route path="/dashboard/tarefas/:id" element={<ParceiroTarefaDetalhe />} /></Routes>
    </MemoryRouter>
  );
}

function RotaMutavel({ id }: { id?: string }) {
  const navegar = useNavigate();
  useEffect(() => { navegar(id ? `/dashboard/tarefas/${id}` : '/dashboard/tarefas'); }, [id, navegar]);
  return <Routes><Route path="/dashboard/tarefas/:id" element={<ParceiroTarefaDetalhe />} /><Route path="/dashboard/tarefas" element={<ParceiroTarefaDetalhe />} /></Routes>;
}

function arvoreMutavel(id?: string) {
  return <MemoryRouter initialEntries={[id ? `/dashboard/tarefas/${id}` : '/dashboard/tarefas']}><RotaMutavel id={id} /></MemoryRouter>;
}

function renderizar(estado: TarefaEntregaDetalhe['tarefa']['estado'], alterar?: (tarefa: TarefaEntregaDetalhe) => void) {
  const tarefa = criarTarefa(estado);
  alterar?.(tarefa);
  mocks.obter.mockResolvedValue(tarefa);
  return render(arvore());
}

async function aguardarTarefa() {
  await screen.findByRole('heading', { name: 'ENC-2026-001' });
}

describe('ParceiroTarefaDetalhe — interface operacional', () => {
  it('traduz requisitos logísticos em informação humana, sem JSON cru', async () => {
    renderizar('aceite');
    await aguardarTarefa();
    expect(screen.getByText('18,5 kg')).toBeInTheDocument();
    expect(screen.getByText('0,4 m³')).toBeInTheDocument();
    expect(screen.getByText('Refrigeração')).toBeInTheDocument();
    expect(screen.getByText('Paletes')).toBeInTheDocument();
    expect(screen.queryByText(/peso_total_kg|requer_refrigeracao|\{"/)).not.toBeInTheDocument();
  });

  it('protege os contactos e moradas detalhadas antes do aceite', async () => {
    renderizar('atribuida');
    await aguardarTarefa();
    expect(screen.getAllByText('Dados protegidos até ao aceite')).toHaveLength(2);
    expect(screen.queryByText('Mercado Seguro')).not.toBeInTheDocument();
    expect(screen.queryByText('+244900000001')).not.toBeInTheDocument();
    expect(screen.queryByText('Rua da Recolha, 42')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Luanda/).length).toBeGreaterThan(0);
  });

  it('mostra contactos operacionais apenas depois do aceite', async () => {
    renderizar('aceite');
    await aguardarTarefa();
    expect(screen.getByText('Mercado Seguro')).toBeInTheDocument();
    expect(screen.getByText('Cliente Seguro')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+244900000001' })).toHaveAttribute('href', 'tel:+244900000001');
    expect(screen.getAllByText((_, elemento) => elemento?.textContent?.includes('Rua da Recolha, 42') ?? false).length).toBeGreaterThan(0);
  });

  it('disponibiliza a rota de recolha antes da recolha e nunca leva telefone no URL', async () => {
    renderizar('chegou_origem');
    await aguardarTarefa();
    const rota = screen.getByRole('link', { name: 'Abrir no Google Maps: Recolha' });
    expect(rota).toHaveAttribute('href', expect.stringContaining('Rua'));
    expect(rota).not.toHaveAttribute('href', expect.stringContaining('900000001'));
    expect(screen.queryByRole('link', { name: 'Abrir no Google Maps: Destino' })).not.toBeInTheDocument();
  });

  it('só disponibiliza a rota de destino depois da recolha', async () => {
    renderizar('recolhida');
    await aguardarTarefa();
    expect(screen.getByRole('link', { name: 'Abrir no Google Maps: Destino' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Abrir no Google Maps: Recolha' })).not.toBeInTheDocument();
  });

  it('abre a confirmação de chegada e chama a RPC da atribuição concreta', async () => {
    mocks.chegada.mockResolvedValue(undefined);
    renderizar('aceite');
    await aguardarTarefa();
    fireEvent.click(screen.getByRole('button', { name: 'Cheguei ao vendedor' }));
    expect(await screen.findByRole('heading', { name: 'Confirmar chegada ao vendedor' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.chegada).toHaveBeenCalledWith('atribuicao-teste'));
  });

  it('aceita a tarefa, bloqueia o clique durante o processamento e faz refetch autoritativo', async () => {
    let concluir: (() => void) | undefined;
    mocks.aceitar.mockReturnValue(new Promise<void>((resolve) => { concluir = resolve; }));
    renderizar('atribuida');
    await aguardarTarefa();
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar tarefa' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    expect(screen.getByRole('button', { name: 'A processar…' })).toBeDisabled();
    expect(mocks.aceitar).toHaveBeenCalledTimes(1);
    concluir?.();
    await waitFor(() => expect(mocks.obter).toHaveBeenCalledTimes(2));
  });

  it('exige um motivo antes de permitir recusar e envia o motivo ao serviço', async () => {
    mocks.recusar.mockResolvedValue(undefined);
    renderizar('atribuida');
    await aguardarTarefa();
    fireEvent.click(screen.getByRole('button', { name: 'Recusar tarefa' }));
    const confirmar = await screen.findByRole('button', { name: 'Confirmar recusa' });
    expect(confirmar).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Motivo da recusa' }), { target: { value: 'Veículo em manutenção' } });
    expect(confirmar).toBeEnabled();
    fireEvent.click(confirmar);
    await waitFor(() => expect(mocks.recusar).toHaveBeenCalledWith('atribuicao-teste', 'Veículo em manutenção'));
  });

  it('oculta o texto de um erro inesperado na ação', async () => {
    mocks.chegada.mockRejectedValue(new Error('relation interna não autorizada'));
    renderizar('aceite');
    await aguardarTarefa();
    fireEvent.click(screen.getByRole('button', { name: 'Cheguei ao vendedor' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ title: 'Não foi possível confirmar a chegada. Tenta novamente.', variant: 'destructive' }));
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('relation interna') }));
  });

  it('só recarrega por Realtime da atribuição concreta', async () => {
    const tela = renderizar('aceite');
    await aguardarTarefa();
    expect(mocks.obter).toHaveBeenCalledTimes(1);
    mocks.notificacoes.ultimaRealtime = { contexto: 'entrega', entidade_tipo: 'encomenda', entidade_id: 'atribuicao-teste' };
    tela.rerender(arvore());
    expect(mocks.obter).toHaveBeenCalledTimes(1);
    mocks.notificacoes.ultimaRealtime = { contexto: 'entrega', entidade_tipo: 'atribuicao_entrega', entidade_id: 'outra-atribuicao' };
    tela.rerender(arvore());
    expect(mocks.obter).toHaveBeenCalledTimes(1);
    mocks.notificacoes.ultimaRealtime = { contexto: 'entrega', entidade_tipo: 'atribuicao_entrega', entidade_id: 'atribuicao-teste' };
    tela.rerender(arvore());
    await waitFor(() => expect(mocks.obter).toHaveBeenCalledTimes(2));
  });

  it.each([['cancelada', 'Tarefa cancelada'], ['concluida', 'Entrega concluída']] as const)('trata o estado terminal %s', async (estado, titulo) => {
    renderizar(estado);
    await aguardarTarefa();
    expect(screen.getByText(titulo)).toBeInTheDocument();
  });

  it('não cria rota quando a localização não contém dados úteis', async () => {
    renderizar('aceite', (tarefa) => { tarefa.origem = { nome_vendedor: 'Mercado Seguro', telefone: '+244900000001', endereco: null, referencia: null, bairro: null, municipio: null, provincia: 'Angola' }; });
    await aguardarTarefa();
    expect(screen.getByText('Rota indisponível')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Abrir no Google Maps: Recolha' })).not.toBeInTheDocument();
  });

  it('expõe o marco atual de progresso ao leitor de ecrã', async () => {
    renderizar('chegou_origem');
    await aguardarTarefa();
    expect(screen.getByText('Chegada à origem').closest('li')).toHaveAttribute('aria-current', 'step');
  });

  it.each([
    ['chegou_origem', 'Chegada registada'],
    ['recolhida', 'Mercadorias recolhidas'],
  ] as const)('apresenta o passo operacional para %s', async (estado, titulo) => {
    renderizar(estado);
    await aguardarTarefa();
    expect(screen.getByText(titulo)).toBeInTheDocument();
  });

  it('não consulta Supabase diretamente no componente', () => {
    const componente = readFileSync(resolve(process.cwd(), 'src/paginas/dashboard/parceiro/ParceiroTarefaDetalhe.tsx'), 'utf8');
    expect(componente).not.toContain("from '@/services/supabase'");
    expect(componente).not.toContain('supabase.from');
    expect(componente).not.toContain('JSON.stringify');
  });
});
