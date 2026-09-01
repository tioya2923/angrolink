import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ler = (caminho: string) => readFileSync(resolve(process.cwd(), caminho), 'utf8');
const pagina = ler('src/paginas/dashboard/admin/AdminEntregadorDetalhe.tsx');
const servico = ler('src/services/adminEntregador360.ts');
const media = ler('src/services/adminMediaPrivada.ts');
const migration = ler('supabase/migrations/20260814203000_expandir_historico_documental_entregador_admin.sql');

describe('Histórico documental versionado do Entregador 360', () => {
  it('usa a RPC paginada apenas ao abrir a tab', () => {
    expect(servico).toContain('listarHistoricoDocumentalEntregadorAdmin');
    expect(pagina).toContain('if (a === "historico")');
    expect(pagina).toContain('mudar={(o) => void carregarTab("historico", o)}');
  });
  it('destaca a versão atual pela autoridade do servidor e preserva versões anteriores', () => {
    expect(pagina).toContain('versao.versaoId === documento.versaoAtualId');
    expect(pagina).toContain('Versão atual');
    expect(pagina).toContain('documento.versoes.map');
  });
  it('mostra metadados seguros, veículos e eventos reais', () => {
    for (const valor of ['veiculo_matricula', 'numero_documento', 'validade', 'substituido_em', 'eventos']) expect(migration).toContain(valor);
    expect(pagina).toContain('Linha do tempo');
    expect(migration).toContain("'frente_disponivel'");
    expect(migration).toContain("'verso_disponivel'");
  });
  it('não devolve paths privados na projeção administrativa', () => {
    expect(migration).not.toMatch(/'(frente_path|verso_path)'\s*,/i);
    expect(pagina).not.toContain('frente_path');
    expect(pagina).not.toContain('verso_path');
  });
  it('mantém cada FROM dentro da respetiva subquery agregada', () => {
    expect(migration).toMatch(/'versoes',\s*coalesce\(\s*\(\s*select jsonb_agg\(jsonb_build_object\([\s\S]*?\) order by v\.numero_versao desc\)\s*from public\.versoes_documento_parceiro_entrega v\s*where v\.documento_id = p\.documento_id\s*\),\s*'\[\]'::jsonb/s);
    expect(migration).toMatch(/'eventos',\s*coalesce\(\s*\(\s*select jsonb_agg\(jsonb_build_object\([\s\S]*?\) order by e\.criado_em, e\.id\)\s*from public\.eventos_documento_parceiro_entrega e\s*where e\.documento_id = p\.documento_id\s*\),\s*'\[\]'::jsonb/s);
    expect(migration).toMatch(/'itens',\s*coalesce\(\s*\(\s*select jsonb_agg\([\s\S]*?from pagina p\s*\),\s*'\[\]'::jsonb/s);
  });
  it('gera media privada apenas no clique e sem persistir URLs', () => {
    expect(pagina).toContain('obterDocumentoEntregadorAdmin(versaoId, recurso)');
    expect(pagina).toContain('abrirDocumentoPrivado');
    expect(media).toContain("recurso: RecursoDocumento");
    expect(media).not.toContain('cache.set(versaoId');
  });
  it('usa botões de paginação realmente desativados', () => {
    expect(pagina).toContain('disabled={!estado.podeAnterior}');
    expect(pagina).toContain('disabled={!estado.podeProxima}');
    expect(pagina).toContain('disabled:cursor-not-allowed');
  });
});
