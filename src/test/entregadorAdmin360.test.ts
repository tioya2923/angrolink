import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ler = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const servico = ler('src/services/adminEntregador360.ts');
const pagina = ler('src/paginas/dashboard/admin/AdminEntregadorDetalhe.tsx');
const lista = ler('src/paginas/dashboard/admin/AdminEntregadores.tsx');
const router = ler('src/paginas/dashboard/DashboardRouter.tsx');

describe('Entregador 360 V1', () => {
  it('usa apenas RPCs administrativas', () => {
    for (const rpc of ['obter_entregador_admin', 'listar_veiculos_entregador_admin', 'listar_documentos_entregador_admin', 'listar_areas_cobertura_entregador_admin', 'listar_historico_documental_entregador_admin', 'obter_resumo_entregas_parceiro_admin', 'listar_entregas_parceiro_admin', 'obter_resumo_financeiro_parceiro_admin']) expect(servico).toContain(rpc);
    expect(servico).not.toContain(".from('documentos_parceiro_entrega')");
  });
  it('expõe rota e CTA sem remover o painel atual', () => {
    expect(router).toContain('path="entregadores/:id"');
    expect(lista).toContain('Ver entregador');
  });
  it('usa estados, taxonomia e capacidade reais', () => {
    for (const campo of ['mota', 'carro', 'carrinha', 'camiao', 'capacidadeKg', 'volumeM3', 'paletes', 'refrigeracao']) expect(pagina).toContain(campo);
  });
  it('não expõe paths, foto privada, emergência ou segredos', () => {
    for (const campo of ['frente_path', 'verso_path', 'foto_perfil_url', 'contacto_emergencia', 'access_token', 'refresh_token', 'service_role']) expect(pagina).not.toContain(campo);
  });
  it('carrega histórico sob demanda, pagina e mostra versões e eventos reais', () => {
    for (const campo of ['carregarTab', 'listarHistoricoDocumentalEntregadorAdmin', 'DocumentoHistoricoCard', 'Versão atual', 'Linha do tempo', 'Ver frente', 'Ver verso', 'totalResultados', 'tabErro', 'overflow-x-auto']) expect(pagina).toContain(campo);
  });
  it('substitui os placeholders por entregas e financeiro administrativos', () => {
    for (const campo of ['resumoEntregas', 'listarEntregasParceiroAdmin', 'FinanceiroParceiro', 'Remuneração logística ainda não configurada para o piloto.', 'Volume das encomendas não representa rendimento do entregador.']) expect(pagina).toContain(campo);
    expect(pagina).not.toContain('Gestão de entregas será disponibilizada quando o motor logístico estiver ativo.');
    expect(pagina).not.toContain('Financeiro logístico ainda não disponível.');
  });
});
