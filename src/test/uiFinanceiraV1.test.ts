import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const servico = readFileSync(resolve(process.cwd(), 'src/services/pagamentos.ts'), 'utf8');
const cliente = readFileSync(resolve(process.cwd(), 'src/componentes/encomendas/PagamentoClienteEncomenda.tsx'), 'utf8');
const vendedor = readFileSync(resolve(process.cwd(), 'src/componentes/encomendas/ResumoFinanceiroVendedorEncomenda.tsx'), 'utf8');
const checkout = readFileSync(resolve(process.cwd(), 'src/paginas/PaginaCheckoutPendente.tsx'), 'utf8');

describe('UI financeira V1', () => {
  it('usa exclusivamente as projeções RPC por encomenda, sem select direto financeiro', () => {
    expect(servico).toContain("supabase.rpc('obter_pagamento_encomenda_cliente'");
    expect(servico).toContain("supabase.rpc('obter_resumo_financeiro_encomenda_vendedor'");
    expect(servico).not.toContain("from('pagamentos')");
    expect(servico).not.toContain("from('tentativas_pagamento')");
  });

  it('mostra ao cliente método, estado, total e fallback seguro sem comissão', () => {
    expect(cliente).toContain('rotuloMetodoPagamento');
    expect(cliente).toContain('rotuloEstadoPagamento');
    expect(cliente).toContain('Método ainda não disponível');
    expect(cliente).toContain('total_cliente_centimos');
    expect(cliente).not.toContain('comissao_angrolink_centimos');
  });

  it('mostra ao vendedor valores efetivos sem calcular comissão no browser', () => {
    expect(vendedor).toContain('subtotal_centimos');
    expect(vendedor).toContain('desconto_centimos');
    expect(vendedor).toContain('base_comercial_centimos');
    expect(vendedor).toContain('comissao_angrolink_centimos');
    expect(vendedor).toContain('valor_vendedor_centimos');
    expect(vendedor).not.toContain('comissao_bps');
    expect(vendedor).not.toContain('* 0.05');
  });

  it('mantém levantamento funcional e permite entrega sem pagamento online', () => {
    expect(checkout).not.toContain('criarObrigacaoPagamentoNoLevantamento');
    expect(checkout).toContain('Pagar no levantamento');
    expect(checkout).toContain('Pagar na entrega');
    expect(checkout).toContain('Custo da entrega ainda será confirmado.');
    expect(checkout).not.toContain('Pagamento online — em breve');
  });
});
