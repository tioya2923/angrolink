import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20261012010000_criar_destaques_editoriais_produtos.sql',
  'utf8',
);
const resumoAdmin = readFileSync('src/paginas/dashboard/admin/AdminResumo.tsx', 'utf8');
const detalheVendedorAdmin = readFileSync('src/paginas/dashboard/admin/AdminVendedorDetalhe.tsx', 'utf8');
const resumoVendedor = readFileSync('src/paginas/dashboard/vendedor/VendedorResumo.tsx', 'utf8');
const paginaProduto = readFileSync('src/paginas/PaginaProduto.tsx', 'utf8');
const paginaVendedor = readFileSync('src/paginas/PaginaVendedor.tsx', 'utf8');

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/services/supabase', () => ({ supabase: { rpc: mocks.rpc } }));

import {
  criarDestaqueProdutoEditorialAdmin,
  listarDestaquesProdutosEditoriaisAdmin,
  obterEstadoDestaqueEditorial,
  revogarDestaqueProdutoEditorialAdmin,
} from '@/services/destaquesEditoriais';
import { listarDestaquesProdutosEditoriaisPublicos } from '@/services/catalogoPublicoProdutos';

const produtoId = '10000000-0000-4000-8000-000000000001';
const destaqueId = '20000000-0000-4000-8000-000000000001';
const resposta = {
  id: destaqueId,
  produto_id: produtoId,
  posicao: 1,
  inicio_em: '2026-10-12T10:00:00.000Z',
  fim_em: '2026-10-19T10:00:00.000Z',
  revogado_em: null,
};

describe('destaques editoriais de produtos', () => {
  beforeEach(() => mocks.rpc.mockReset());

  it('define o contrato exclusivo de Admin, duração, posições e histórico privado', () => {
    expect(migration).toContain('create table public.destaques_produtos_editoriais');
    expect(migration).toContain("check (fim_em = inicio_em + interval '7 days')");
    expect(migration).toContain('posicao between 1 and 8');
    expect(migration).toContain('destaques_produtos_editoriais_vendedor_sem_sobreposicao');
    expect(migration).toContain('destaques_produtos_editoriais_posicao_sem_sobreposicao');
    expect(migration).toContain('create table public.eventos_destaques_produtos_editoriais');
    expect(migration).toContain('revoke all on table public.destaques_produtos_editoriais, public.eventos_destaques_produtos_editoriais from anon, authenticated');
    expect(migration).toContain('listar_eventos_destaque_produto_editorial_admin');
    expect(migration).toContain('revogado_em is not null and revogado_por is not null');
  });

  it('reutiliza os gates públicos, posição automática e não importa flags legados', () => {
    expect(migration).toContain('public.is_vendedor_publico_aprovado(v_produto.vendedor_id)');
    expect(migration).toContain('public.produto_eh_operacional_fase1(');
    expect(migration).toContain("generate_series(1, 8)");
    expect(migration).toContain("hashtextextended('destaques-produtos-editoriais', 0)");
    expect(migration).toContain("'destaque', (d.id is not null)");
    expect(migration).toContain('and d.inicio_em <= now()');
    expect(migration).toContain('and d.fim_em > now()');
    expect(migration).not.toContain('insert into public.destaques_produtos_editoriais select');
  });

  it('bloqueia auto-destaque e atualização direta dos flags legados sem tocar em serviços', () => {
    expect(migration).toContain('revoke all on function public.destacar_produto_gratis(uuid), public.remover_destaque_produto(uuid) from public, anon, authenticated');
    expect(migration).toContain('create trigger proteger_flags_legados_destaque_produto');
    expect(migration).toContain('security invoker');
    expect(migration).toContain("current_user in ('anon', 'authenticated')");
    expect(migration).toContain('expiração compartilhada com serviços');
    expect(migration).not.toContain('remover_destaque_servico');
    expect(migration).not.toContain('destacar_servico_gratis');
  });

  it('envia os parâmetros corretos às RPCs administrativas e normaliza a resposta', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: resposta, error: null })
      .mockResolvedValueOnce({ data: { ...resposta, revogado_em: '2026-10-12T11:00:00.000Z' }, error: null })
      .mockResolvedValueOnce({ data: [resposta], error: null });

    await expect(criarDestaqueProdutoEditorialAdmin(produtoId)).resolves.toMatchObject({ id: destaqueId, produtoId, posicao: 1 });
    await expect(revogarDestaqueProdutoEditorialAdmin(destaqueId, ' revisão interna ')).resolves.toMatchObject({ id: destaqueId });
    await expect(listarDestaquesProdutosEditoriaisAdmin()).resolves.toHaveLength(1);

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'criar_destaque_produto_editorial_admin', { p_produto_id: produtoId });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'revogar_destaque_produto_editorial_admin', { p_destaque_id: destaqueId, p_motivo_interno: 'revisão interna' });
    expect(mocks.rpc).toHaveBeenNthCalledWith(3, 'listar_destaques_produtos_editoriais_admin');
  });

  it('limita a consulta pública a oito posições e não expõe metadados internos', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ id: produtoId, destaque: true }], error: null });
    await expect(listarDestaquesProdutosEditoriaisPublicos(99)).resolves.toEqual([{ id: produtoId, destaque: true }]);
    expect(mocks.rpc).toHaveBeenCalledWith('listar_destaques_produtos_editoriais_publicos', { p_limite: 8 });
  });

  it('distingue estados administrativos de destaque', () => {
    const destaqueNormalizado = {
      id: destaqueId,
      produtoId,
      posicao: 1,
      inicioEm: '2026-10-12T10:00:00.000Z',
      fimEm: '2026-10-19T10:00:00.000Z',
      revogadoEm: null,
    };
    expect(obterEstadoDestaqueEditorial(destaqueNormalizado, Date.parse('2026-10-12T10:30:00.000Z'))).toBe('ativo');
    expect(obterEstadoDestaqueEditorial(destaqueNormalizado, Date.parse('2026-10-20T10:30:00.000Z'))).toBe('expirado');
    expect(obterEstadoDestaqueEditorial(
      { ...destaqueNormalizado, revogadoEm: '2026-10-12T11:00:00.000Z' },
      Date.parse('2026-10-12T10:30:00.000Z'),
    )).toBe('revogado');
  });

  it('não apresenta o flag legado de produto como destaque editorial nos painéis internos', () => {
    expect(resumoAdmin).not.toContain('produtos.filter(p => p.destaque)');
    expect(detalheVendedorAdmin).not.toContain("p.destaque?'Destaque':'Normal'");
    expect(resumoVendedor).not.toContain('produtos.filter(p => p.destaque)');
  });

  it('reconsulta produto e loja pela mesma atualização pública do catálogo', () => {
    expect(paginaProduto).toContain('useAtualizacaoCatalogoPublico');
    expect(paginaProduto).toContain('revisaoCatalogo');
    expect(paginaVendedor).toContain('useAtualizacaoCatalogoPublico(produtos)');
    expect(paginaVendedor).toContain('revisaoCatalogo');
  });
});
