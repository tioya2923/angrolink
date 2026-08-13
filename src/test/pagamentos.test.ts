import { describe, expect, it } from 'vitest';
import { calcularDivisaoFinanceira } from '@/dominio/pagamentos';

describe('fundação financeira', () => {
  it('calcula a comissão com valores inteiros e preserva a soma financeira', () => {
    const divisao = calcularDivisaoFinanceira({
      subtotalCentimos: 10_000,
      descontoCentimos: 1_000,
      entregaCentimos: 500,
      taxaProcessadorCentimos: 100,
      comissaoBps: 1_000,
    });

    expect(divisao.comissaoAngrolinkCentimos).toBe(900);
    expect(divisao.valorVendedorCentimos).toBe(8_100);
    expect(divisao.valorLogisticaCentimos).toBe(500);
    expect(divisao.totalClienteCentimos).toBe(9_600);
    expect(
      divisao.valorVendedorCentimos
      + divisao.comissaoAngrolinkCentimos
      + divisao.valorLogisticaCentimos
      + divisao.taxaProcessadorCentimos,
    ).toBe(divisao.totalClienteCentimos);
  });

  it('arredonda pontos-base sem introduzir valores fracionários', () => {
    const divisao = calcularDivisaoFinanceira({ subtotalCentimos: 101, comissaoBps: 50 });
    expect(divisao.comissaoAngrolinkCentimos).toBe(1);
    expect(Number.isInteger(divisao.comissaoAngrolinkCentimos)).toBe(true);
  });

  it('mantém o valor de repasse futuro separado da logística e da comissão', () => {
    const divisao = calcularDivisaoFinanceira({
      subtotalCentimos: 5_000,
      entregaCentimos: 1_200,
      comissaoBps: 2_000,
    });

    expect(divisao.valorVendedorCentimos).toBe(4_000);
    expect(divisao.valorLogisticaCentimos).toBe(1_200);
    expect(divisao.comissaoAngrolinkCentimos).toBe(1_000);
  });

  it('rejeita valores financeiros negativos, fracionários e descontos inválidos', () => {
    expect(() => calcularDivisaoFinanceira({ subtotalCentimos: -1, comissaoBps: 0 })).toThrow('inteiro não negativo');
    expect(() => calcularDivisaoFinanceira({ subtotalCentimos: 10.5, comissaoBps: 0 })).toThrow('inteiro não negativo');
    expect(() => calcularDivisaoFinanceira({ subtotalCentimos: 100, descontoCentimos: 101, comissaoBps: 0 })).toThrow('desconto');
  });
});
