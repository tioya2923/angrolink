import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20260909050000_proteger_metricas_comerciais_produtos.sql',
  'utf8',
);
const paginaProduto = readFileSync('src/paginas/PaginaProduto.tsx', 'utf8');
const cardProduto = readFileSync('src/componentes/CardProduto.tsx', 'utf8');
const cardProdutoLoja = readFileSync('src/componentes/CardProdutoLoja.tsx', 'utf8');
const dashboardVendedor = readFileSync('src/paginas/dashboard/vendedor/VendedorProdutos.tsx', 'utf8');

const corpoDaFuncao = (nome: string) => {
  const inicio = migration.indexOf(`function public.${nome}`);
  expect(inicio).not.toBe(-1);
  const fim = migration.indexOf('$$;', inicio);
  return migration.slice(inicio, fim + 3);
};

describe('métricas comerciais de produtos', () => {
  it('não conta visualização ou contacto comercial do dono nem de Admin no servidor', () => {
    const elegibilidade = corpoDaFuncao('interacao_comercial_produto_permitida');
    expect(elegibilidade).toContain('if auth.uid() is null then');
    expect(elegibilidade).toContain('if public.eh_admin() then');
    expect(elegibilidade).toContain('join public.vendedores v on v.id = p.vendedor_id');
    expect(elegibilidade).toContain('return v_dono_user_id is distinct from auth.uid();');

    for (const nome of ['incrementar_visualizacao_produto', 'incrementar_clique_whatsapp_produto']) {
      const funcao = corpoDaFuncao(nome);
      expect(funcao).toContain('if not public.interacao_comercial_produto_permitida(produto_id_param) then');
      expect(funcao).toContain('return;');
    }
  });

  it('mantém o comportamento comercial para visitante e cliente não proprietário', () => {
    const elegibilidade = corpoDaFuncao('interacao_comercial_produto_permitida');
    expect(elegibilidade).toContain('if auth.uid() is null then\n    return true;');
    expect(corpoDaFuncao('incrementar_visualizacao_produto')).toContain('set visualizacoes = coalesce(visualizacoes, 0) + 1');
    expect(corpoDaFuncao('incrementar_clique_whatsapp_produto')).toContain('set cliques_whatsapp = coalesce(cliques_whatsapp, 0) + 1');
  });

  it('fecha também as duas tabelas de apoio contra chamadas diretas', () => {
    const trigger = corpoDaFuncao('proteger_registo_interacao_comercial_produto');
    expect(trigger).toContain('new.produto_id');
    expect(trigger).toContain('return null;');
    expect(migration).toContain('before insert on public.visualizacoes_produtos');
    expect(migration).toContain('before insert on public.historico_contactos');
  });

  it('substitui o CTA público de WhatsApp pelo chat pré-compra e não altera o dashboard privado', () => {
    for (const fonte of [paginaProduto, cardProduto]) {
      expect(fonte).toContain('ChatPreCompraProduto');
      expect(fonte).not.toContain('incrementarCliqueWhatsappProduto');
    }
    expect(dashboardVendedor).toContain('fetchProdutosPorVendedor');
  });

  it('mantém os CTAs de chat dos dois cards de produto legíveis em largura móvel', () => {
    for (const fonte of [cardProduto, cardProdutoLoja]) {
      expect(fonte).toContain('ChatPreCompraProduto');
      expect(fonte).toContain('min-w-0 justify-center');
      expect(fonte).toContain('whitespace-normal');
      expect(fonte).toContain('bg-green-800');
      expect(fonte).toContain('hover:bg-green-900');
      expect(fonte).toContain('focus-visible:ring-green-700');
    }
  });

  it('não toca em checkout, território, entrega, OTP, pagamentos ou stock', () => {
    for (const foraDeEscopo of [
      'criar_encomenda_', 'territorio_angola', 'areas_cobertura_entrega',
      'confirmar_codigo_', 'pagamentos', 'reservas_stock', 'mensagens_chat',
    ]) {
      expect(migration).not.toContain(foraDeEscopo);
    }
  });
});
