import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ler = (caminho: string) => readFileSync(resolve(process.cwd(), caminho), 'utf8');
const servico = ler('src/services/adminCompradores.ts');
const lista = ler('src/paginas/dashboard/admin/AdminCompradores.tsx');
const detalhe = ler('src/paginas/dashboard/admin/AdminCompradorDetalhe.tsx');
const router = ler('src/paginas/dashboard/DashboardRouter.tsx');
const menu = ler('src/paginas/dashboard/DashboardLayout.tsx');
const diretorio = ler('src/paginas/dashboard/admin/AdminUtilizadores.tsx');

describe('Compradores 360 V1', () => {
  it('usa exclusivamente as RPCs administrativas tipadas', () => {
    expect(servico).toContain("supabase.rpc('listar_compradores_admin'");
    expect(servico).toContain("supabase.rpc('obter_comprador_admin'");
    expect(servico).not.toContain(".from('clientes')");
  });

  it('adiciona menu e rotas administrativas de lista e detalhe', () => {
    expect(menu).toContain("rotulo: 'Compradores'");
    expect(router).toContain('path="compradores"');
    expect(router).toContain('path="compradores/:id"');
  });

  it('mantém pesquisa, filtros, paginação e zero resultados no servidor', () => {
    expect(lista).toContain('setTimeout');
    expect(lista).toContain('pesquisa');
    expect(lista).toContain('comCancelamentos');
    expect(lista).toContain('paginacao.totalResultados');
    expect(lista).toContain('Nenhum comprador encontrado com estes filtros.');
    expect(lista).not.toContain('.filter(comprador');
  });

  it('separa cancelamentos, recusas, encomendas, pagamentos e disputas', () => {
    expect(detalhe).toContain('Cancelamentos do comprador');
    expect(detalhe).toContain('Recusas de vendedores');
    expect(detalhe).toContain('ListaEncomendas');
    expect(detalhe).toContain('ListaPagamentos');
    expect(detalhe).toContain('ListaDisputas');
    expect(detalhe).toContain('Inconsistente/não disponível');
  });

  it('oferece ao Diretório Global o detalhe do papel comprador sem quebrar outros papéis', () => {
    expect(diretorio).toContain("utilizador.papeis.includes('cliente')");
    expect(diretorio).toContain('/dashboard/compradores/${utilizador.userId}');
    expect(diretorio).toContain('Detalhe em breve');
  });

  it('não introduz ações destrutivas, documentos obrigatórios ou dados sensíveis', () => {
    expect(detalhe).not.toContain('Eliminar');
    expect(detalhe).not.toContain('Suspender');
    expect(detalhe).not.toContain('OTP');
    expect(servico).not.toContain('access_token');
    expect(servico).not.toContain('refresh_token');
  });
});
