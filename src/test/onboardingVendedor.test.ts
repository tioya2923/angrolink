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
const esquemaVendedor = readFileSync(
  resolve(process.cwd(), 'supabase/baseline/current/01_public_schema.sql'),
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

  it('delega os campos administrativos ao servidor no INSERT da candidatura', () => {
    const inicio = pagina.indexOf('const novoVendedor = {');
    const fim = pagina.indexOf('const { data: vendedorCriado', inicio);
    const payload = pagina.slice(inicio, fim);

    for (const campo of ['plano', 'verificado', 'status_aprovacao', 'pode_destacar']) {
      expect(payload).not.toMatch(new RegExp(`\\b${campo}\\s*:`));
    }
    expect(esquemaVendedor).toContain('"plano" "text" DEFAULT \'gratuito\'');
    expect(esquemaVendedor).toContain('"status_aprovacao" "text" DEFAULT \'pendente\'');
    expect(esquemaVendedor).toContain('"verificado" boolean DEFAULT false');
    expect(esquemaVendedor).toContain('"pode_destacar" boolean DEFAULT false');
  });

  it('retoma uma candidatura pendente pelo boundary seguro, sem SELECT direto', () => {
    expect(pagina).toContain('fetchMeuVendedor({ lancarErro: true })');
    expect(pagina).toContain('.insert(novoVendedor);');
    expect(pagina).not.toContain('.insert(novoVendedor)\n        .select("id")\n        .single();');
    expect(pagina).not.toContain('.from("vendedores")\n          .select("id")');
    expect(pagina).not.toContain('.eq("user_id", authUser.id)\n          .maybeSingle()');
  });

  it('não faz login redundante quando o signUp já devolveu sessão', () => {
    const inicio = pagina.indexOf('const { data: authData');
    const fim = pagina.indexOf('const perfilAtualizado = await recarregarPerfil();', inicio);
    const fluxo = pagina.slice(inicio, fim);
    expect(fluxo).toContain('if (authError || !authUser || !authData.session)');
    expect(fluxo.match(/signInWithPassword/g)).toHaveLength(1);
  });
});
