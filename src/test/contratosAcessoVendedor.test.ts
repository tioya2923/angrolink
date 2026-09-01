import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const api = readFileSync('src/services/api.ts', 'utf8');
const perfil = readFileSync('src/paginas/dashboard/vendedor/VendedorPerfil.tsx', 'utf8');
const perfilPublico = readFileSync('src/componentes/PerfilVendedorHero.tsx', 'utf8');
const seloPublico = readFileSync('src/componentes/SeloVendedor.tsx', 'utf8');
const auth = readFileSync('src/contextos/AuthContexto.tsx', 'utf8');
const contratos = readFileSync('src/services/vendedores.ts', 'utf8');
const verificacoesConta = readFileSync('src/lib/verificacoesConta.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260830020000_endurecer_rls_legado_clientes_vendedores_storage_produtos.sql', 'utf8');
const migrationCatalogo = readFileSync('supabase/migrations/20260901010000_criar_contrato_publico_vendedores_catalogo.sql', 'utf8');

const corpo = (nome: string) => {
  const inicio = api.indexOf(`function ${nome}`);
  expect(inicio).not.toBe(-1);
  const fim = api.indexOf('\nexport ', inicio + 1);
  return api.slice(inicio, fim === -1 ? undefined : fim);
};

describe('contratos de acesso de vendedor', () => {
  it('keeps the public contract free of private fields', () => {
    const publico = contratos.slice(contratos.indexOf('COLUNAS_VENDEDOR_PUBLICAS'), contratos.indexOf('COLUNAS_VENDEDOR_PROPRIO'));
    for (const campo of ['user_id', 'nome_responsavel', 'email', 'email_login', 'documentos', 'indicativo_telefone', 'telefone_nacional', 'aprovado_por', 'motivo_rejeicao']) expect(publico).not.toContain(`'${campo}'`);
  });

  it('includes every public profile field consumed by the UI', () => {
    const publico = contratos.slice(contratos.indexOf('COLUNAS_VENDEDOR_PUBLICAS'), contratos.indexOf('COLUNAS_VENDEDOR_PROPRIO'));
    const camposObrigatorios = ['id', 'nome_comercial', 'descricao', 'telefone_whatsapp', 'whatsapp', 'provincia', 'municipio', 'tipo_vendedor', 'verificado', 'foto_perfil', 'criado_em'];
    for (const campo of camposObrigatorios) expect(publico).toContain(`'${campo}'`);

    expect(perfilPublico).toContain('vendedor.criado_em');
    expect(perfilPublico).not.toContain('vendedor.plano');
    expect(seloPublico).not.toContain('vendedor.plano');
    expect(seloPublico).not.toContain('vendedor.pode_destacar');
    expect(migration).toMatch(/grant select \([^;]*criado_em[^;]*\) on public\.vendedores to anon, authenticated;/);
  });

  it('composes every public catalog flow through the public boundary', () => {
    const fluxosPublicos = ['fetchProdutos', 'fetchProdutoPorId', 'fetchProdutosRelacionados', 'fetchProdutosPorVendedor', 'fetchServicos', 'fetchServicosPorVendedor', 'fetchServicoPorId'];
    for (const nome of fluxosPublicos) {
      const funcao = corpo(nome);
      expect(funcao).toContain('associarVendedoresPublicos');
      expect(funcao).not.toMatch(/vendedor\s*:\s*vendedores|vendedores!inner/);
      expect(funcao).not.toContain(".from(\"vendedores\")");
    }
    expect(corpo('fetchVendedorPorId')).toContain('listarVendedoresPublicos');
    expect(corpo('fetchVendedorPorId')).not.toContain(".from(\"vendedores\")");
  });

  it('defines a narrow public RPC for approved active vendors', () => {
    expect(migrationCatalogo).toContain('create or replace function public.listar_vendedores_publicos');
    expect(migrationCatalogo).toContain('p_vendedor_ids uuid[] default null');
    expect(migrationCatalogo).toContain('security definer');
    expect(migrationCatalogo).toContain('set search_path = public');
    expect(migrationCatalogo).toContain("v.status_aprovacao = 'aprovado'");
    expect(migrationCatalogo).toContain('coalesce(v.conta_ativa, false) = true');
    expect(migrationCatalogo).toContain('revoke all on function public.listar_vendedores_publicos(uuid[]) from public, anon, authenticated;');
    expect(migrationCatalogo).toContain('grant execute on function public.listar_vendedores_publicos(uuid[]) to anon, authenticated;');
    const retorno = migrationCatalogo.slice(migrationCatalogo.indexOf('returns table('), migrationCatalogo.indexOf('language sql'));
    for (const campoPrivado of ['user_id', 'nome_responsavel', 'email', 'email_login', 'plano', 'status_aprovacao', 'conta_ativa']) expect(retorno).not.toMatch(new RegExp(`\\b${campoPrivado}\\b`));
    expect(retorno).toContain('criado_em timestamp without time zone');
  });

  it('keeps hardening without table-wide vendor SELECT', () => {
    expect(migration).not.toMatch(/grant select on public\.vendedores to (anon|authenticated)/i);
  });

  it('uses narrow RPCs for the own vendor and Admin', () => {
    expect(corpo('fetchMeuVendedor')).toContain("supabase.rpc('obter_meu_vendedor')");
    expect(corpo('fetchVendedoresAdmin')).toContain("supabase.rpc('listar_vendedores_admin')");
    expect(perfil).toContain('fetchMeuVendedor');
    expect(perfil).not.toContain('fetchVendedorPorId');
    expect(auth).toContain('fetchMeuVendedor');
    expect(auth).not.toContain(".from('vendedores')");
  });

  it('composes administrative products through the safe Admin path', () => {
    for (const nome of ['fetchProdutosAdmin', 'updateProdutoAdmin', 'fetchRankingProdutosMaisClicados']) {
      const funcao = corpo(nome);
      expect(funcao).toContain('fetchVendedoresAdmin');
      expect(funcao).not.toContain('vendedor:vendedores');
    }
    expect(corpo('fetchProdutosAdmin')).toContain('vendedoresPorId.get(produto.vendedor_id)');
    expect(corpo('updateProdutoAdmin')).toContain('item.id === data.vendedor_id');
    expect(api).not.toMatch(/vendedor\s*:\s*vendedores(?:!inner)?\s*\(\$\{COLUNAS_VENDEDOR_ADMIN\}\)/);
  });

  it('checks registration duplicates by RPC without private direct SELECT', () => {
    expect(verificacoesConta).toContain("'verificar_disponibilidade_cadastro'");
    expect(verificacoesConta).not.toContain(".from('vendedores')");
    expect(verificacoesConta).not.toContain(".from('clientes')");
    expect(verificacoesConta).not.toContain(".from('parceiros_entrega')");
    const inicio = migration.indexOf('create or replace function public.verificar_disponibilidade_cadastro');
    const fim = migration.indexOf('revoke all on function public.verificar_disponibilidade_cadastro', inicio);
    const rpc = migration.slice(inicio, fim);
    expect(rpc).toContain('returns table(telefone_existe boolean,email_existe boolean)');
    expect(rpc).toContain('security definer set search_path=public');
    expect(migration).toContain('revoke all on function public.verificar_disponibilidade_cadastro(text,text) from public,anon,authenticated; grant execute on function public.verificar_disponibilidade_cadastro(text,text) to anon,authenticated;');
  });

  it('composes the administrative ranking without private vendor reads', () => {
    const ranking = corpo('fetchRankingVendedoresMaisAtivos');
    expect(ranking).toContain('fetchVendedoresAdmin()');
    expect(ranking).not.toContain(".from('vendedores')");
    expect(ranking).not.toContain('status_aprovacao');
    expect(ranking).not.toContain('plano');
  });

  it('does not retain unused direct highlight mutation', () => {
    expect(api).not.toContain('function atualizarPermissaoDestaqueVendedor');
  });

  it('uses narrow RPCs for received contacts', () => {
    expect(corpo('fetchHistoricoContactosVendedor')).toContain("supabase.rpc('listar_contactos_produtos_vendedor')");
    expect(corpo('fetchHistoricoContactosServicosVendedor')).toContain("supabase.rpc('listar_contactos_servicos_vendedor')");
  });

  it('does not retain consumers of the legacy constant', () => {
    expect(api).not.toContain('COLUNAS_VENDEDOR_SEM_DOCUMENTOS');
    expect(auth).not.toContain('COLUNAS_VENDEDOR_SEM_DOCUMENTOS');
    expect(contratos).not.toContain('COLUNAS_VENDEDOR_SEM_DOCUMENTOS');
    const proprio = contratos.slice(contratos.indexOf('COLUNAS_VENDEDOR_PROPRIO'), contratos.indexOf('COLUNAS_VENDEDOR_ADMIN'));
    for (const campo of ['email_login', 'aprovado_por', 'proximo_destaque_produto_em', 'proximo_destaque_servico_em']) expect(proprio).not.toContain(`'${campo}'`);
  });
});
