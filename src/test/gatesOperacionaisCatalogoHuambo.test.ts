import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20260909040000_aplicar_gates_operacionais_catalogo_huambo.sql',
  'utf8',
);
const api = readFileSync('src/services/api.ts', 'utf8');
const paginaVendedor = readFileSync('src/paginas/PaginaVendedor.tsx', 'utf8');
const recomendacoes = readFileSync('src/paginas/dashboard/cliente/ClienteRecomendacoes.tsx', 'utf8');
const contratoPublico = readFileSync('src/services/catalogoPublicoProdutos.ts', 'utf8');
const carrinho = readFileSync('src/services/carrinho.ts', 'utf8');

const corpoDaFuncao = (nome: string) => {
  const inicio = api.indexOf(`function ${nome}`);
  expect(inicio).not.toBe(-1);
  const fim = api.indexOf('\nexport ', inicio + 1);
  return api.slice(inicio, fim === -1 ? undefined : fim);
};

describe('gates operacionais autoritativos do catálogo no Huambo', () => {
  it('centraliza elegibilidade de categoria, subcategoria e território com falha fechada', () => {
    expect(migration).toContain('create or replace function public.produto_eh_operacional_fase1');
    expect(migration).toContain("h.codigo_oficial = 'HBO'");
    expect(migration).toContain("estado_operacional.estado in ('ativa', 'experimental')");
    expect(migration).toContain("public.normalizar_texto_territorial('Serviços')");
    expect(migration).toContain('p_subcategoria_id');
    expect(migration).toContain('public.obter_estado_operacional_catalogo_produto');
  });

  it('protege inserção, publicação e reativação sem bloquear edição histórica irrelevante', () => {
    expect(migration).toContain('create or replace function public.proteger_operacao_produto_fase1()');
    expect(migration).toContain('A subcategoria selecionada não pertence à categoria do produto.');
    expect(migration).toContain('A categoria Serviços não pode ser usada para produtos.');
    expect(migration).toContain('before insert or update of categoria_id, subcategoria_id, provincia, vendedor_id, publicado, disponivel');
    expect(migration).toContain("coalesce(old.disponivel, false) = false and coalesce(new.disponivel, false) = true");
  });

  it('substitui todas as policies públicas permissivas por uma única policy com gate', () => {
    expect(migration).toContain('drop policy if exists "catalogo_publico" on public.produtos;');
    expect(migration).toContain('drop policy if exists "produtos publicos apenas de vendedores aprovados" on public.produtos;');
    expect(migration).toContain('create policy "catalogo_publico"');
    expect(migration).toContain('public.is_vendedor_publico_aprovado(vendedor_id)');
    expect(migration).toContain('public.produto_eh_operacional_fase1(');
    expect(migration).not.toContain('create policy "produtos publicos apenas de vendedores aprovados"');
  });

  it('mantém idempotência e chama o gate antes de criar cada checkout novo', () => {
    expect(migration).toContain('create or replace function public.validar_itens_checkout_operacionais_fase1');
    expect(migration).toContain("perform public.validar_itens_checkout_operacionais_fase1(v_itens);");
    expect(migration).toContain("modalidade_recebimento = 'levantamento'");
    expect(migration).toContain("modalidade_recebimento = 'entrega'");
    expect(migration).toContain('if found then');
    expect(migration).toContain('Esta chave de idempotência já foi usada com dados diferentes.');
  });

  it('exige destino Huambo para entrega sem exigir residência Huambo do comprador', () => {
    expect(migration).toContain('create or replace function public.destino_entrega_eh_operacional_fase1');
    expect(migration).toContain('from public.resolver_territorio_angola(p_provincia, p_municipio) territorio');
    expect(migration).toContain("territorio.provincia_codigo = 'HBO'");
    expect(migration).toContain('O destino da entrega deve pertencer ao Huambo durante a Fase 1.');
    expect(migration).not.toContain('clientes.provincia');
  });

  it('não reabre checkout base, matching, pagamentos, chat ou stock', () => {
    for (const foraDeEscopo of ['criar_encomenda_levantamento_base_v1', 'criar_encomenda_entrega_base_v1', 'areas_cobertura_entrega', 'atribuicoes_entrega_encomenda', 'movimentos_financeiros', 'mensagens_chat', 'reservas_stock']) {
      expect(migration).not.toContain(foraDeEscopo);
    }
  });

  it('define uma projeção pública que aplica o gate mesmo para dono ou Admin', () => {
    const inicio = migration.indexOf('create or replace function public.listar_produtos_publicos_fase1');
    const fim = migration.indexOf('$$;', inicio);
    const rpc = migration.slice(inicio, fim + 3);
    expect(rpc).toContain('security definer');
    expect(rpc).toContain('set search_path = pg_catalog, public');
    expect(rpc).toContain('p.publicado = true');
    expect(rpc).toContain('p.disponivel = true');
    expect(rpc).toContain('public.is_vendedor_publico_aprovado(p.vendedor_id)');
    expect(rpc).toContain('public.produto_eh_operacional_fase1(');
    expect(rpc).not.toContain('auth.uid()');
    expect(rpc).not.toMatch(/email|email_login|plano|status_aprovacao|conta_ativa/);
    expect(migration).toContain('grant execute on function public.listar_produtos_publicos_fase1');
  });

  it('migra lista, detalhe, relacionados, loja e recomendações para o contrato público', () => {
    for (const nome of ['fetchProdutos', 'fetchProdutoPorId', 'fetchProdutosRelacionados', 'fetchProdutosPublicosPorVendedor']) {
      const funcao = corpoDaFuncao(nome);
      expect(funcao).toContain('listarProdutosPublicosFase1');
      expect(funcao).not.toMatch(/\.from\(['"]produtos['"]\)/);
    }
    expect(paginaVendedor).toContain('fetchProdutosPublicosPorVendedor');
    expect(paginaVendedor).not.toContain('fetchProdutosPorVendedor(vendedorData.id)');
    expect(recomendacoes).toContain('listarProdutosPublicosFase1');
    expect(recomendacoes).not.toMatch(/\.from\(['"]produtos['"]\)/);
    expect(corpoDaFuncao('listarFavoritosProdutos')).toContain('listarProdutosPublicosFase1');
    expect(corpoDaFuncao('fetchSugestoesPesquisa')).toContain('listarProdutosPublicosFase1');
    expect(carrinho).toContain('listarProdutosPublicosFase1');
    expect(carrinho).not.toMatch(/\.from\(['"]produtos['"]\)/);
    expect(contratoPublico).toContain("'listar_produtos_publicos_fase1'");
  });

  it('preserva a leitura privada para vendedor e o caminho administrativo', () => {
    expect(corpoDaFuncao('fetchProdutosPorVendedor')).toContain('.from("produtos")');
    expect(corpoDaFuncao('fetchProdutosAdmin')).toContain(".from('produtos')");
    expect(migration).not.toContain('drop policy if exists "produtos_gerir_proprios"');
  });
});
