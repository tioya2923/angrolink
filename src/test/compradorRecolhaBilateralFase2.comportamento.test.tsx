import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EncomendaDetalheConteudo } from '@/componentes/encomendas/EncomendaDetalheConteudo';
import type { DetalheEncomenda, EntregaParticipante } from '@/services/encomendas';

afterEach(cleanup);

const entregaSegura: EntregaParticipante = {
  atribuicao_id: 'atribuicao-teste',
  estado: 'nao_atribuido',
  atribuido_em: '2026-08-25T10:00:00.000Z',
  aceite_em: '2026-08-25T10:05:00.000Z',
  chegou_origem_em: '2026-08-25T10:10:00.000Z',
  recolhida_em: '2026-08-25T10:15:00.000Z',
  nome_entregador: 'Joana Entregadora',
  veiculo: {
    tipo_veiculo: 'mota',
    marca: 'Honda',
    modelo: 'CG 160',
    matricula: 'LD-00-00-AA',
    capacidade_kg: 20,
    capacidade_volume_m3: 0.2,
  },
};

function criarEncomenda(
  estadoEntrega: EntregaParticipante['estado'],
  modalidade: 'entrega' | 'levantamento' = 'entrega',
): DetalheEncomenda {
  return {
    id: 'encomenda-teste',
    codigo_publico: 'ENC-TESTE',
    estado: 'pronta_para_levantamento',
    modalidade_recebimento: modalidade,
    criado_em: '2026-08-25T09:00:00.000Z',
    subtotal_centimos: 10000,
    desconto_centimos: 0,
    entrega_centimos: 0,
    total_centimos: 10000,
    destinatario_nome: 'Cliente de teste',
    destinatario_telefone: '+244900000000',
    provincia: 'Luanda',
    municipio: 'Luanda',
    bairro: 'Mutamba',
    endereco_levantamento: 'Local de levantamento',
    observacoes_cliente: null,
    itens_encomenda: [],
    eventos_encomenda: [],
    enderecos_entrega_encomenda: null,
    entrega_participante: modalidade === 'entrega' ? { ...entregaSegura, estado: estadoEntrega } : null,
    vendedor: null,
  } as unknown as DetalheEncomenda;
}

function renderizarComprador(estado: EntregaParticipante['estado'], modalidade: 'entrega' | 'levantamento' = 'entrega') {
  return render(<EncomendaDetalheConteudo encomenda={criarEncomenda(estado, modalidade)} contexto="cliente" />);
}

describe('recolha bilateral — acompanhamento visível ao comprador', () => {
  it.each([
    ['nao_atribuido', 'A aguardar entregador'],
    ['atribuida', 'Entregador atribuído'],
    ['aceite', 'Entregador confirmado'],
    ['chegou_origem', 'Entregador chegou para recolher a encomenda'],
    ['recolhida', 'Encomenda recolhida pelo entregador'],
    ['recusada', 'A procurar outro entregador'],
    ['cancelada', 'Estamos a reorganizar a entrega'],
  ] as const)('apresenta o estado %s de forma segura', (estado, titulo) => {
    renderizarComprador(estado);
    expect(screen.getByText(titulo)).toBeInTheDocument();
  });

  it('não mostra identidade operacional antes do aceite', () => {
    renderizarComprador('atribuida');
    expect(screen.queryByText('Joana Entregadora')).not.toBeInTheDocument();
    expect(screen.queryByText('mota · Honda · CG 160')).not.toBeInTheDocument();
    expect(screen.queryByText('Matrícula: LD-00-00-AA')).not.toBeInTheDocument();
  });

  it('mostra identidade operacional segura depois do aceite', () => {
    renderizarComprador('aceite');
    expect(screen.getByText('Joana Entregadora')).toBeInTheDocument();
    expect(screen.getByText('mota · Honda · CG 160')).toBeInTheDocument();
    expect(screen.getByText('Matrícula: LD-00-00-AA')).toBeInTheDocument();
  });

  it.each([
    ['chegou_origem', 'Chegou em'],
    ['recolhida', 'Recolhida em'],
  ] as const)('mostra o marco temporal de %s quando disponível', (estado, rotulo) => {
    renderizarComprador(estado);
    expect(screen.getByText(new RegExp(`^${rotulo}`))).toBeInTheDocument();
  });

  it('não mostra acompanhamento de entrega no levantamento', () => {
    renderizarComprador('nao_atribuido', 'levantamento');
    expect(screen.queryByText('Acompanhamento da entrega')).not.toBeInTheDocument();
  });

  it('mantém a mensagem de cancelamento neutra para o comprador', () => {
    renderizarComprador('cancelada');
    expect(screen.getByText('Estamos a preparar uma nova disponibilidade de entrega quando aplicável.')).toBeInTheDocument();
    expect(screen.queryByText('Atribuição cancelada')).not.toBeInTheDocument();
  });

  it.each([
    ['chegou_origem', 'Entregador chegou para recolher a encomenda.'],
    ['recolhida', 'Recolha confirmada. A encomenda está agora com o entregador.'],
    ['cancelada', 'A entrega foi cancelada.'],
    ['concluida', 'Encomenda concluída.'],
  ] as const)('mostra o estado correto ao vendedor em %s', (estado, mensagem) => {
    render(<EncomendaDetalheConteudo encomenda={criarEncomenda(estado)} contexto="vendedor" />);
    expect(screen.getByText(mensagem)).toBeInTheDocument();
    expect(screen.queryByText('A aguardar atribuição de entregador.')).not.toBeInTheDocument();
  });
});
