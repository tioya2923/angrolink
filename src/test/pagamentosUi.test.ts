import { describe, expect, it } from 'vitest';
import { rotuloEstadoPagamento, rotuloMetodoPagamento } from '@/dominio/pagamentos';

describe('apresentação financeira', () => {
  it('traduz os estados de pagamento numa única fonte', () => {
    expect(rotuloEstadoPagamento('pendente')).toBe('Pendente');
    expect(rotuloEstadoPagamento('a_processar')).toBe('A processar');
    expect(rotuloEstadoPagamento('confirmado')).toBe('Pago');
    expect(rotuloEstadoPagamento('reembolsado_parcialmente')).toBe('Reembolsado parcialmente');
    expect(rotuloEstadoPagamento('desconhecido')).toBe('Estado por confirmar');
  });

  it('apresenta o método de levantamento sem o confundir com confirmação', () => {
    expect(rotuloMetodoPagamento('pagamento_no_levantamento')).toBe('Pagar no levantamento');
    expect(rotuloMetodoPagamento('online')).toBe('Pagamento online');
  });
});
