import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ler = (ficheiro: string) => readFileSync(resolve(process.cwd(), ficheiro), 'utf8');
const migration = ler('supabase/migrations/20260901040000_aprovar_parceiro_entrega_atomicamente.sql');
const api = ler('src/services/api.ts');
const mediaAdmin = ler('src/services/adminMediaPrivada.ts');
const edge = ler('supabase/functions/admin-media-privada/index.ts');
const storage = ler('supabase/baseline/current/03_storage_custom.sql');
const resumoParceiro = ler('src/paginas/dashboard/parceiro/ParceiroResumo.tsx');

describe('aprovação autoritativa do entregador', () => {
  it('aprova parceiro e veículos na mesma RPC administrativa transacional', () => {
    expect(migration).toContain('create or replace function public.aprovar_parceiro_entrega_admin');
    expect(migration).toContain('security definer');
    expect(migration).toContain('set search_path = public');
    expect(migration).toContain('for update');
    expect(migration).toContain("set estado_verificacao = 'aprovado'");
    expect(migration).toContain("set estado = 'aprovado'");
    expect(migration).toContain("raise exception 'O entregador precisa de pelo menos um veículo antes da aprovação.'");
  });

  it('não mantém um segundo update de veículo que possa falhar silenciosamente no browser', () => {
    const inicio = api.indexOf('export async function atualizarEstadoParceiroEntrega');
    const fim = api.indexOf('export async function atualizarEstadoDocumentoParceiro', inicio);
    const funcao = api.slice(inicio, fim);
    expect(funcao).toContain("'aprovar_parceiro_entrega_admin'");
    expect(funcao).not.toContain(".from('veiculos_entrega')");
    expect(funcao).toContain('if (error) throw error;');
  });
});

describe('fotografia privada do veículo', () => {
  it('pede a media administrativa pelo recurso e identificador autorizados', () => {
    expect(mediaAdmin).toContain("recurso: 'foto_veiculo_entregador'");
    expect(edge).toContain("corpo.recurso === 'foto_veiculo_entregador'");
    expect(edge).toContain(".from('veiculos_entrega')");
    expect(edge).toContain(".from('administradores')");
    expect(edge).toContain(".from('documentos-parceiros').createSignedUrl");
    expect(edge).not.toContain('{ url: caminho');
  });

  it('mantém a foto privada e permite ao dono obter apenas uma URL assinada', () => {
    expect(storage).toContain("bucket_id = 'documentos-parceiros'");
    expect(storage).toContain('(storage.foldername(name))[1] = auth.uid()::text');
    expect(resumoParceiro).toContain('obterUrlDocumentoParceiro(caminhoFoto)');
    expect(resumoParceiro).not.toContain('getPublicUrl');
  });
});
