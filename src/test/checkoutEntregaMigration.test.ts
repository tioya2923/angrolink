import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260822200000_criar_checkout_entrega_v1.sql'),
  'utf8',
);

describe('checkout de entrega V1', () => {
  it('cria a encomenda de entrega diretamente, sem reutilizar levantamento', () => {
    expect(migration).toContain('create or replace function public.criar_encomenda_entrega');
    expect(migration).not.toContain('criar_encomenda_levantamento(');
    expect(migration).not.toMatch(/update\s+public\.encomendas[\s\S]*modalidade_recebimento/i);
    expect(migration).toMatch(/v_vendedor_id, 'entrega', 'AOA'/i);
  });

  it('mantém os limites transacionais da encomenda original', () => {
    for (const invariante of [
      'for share of p, v',
      'Uma encomenda só pode conter produtos do mesmo vendedor.',
      'Não repita o mesmo produto na encomenda.',
      'quantidade mínima de retalho',
      'v_quantidade < v_minimo_grosso',
      "in ('unidade', 'animal', 'saco', 'caixa')",
      "v_tipo_preco := 'promocional'",
      "v_tipo_preco := 'grosso'",
      'valor_unitario_centimos',
      'subtotal_centimos',
      'imagem_principal_snapshot',
    ]) {
      expect(migration).toContain(invariante);
    }
  });

  it('valida território e grava destino separado da origem comercial', () => {
    expect(migration).toContain('public.territorio_angola_valido(p_provincia,p_municipio)');
    expect(migration).toContain('insert into public.enderecos_entrega_encomenda');
    expect(migration).toContain("(v_itens_preparados -> 0 ->> 'provincia')");
    expect(migration).toContain('btrim(p_provincia)');
    expect(migration).toContain('btrim(p_endereco_detalhado)');
  });

  it('cria o pagamento pendente na mesma operação, sem atribuição automática', () => {
    expect(migration).toContain("'pagamento_na_entrega'");
    expect(migration).toContain('criar_pagamento_encomenda');
    expect(migration).toContain('criar_tentativa_pagamento');
    expect(migration).toContain("'encomenda_criada'");
    expect(migration).not.toContain('atribuicoes_entrega');
    expect(migration).not.toContain('entregador_atribuido');
    expect(migration).not.toContain('levantamento_confirmado');
  });
});
