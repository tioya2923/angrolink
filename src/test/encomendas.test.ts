import { describe, expect, it } from 'vitest';
import {
  calcularSubtotalCentimos,
  formatarCentimosAoa,
  obterMotivoEncerramentoEncomenda,
  rotuloEstadoEncomenda,
  transicaoEncomendaPermitida,
  validarItemEncomendaSolicitado,
} from '@/dominio/encomendas';
import { prepararCriacaoEncomenda } from '@/services/encomendas';

describe('domínio de encomendas', () => {
  it('formata valores inteiros em cêntimos sem usar float como fonte de verdade', () => {
    expect(formatarCentimosAoa(123456)).toContain('1 234,56');
    expect(() => formatarCentimosAoa(-1)).toThrow('inteiro não negativo');
    expect(() => formatarCentimosAoa(1.5)).toThrow('inteiro não negativo');
  });

  it('aceita apenas quantidades positivas', () => {
    expect(validarItemEncomendaSolicitado({ produto_id: 'produto-1', quantidade: 1 })).toBeNull();
    expect(validarItemEncomendaSolicitado({ produto_id: 'produto-1', quantidade: 0 })).toBe('A quantidade deve ser superior a zero.');
    expect(validarItemEncomendaSolicitado({ produto_id: '', quantidade: 1 })).toBe('Indique o produto pretendido.');
  });

  it('mantém as transições separadas por ator', () => {
    expect(transicaoEncomendaPermitida('vendedor', 'aguardando_confirmacao', 'confirmada')).toBe(true);
    expect(transicaoEncomendaPermitida('vendedor', 'aguardando_confirmacao', 'recusada')).toBe(true);
    expect(transicaoEncomendaPermitida('cliente', 'aguardando_confirmacao', 'cancelada')).toBe(true);
    expect(transicaoEncomendaPermitida('cliente', 'aguardando_confirmacao', 'confirmada')).toBe(false);
    expect(transicaoEncomendaPermitida('cliente', 'pronta_para_levantamento', 'levantada')).toBe(false);
    expect(transicaoEncomendaPermitida('cliente', 'levantada', 'concluida')).toBe(false);
    expect(transicaoEncomendaPermitida('vendedor', 'confirmada', 'concluida')).toBe(false);
  });

  it('aplica arredondamento por linha para quantidades fracionárias', () => {
    expect(calcularSubtotalCentimos(10000, 1)).toBe(10000);
    expect(calcularSubtotalCentimos(10000, 2)).toBe(20000);
    expect(calcularSubtotalCentimos(10000, 0.5)).toBe(5000);
    expect(calcularSubtotalCentimos(12345, 1.25)).toBe(15431);
  });

  it('não aceita itens repetidos no contrato do browser', () => {
    expect(() => prepararCriacaoEncomenda({
      itens: [
        { produto_id: 'produto-1', quantidade: 1 },
        { produto_id: 'produto-1', quantidade: 2 },
      ],
    })).toThrow('Não repita o mesmo produto');
  });

  it('não inclui totais ou preços enviados pelo browser', () => {
    const pedidoComValoresForjados = {
      itens: [{ produto_id: 'produto-1', quantidade: 2, preco_unitario: 1 }],
      vendedor_id: 'vendedor-forjado',
      subtotal_centimos: 1,
      desconto_centimos: 999999,
      total_centimos: 1,
      observacoesCliente: '  Separar em duas embalagens. ',
    };

    expect(prepararCriacaoEncomenda(pedidoComValoresForjados)).toEqual({
      p_itens: [{ produto_id: 'produto-1', quantidade: 2 }],
      p_modalidade: 'levantamento',
      p_nome_destinatario: null,
      p_telefone_destinatario: null,
      p_observacoes_cliente: 'Separar em duas embalagens.',
    });
  });

  it('centraliza rótulos e regras de ações por estado', () => {
    expect(rotuloEstadoEncomenda('pronta_para_levantamento')).toBe('Pronta para levantamento');
    expect(rotuloEstadoEncomenda('cancelada')).toBe('Cancelada');
    expect(transicaoEncomendaPermitida('cliente', 'confirmada', 'cancelada')).toBe(false);
    expect(transicaoEncomendaPermitida('vendedor', 'em_preparacao', 'pronta_para_levantamento')).toBe(true);
    expect(transicaoEncomendaPermitida('vendedor', 'pronta_para_levantamento', 'levantada')).toBe(false);
  });

  it('expõe o motivo de encerramento apenas ao interveniente correto', () => {
    const cancelada = {
      estado: 'cancelada', motivo_cancelamento: 'Já não preciso da encomenda.', motivo_recusa: null,
      cancelado_em: '2026-08-13T12:00:00Z', recusado_em: null,
    };
    const recusada = {
      estado: 'recusada', motivo_cancelamento: null, motivo_recusa: 'Produto temporariamente sem stock.',
      cancelado_em: null, recusado_em: '2026-08-13T12:00:00Z',
    };

    expect(obterMotivoEncerramentoEncomenda('vendedor', cancelada)?.motivo).toBe('Já não preciso da encomenda.');
    expect(obterMotivoEncerramentoEncomenda('cliente', cancelada)).toBeNull();
    expect(obterMotivoEncerramentoEncomenda('cliente', recusada)?.motivo).toBe('Produto temporariamente sem stock.');
    expect(obterMotivoEncerramentoEncomenda('vendedor', recusada)).toBeNull();
  });
});
