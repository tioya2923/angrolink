import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagina = readFileSync(
  resolve(process.cwd(), 'src/paginas/PaginaAnunciar.tsx'),
  'utf8',
);
const documentos = readFileSync(
  resolve(process.cwd(), 'src/services/documentosVendedor.ts'),
  'utf8',
);

describe('onboarding documental de vendedor', () => {
  it('submete apenas os documentos obrigatórios do tipo selecionado para a tabela canónica privada', () => {
    expect(pagina).toContain("requisitosDocumentais?.obrigatorios ?? []");
    expect(pagina).toContain('submeterDocumentosVendedor(');
    expect(documentos).toContain("BUCKET_DOCUMENTOS_VENDEDORES = 'documentos-vendedores'");
    expect(documentos).toContain(".from('documentos_vendedor')");
    expect(documentos).toContain('upsert: false');
  });

  it('não trata como concluída uma candidatura sem todos os registos documentais confirmados', () => {
    expect(pagina).toContain('documentosCriados.length === documentosParaSubmissao.length');
    expect(pagina).toContain('criado.vendedor_id === vendedorCriado.id');
    expect(pagina).toContain('Boolean(criado.frente_path)');
    expect(pagina).toContain('Boolean(criado.verso_path)');
    expect(documentos).toContain('validarDocumentosParaSubmissao(documentos)');
  });

  it('atualiza o contexto autenticado e encaminha para a rota real do dashboard sem refresh manual', () => {
    expect(pagina).toContain('const { cadastro, recarregarPerfil } = useAuth();');
    expect(pagina).toContain('const perfilAtualizado = await recarregarPerfil();');
    expect(pagina).toContain("navigate('/dashboard', { replace: true });");
    expect(pagina).not.toContain('navigate("/dashboard/vendedor")');
    expect(pagina).not.toContain('window.location.reload');
  });
});
