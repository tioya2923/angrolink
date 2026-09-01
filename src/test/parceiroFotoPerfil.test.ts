import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const api = readFileSync(resolve(process.cwd(), "src/services/api.ts"), "utf8");
const resumo = readFileSync(
  resolve(process.cwd(), "src/paginas/dashboard/parceiro/ParceiroResumo.tsx"),
  "utf8",
);
const migracao = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260829140000_proteger_nome_verificado_parceiro.sql",
  ),
  "utf8",
);

describe("fotografia e nome verificado do parceiro", () => {
  it("guarda a nova fotografia na pasta do utilizador autenticado, não no id do parceiro", () => {
    expect(api).toContain("export async function uploadFotoPerfilParceiro(ficheiro: File)");
    expect(api).toContain("await supabase.auth.getUser()");
    expect(api).toContain("`${user.id}/perfil-${crypto.randomUUID()}.${extensao}`");
    expect(api).not.toContain("uploadFotoPerfilParceiro(parceiroId: string");
    expect(resumo).toContain("await uploadFotoPerfilParceiro(fotoPerfilFile)");
  });

  it("mostra um erro seguro se o upload falhar e não duplica o sucesso do guardado", () => {
    expect(resumo).toContain('title: "Não foi possível atualizar a fotografia."');
    expect(resumo).toContain('description: "Tente novamente."');
    expect(resumo).not.toContain('title: "Perfil atualizado"');
    expect(resumo).toContain('await atualizarParceiro(dados);');
    expect(resumo).toContain('await recarregarPerfil();');
  });

  it("mantém o nome editável antes da aprovação e protege a identidade aprovada em qualquer estado posterior", () => {
    expect(resumo).toContain("const nomeVerificado = Boolean(parceiro.aprovado_em);");
    expect(resumo).toContain("readOnly={nomeVerificado}");
    expect(resumo).toContain("Nome verificado. Para alterar este dado, contacte o Apoio ANGROLINK.");
    expect(migracao).toContain("old.aprovado_em is not null");
    expect(migracao).not.toContain("old.estado = 'aprovado'");
    expect(migracao).toContain("new.nome_completo is distinct from old.nome_completo");
    expect(migracao).toContain("not public.eh_admin()");
  });

  it("preserva a exceção administrativa e cobre aprovação, suspensão e expiração pela mesma regra", () => {
    expect(migracao).toContain("not public.eh_admin()");
    expect(migracao).toContain("old.aprovado_em is not null");
  });

  it("bloqueia imediatamente um segundo submit enquanto o upload ou a atualização decorrem", () => {
    expect(resumo).toContain("const submissaoEmCurso = useRef(false);");
    expect(resumo).toContain("if (submissaoEmCurso.current || aGuardar) return;");
    expect(resumo).toContain("submissaoEmCurso.current = true;");
    expect(resumo).toContain("setASubmeter(true);");
    expect(resumo).toContain("submissaoEmCurso.current = false;");
    expect(resumo).toContain("disabled={aGuardar || aSubmeter}");
  });
});
