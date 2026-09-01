import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ler = (caminho: string) => readFileSync(resolve(process.cwd(), caminho), 'utf8');
const vendedor = ler('src/paginas/dashboard/vendedor/VendedorPerfil.tsx');
const cliente = ler('src/paginas/dashboard/cliente/ClienteDefinicoes.tsx');
const paginaAnunciar = ler('src/paginas/PaginaAnunciar.tsx');
const api = ler('src/services/api.ts');
const migracao = ler('supabase/migrations/20260830010000_proteger_identidade_verificada_vendedor.sql');
const migracaoStorage = ler('supabase/migrations/20260830011000_endurecer_storage_fotos_perfis.sql');

describe('identidade e fotografia de vendedor e cliente', () => {
  it('mantém os nomes do vendedor editáveis antes da aprovação e bloqueados pelo marco permanente depois dela', () => {
    expect(vendedor).toContain('const identidadeVerificada = Boolean(vendedor?.aprovado_em);');
    expect(vendedor).toContain('readOnly={identidadeVerificada}');
    expect(vendedor).toContain('Nome comercial aprovado. Para alterar este dado, contacte o Apoio ANGROLINK.');
    expect(vendedor).toContain('Nome do responsável verificado. Para alterar este dado, contacte o Apoio ANGROLINK.');
    expect(migracao).toContain('old.aprovado_em is not null');
    expect(migracao).toContain('new.nome_responsavel is distinct from old.nome_responsavel');
    expect(migracao).toContain('new.nome_comercial is distinct from old.nome_comercial');
    expect(migracao).toContain('not public.eh_admin()');
    expect(migracao).toContain('new.aprovado_em is distinct from old.aprovado_em');
    expect(migracao).toContain('new.aprovado_por is distinct from old.aprovado_por');
  });

  it('envia a fotografia do vendedor para o namespace do utilizador autenticado e não elimina a anterior', () => {
    expect(api).toContain('await supabase.auth.getUser()');
    expect(api).toContain('`${user.id}/perfil-${crypto.randomUUID()}.${extensao}`');
    expect(api).toContain("throw new Error('Não foi possível enviar a imagem.')");
    expect(api).not.toContain('.from(BUCKET_VENDEDORES).remove(');
  });

  it('bloqueia duplo envio e sincroniza o AuthContexto após guardar vendedor e cliente', () => {
    for (const pagina of [vendedor, cliente]) {
      expect(pagina).toContain('const submissaoEmCurso = useRef(false);');
      expect(pagina).toContain('if (submissaoEmCurso.current ||');
      expect(pagina).toContain('submissaoEmCurso.current = true;');
      expect(pagina).toContain('submissaoEmCurso.current = false;');
      expect(pagina).toContain('await recarregarPerfil();');
    }
  });

  it('mantém o nome do cliente editável e a foto no namespace do próprio utilizador', () => {
    expect(cliente).toContain('value={nome}');
    expect(cliente).not.toContain('readOnly={identidadeVerificada}');
    expect(cliente).toContain('const caminho = `${utilizador.id}/perfil-${Date.now()}.${extensao}`;');
    expect(cliente).toContain('Máximo 3MB · JPG, PNG ou WEBP');
  });

  it('restringe escrita de fotografias públicas ao namespace do utilizador, sem abrir os buckets', () => {
    for (const bucket of ['vendedores', 'clientes']) {
      expect(migracaoStorage).toContain(`bucket_id = '${bucket}'`);
      expect(migracaoStorage).toContain('(storage.foldername(name))[1] = auth.uid()::text');
    }
    expect(migracaoStorage).toContain('for insert to authenticated');
    expect(migracaoStorage).toContain('for update to authenticated');
    expect(migracaoStorage).toContain('with check (');
    expect(migracaoStorage).toContain('for delete to authenticated');
    expect(migracaoStorage).toContain('for select to public');
  });

  it('reutiliza o uploader canônico no cadastro e nunca grava a foto inicial na raiz do bucket', () => {
    expect(paginaAnunciar).toContain('import { uploadImagemVendedor } from "@/services/api";');
    expect(paginaAnunciar).toContain('fotoPerfilUrl = await uploadImagemVendedor(fotoPerfil);');
    expect(paginaAnunciar).not.toContain('.from("vendedores")\n          .upload(nomeFicheiro, fotoPerfil)');
    expect(paginaAnunciar).not.toContain('const nomeFicheiro = `${crypto.randomUUID()}.${extensao}`;');
  });
});
