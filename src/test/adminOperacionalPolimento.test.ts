import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ler = (ficheiro: string) => readFileSync(resolve(process.cwd(), ficheiro), 'utf8');
const produtos = ler('src/paginas/dashboard/admin/AdminProdutos.tsx');
const pedidosVendedores = ler('src/paginas/dashboard/admin/AdminPedidosVendedores.tsx');
const detalheEntregador = ler('src/paginas/dashboard/admin/AdminEntregadorDetalhe.tsx');
const entregaParticipante = ler('supabase/migrations/20260824120000_visibilidade_segura_entrega_fase_1.sql');
const documentosParceiro = ler('src/services/adminEntregador360.ts');
const entregaMedia = ler('supabase/functions/entrega-media-participante/index.ts');
const detalheVendedor = ler('src/paginas/dashboard/admin/AdminVendedorDetalhe.tsx');

describe('polimento operacional administrativo', () => {
  it('mostra métricas canónicas no Admin Produtos sem acionar incremento', () => {
    expect(produtos).toContain('p.visualizacoes || 0');
    expect(produtos).toContain('p.cliques_whatsapp || 0');
    expect(produtos).toContain('visualizações');
    expect(produtos).toContain('contactos');
    expect(produtos).not.toMatch(/incrementar.*(visualiz|clique)|registrar.*(visualiz|clique)/i);
  });

  it('preserva a revisão documental privada já existente para vendedores', () => {
    expect(pedidosVendedores).toContain('Documentos para análise');
    expect(pedidosVendedores).toContain('obterUrlAssinadaDocumentoVendedor(path)');
    expect(pedidosVendedores).toContain('Abrir frente');
    expect(pedidosVendedores).toContain('Abrir verso');
    expect(pedidosVendedores).toContain('analisarDocumentoVendedor');
    expect(pedidosVendedores).not.toMatch(/frente_path\s*}/);
    expect(pedidosVendedores).not.toMatch(/verso_path\s*}/);
  });

  it('mantém abertura segura de versões documentais do entregador, sem paths na UI', () => {
    expect(detalheEntregador).toContain('obterDocumentoEntregadorAdmin(versaoId, recurso)');
    expect(detalheEntregador).toContain('documento_entregador_frente');
    expect(detalheEntregador).toContain('documento_entregador_verso');
    expect(detalheEntregador).toContain('Ver frente');
    expect(detalheEntregador).toContain('Ver verso');
    expect(detalheEntregador).not.toContain('frente_path');
    expect(detalheEntregador).not.toContain('verso_path');
  });

  it('documenta o limite atual: a lista não devolve versão atual e a entrega participante não devolve fotos', () => {
    const inicioDocumento = documentosParceiro.indexOf('export interface Documento {');
    const fimDocumento = documentosParceiro.indexOf('export interface Area', inicioDocumento);
    expect(documentosParceiro.slice(inicioDocumento, fimDocumento)).toContain('versaoAtualId');
    expect(entregaParticipante).not.toContain("'foto_perfil'");
    expect(entregaParticipante).not.toContain("'foto_veiculo_path'");
  });

  it('mantém CORS em preflight e respostas da media participante', () => {
    expect(entregaMedia).toContain('const corsHeaders');
    expect(entregaMedia).toContain("'Access-Control-Allow-Origin'");
    expect(entregaMedia).toContain("'Access-Control-Allow-Headers'");
    expect(entregaMedia).toContain("'Access-Control-Allow-Methods'");
    expect(entregaMedia).toContain('headers: corsHeaders');
    expect(entregaMedia).toContain('...corsHeaders');
  });

  it('abre documentos do vendedor pela reserva segura da janela', () => {
    expect(detalheVendedor).toContain('abrirDocumentoPrivado');
    expect(detalheVendedor).toContain('obterUrlAssinadaDocumentoVendedor(caminho)');
    expect(detalheVendedor).toContain('Ver frente');
    expect(detalheVendedor).toContain('Ver verso');
  });
});
