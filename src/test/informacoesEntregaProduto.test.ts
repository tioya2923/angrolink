import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  normalizarAtributosLogisticosProduto,
  opcaoTriStateParaValor,
  valorParaOpcaoTriState,
} from '@/dominio/logisticaProduto';

const formularioVendedor = readFileSync(
  resolve(process.cwd(), 'src/paginas/dashboard/vendedor/VendedorAdicionarProduto.tsx'),
  'utf8',
);
const api = readFileSync(resolve(process.cwd(), 'src/services/api.ts'), 'utf8');

const entradaBase = {
  unidade: 'unidade', pesoPorUnidade: '', volumePorUnidade: '',
  refrigeracao: 'indefinido' as const, caixaCarga: 'indefinido' as const, paletes: 'indefinido' as const,
};

describe('informações para entrega do produto', () => {
  it('não envia peso por unidade para kg', () => {
    const resultado = normalizarAtributosLogisticosProduto({ ...entradaBase, unidade: 'kg', pesoPorUnidade: '2.5' });
    expect(resultado).toEqual(expect.objectContaining({ valido: true }));
    if (resultado.valido) expect(resultado.atributos.peso_por_unidade_comercial_kg).toBeNull();
  });

  it.each(['saco', 'caixa', 'unidade', 'litro', 'animal'])('aceita peso explícito por %s', (unidade) => {
    const resultado = normalizarAtributosLogisticosProduto({ ...entradaBase, unidade, pesoPorUnidade: '2,5' });
    expect(resultado).toEqual(expect.objectContaining({ valido: true }));
    if (resultado.valido) expect(resultado.atributos.peso_por_unidade_comercial_kg).toBe(2.5);
  });

  it('mantém peso e volume vazios como null e rejeita zero ou valores inválidos', () => {
    const vazio = normalizarAtributosLogisticosProduto(entradaBase);
    expect(vazio).toEqual(expect.objectContaining({ valido: true }));
    if (vazio.valido) {
      expect(vazio.atributos.peso_por_unidade_comercial_kg).toBeNull();
      expect(vazio.atributos.volume_por_unidade_comercial_m3).toBeNull();
    }
    expect(normalizarAtributosLogisticosProduto({ ...entradaBase, pesoPorUnidade: '0' })).toEqual(expect.objectContaining({ valido: false }));
    expect(normalizarAtributosLogisticosProduto({ ...entradaBase, volumePorUnidade: 'texto' })).toEqual(expect.objectContaining({ valido: false }));
  });

  it('preserva true, false e null nos três requisitos especiais', () => {
    expect(valorParaOpcaoTriState('sim')).toBe(true);
    expect(valorParaOpcaoTriState('nao')).toBe(false);
    expect(valorParaOpcaoTriState('indefinido')).toBeNull();
    expect(opcaoTriStateParaValor(true)).toBe('sim');
    expect(opcaoTriStateParaValor(false)).toBe('nao');
    expect(opcaoTriStateParaValor(null)).toBe('indefinido');
  });

  it('carrega os nulls na edição, limpa peso ao mudar para kg e envia o payload do formulário real', () => {
    expect(formularioVendedor).toContain('opcaoTriStateParaValor(produtoEditando.requer_refrigeracao)');
    expect(formularioVendedor).toContain("if (novaUnidade === 'kg') setPesoPorUnidade('');");
    expect(formularioVendedor).toContain('...atributosLogisticos.atributos');
    expect(formularioVendedor).toContain('Informações para entrega');
  });

  it('mantém os atributos opcionais no contrato tipado da API', () => {
    for (const coluna of [
      'peso_por_unidade_comercial_kg', 'volume_por_unidade_comercial_m3',
      'requer_refrigeracao', 'requer_caixa_carga', 'requer_paletes',
    ]) expect(api).toContain(coluna);
    expect(api).toContain('interface CriarProdutoParams extends Partial<AtributosLogisticosProduto>');
    expect(api).toContain('dados: ProdutoUpdate');
  });
});
