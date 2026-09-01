import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ler = (caminho: string) => readFileSync(join(process.cwd(), caminho), 'utf8');

describe('Diretório Global de Utilizadores V1', () => {
  const migration = ler('supabase/migrations/20260814150000_criar_diretorio_global_utilizadores.sql');
  const pagina = ler('src/paginas/dashboard/admin/AdminUtilizadores.tsx');
  const api = ler('src/services/api.ts');
  const servico = ler('src/services/adminUtilizadores.ts');

  it('define uma RPC administrativa paginada, deduplicada e com múltiplos papéis', () => {
    expect(migration).toContain('create or replace function public.listar_utilizadores_admin');
    expect(migration).toContain('security definer');
    expect(migration).toContain('public.eh_admin()');
    expect(migration).toContain('array_remove(array[');
    expect(migration).toContain('returns jsonb');
    expect(migration).toContain("'estados_papeis', base_estados_papeis");
    expect(migration).toContain('jsonb_each_text(base_estados_papeis)');
    expect(migration).toContain('total_filtrado');
    expect(migration).toContain("'itens', i.dados");
    expect(migration).toContain("'paginacao', jsonb_build_object");
    expect(migration).toContain("'contagens', jsonb_build_object");
    expect(migration).toContain("coalesce(jsonb_agg(jsonb_build_object(");
    expect(migration).toContain('limit v_limite offset v_offset');
    expect(migration).toContain('p_papel = any(base_papeis)');
  });

  it('não concede a RPC a anon/public nem devolve campos documentais privados', () => {
    expect(migration).toContain('from public, anon');
    expect(migration).toContain('to authenticated');
    expect(migration).not.toContain('estado_resumido');
    expect(migration).not.toContain('conta_ativa boolean');
  });

  it('remove logs de PII e a eliminação pública incompleta do diretório atual', () => {
    expect(api).not.toContain("console.log('ADMIN CLIENTES:'");
    expect(api).not.toContain("console.log('ADMIN VENDEDORES:'");
    expect(pagina).not.toContain('eliminarClienteAdmin');
    expect(pagina).not.toContain('eliminarVendedorAdmin');
    expect(pagina).not.toContain('Trash2');
    expect(pagina).not.toContain('ADMIN_FIXO');
  });

  it('integra exclusivamente a RPC tipada com filtros, paginação e estados por papel', () => {
    expect(servico).toContain("supabase.rpc('listar_utilizadores_admin'");
    expect(servico).not.toContain("from('clientes')");
    expect(servico).not.toContain("from('vendedores')");
    expect(pagina).toContain("{ valor: 'cliente'");
    expect(pagina).toContain("{ valor: 'vendedor'");
    expect(pagina).toContain("{ valor: 'parceiro_entrega'");
    expect(pagina).toContain("{ valor: 'admin'");
    expect(pagina).toContain('estadosPapeis');
    expect(pagina).toContain('paginacao.totalResultados');
    expect(pagina).toContain('Documentação pendente');
    expect(pagina).toContain('Nenhum utilizador encontrado com estes filtros.');
  });

  it('envia pesquisa e filtros para o servidor, sem filtrar localmente os itens', () => {
    expect(servico).toContain('p_pesquisa: filtros.pesquisa?.trim() || null');
    expect(servico).toContain('p_estado: filtros.estado ?? null');
    expect(servico).toContain('p_offset: Math.max(filtros.offset ?? 0, 0)');
    expect(pagina).toContain('setTimeout');
    expect(pagina).not.toContain('.filter(utilizador');
  });
});
