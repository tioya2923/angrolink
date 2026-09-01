import { describe, expect, it } from 'vitest';
import { calcularEstadoPaginacao } from '@/lib/paginacao';

describe('Paginação administrativa', () => {
  it('calcula corretamente três páginas de quatro itens', () => {
    expect(calcularEstadoPaginacao(0, 4, 12, 4)).toEqual({ inicio: 1, fim: 4, podeAnterior: false, podeProxima: true });
    expect(calcularEstadoPaginacao(4, 4, 12, 4)).toEqual({ inicio: 5, fim: 8, podeAnterior: true, podeProxima: true });
    expect(calcularEstadoPaginacao(8, 4, 12, 4)).toEqual({ inicio: 9, fim: 12, podeAnterior: true, podeProxima: false });
  });

  it('desativa ambos os sentidos quando há uma única página', () => {
    expect(calcularEstadoPaginacao(0, 20, 4, 4)).toEqual({ inicio: 1, fim: 4, podeAnterior: false, podeProxima: false });
  });
});
