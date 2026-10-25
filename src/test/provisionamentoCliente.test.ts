import { describe, expect, it } from 'vitest';
import {
  deveLerClienteProprioAposFalhaCriacao,
  textoOpcionalParaCliente,
} from '@/lib/provisionamentoCliente';

describe('provisionamento de cliente', () => {
  it('envia null para telefone ausente ou composto apenas por espaços', () => {
    expect(textoOpcionalParaCliente(undefined)).toBeNull();
    expect(textoOpcionalParaCliente('   ')).toBeNull();
  });

  it('preserva um telefone válido, removendo apenas espaços exteriores', () => {
    expect(textoOpcionalParaCliente(' 923456789 ')).toBe('923456789');
  });

  it('só recupera uma criação concorrente após uma violação de unicidade', () => {
    expect(deveLerClienteProprioAposFalhaCriacao({ code: '23505' })).toBe(true);
    expect(deveLerClienteProprioAposFalhaCriacao({ code: '23503' })).toBe(false);
    expect(deveLerClienteProprioAposFalhaCriacao(new Error('falha de rede'))).toBe(false);
  });
});
