import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  erroUnidadeProdutoComReservas,
  mensagemErroInventario,
  quantidadeDecimalPositiva,
  validarQuantidadeInventario,
} from '@/services/inventarioProduto';

describe('gestão de inventário do vendedor', () => {
  it('preserva precisamente quantidades numeric(18,3) como texto canónico', () => {
    expect(validarQuantidadeInventario('0')).toBe('0');
    expect(validarQuantidadeInventario('0.001')).toBe('0.001');
    expect(validarQuantidadeInventario('1.125')).toBe('1.125');
    expect(validarQuantidadeInventario('10,500')).toBe('10.500');
    expect(validarQuantidadeInventario('999999999999999.999')).toBe('999999999999999.999');
  });

  it('rejeita quantidades negativas, imprecisas ou inválidas antes da RPC', () => {
    expect(validarQuantidadeInventario('-1')).toBeNull();
    expect(validarQuantidadeInventario('1.1234')).toBeNull();
    expect(validarQuantidadeInventario('1000000000000000')).toBeNull();
    expect(validarQuantidadeInventario('NaN')).toBeNull();
    expect(validarQuantidadeInventario('dez')).toBeNull();
  });

  it('identifica reservas positivas sem converter o decimal para number', () => {
    expect(quantidadeDecimalPositiva('0')).toBe(false);
    expect(quantidadeDecimalPositiva('0.000')).toBe(false);
    expect(quantidadeDecimalPositiva('0.001')).toBe(true);
  });

  it('apresenta mensagens comerciais para reservas e não expõe detalhes SQL', () => {
    expect(mensagemErroInventario(new Error('A quantidade física não pode ser inferior às reservas ativas.')))
      .toBe('A quantidade física não pode ser inferior à quantidade atualmente reservada.');
    expect(mensagemErroInventario(new Error('Não é possível desativar o controlo de stock enquanto existirem reservas ativas.')))
      .toBe('Não é possível desativar o controlo de stock enquanto existirem quantidades reservadas.');
    expect(mensagemErroInventario(new Error('relation inventarios_produto violates constraint xyz')))
      .toBe('Não foi possível atualizar o inventário agora. Tente novamente.');
  });

  it('trata sessão e produto sem permissão por mensagens seguras', () => {
    expect(mensagemErroInventario(new Error('Sessão inválida.')))
      .toBe('A sua sessão expirou. Inicie sessão novamente para gerir o inventário.');
    expect(mensagemErroInventario(new Error('Produto não encontrado ou sem permissão.')))
      .toBe('Não foi possível aceder ao inventário deste produto.');
  });

  it('reconhece apenas a mensagem controlada para bloqueio da unidade', () => {
    expect(erroUnidadeProdutoComReservas(new Error('Não é possível alterar a unidade enquanto existirem quantidades reservadas.'))).toBe(true);
    expect(erroUnidadeProdutoComReservas(new Error('relation produtos constraint unidade'))).toBe(false);
  });

  it('mantém o formulário na camada de interface, sem consultar tabelas sensíveis', () => {
    const componente = readFileSync(
      resolve(process.cwd(), 'src/paginas/dashboard/vendedor/VendedorAdicionarProduto.tsx'),
      'utf8',
    );

    expect(componente).toContain("from '@/services/inventarioProduto'");
    expect(componente).not.toContain('reservas_stock_encomenda');
    expect(componente).not.toContain('inventarios_produto');
    expect(componente).not.toContain('supabase.rpc');
  });
});
