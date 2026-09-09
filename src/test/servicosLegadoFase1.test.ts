import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ler = (ficheiro: string) => readFileSync(ficheiro, 'utf8');

const app = ler('src/App.tsx');
const cabecalho = ler('src/componentes/Cabecalho.tsx');
const rodape = ler('src/componentes/Rodape.tsx');
const dashboard = ler('src/paginas/dashboard/DashboardRouter.tsx');
const loja = ler('src/paginas/PaginaVendedor.tsx');
const heroPublico = ler('src/componentes/PerfilVendedorHero.tsx');
const favoritos = ler('src/paginas/dashboard/cliente/Favoritos.tsx');
const clienteHistorico = ler('src/paginas/dashboard/cliente/ClienteHistorico.tsx');
const vendedorResumo = ler('src/paginas/dashboard/vendedor/VendedorResumo.tsx');
const vendedorDesempenho = ler('src/paginas/dashboard/vendedor/VendedorDesempenho.tsx');
const vendedorEstatisticas = ler('src/paginas/dashboard/vendedor/VendedorEstatisticas.tsx');
const vendedorContactos = ler('src/paginas/dashboard/vendedor/VendedorContactos.tsx');
const migration = ler(
  'supabase/migrations/20260909010000_congelar_servicos_legados_fase1.sql',
);

describe('Serviços legados ficam dormentes na Fase 1', () => {
  it('remove navegação e redireciona rotas legadas', () => {
    expect(cabecalho).not.toContain("to: '/servicos'");
    expect(cabecalho).not.toContain("to: '/dashboard/servicos'");
    expect(cabecalho).not.toContain("to: '/dashboard/adicionar-servico'");
    expect(rodape).not.toContain('to="/servicos"');
    expect(app).toContain('path="/servicos" element={<Navigate to="/" replace />}');
    expect(app).toContain('path="/servico/:id" element={<Navigate to="/" replace />}');
    expect(dashboard).toContain(
      'path="servicos" element={<Navigate to="/dashboard" replace />}',
    );
    expect(dashboard).toContain(
      'path="adicionar-servico" element={<Navigate to="/dashboard" replace />}',
    );
  });

  it('mantém a loja e os favoritos focados exclusivamente em produtos', () => {
    expect(loja).not.toContain('fetchServicosPorVendedor');
    expect(loja).not.toContain('CardServicoLoja');
    expect(loja).not.toContain('setAbaAtiva("servicos")');
    expect(favoritos).not.toContain('listarFavoritosServicos');
    expect(favoritos).not.toContain("setAbaAtiva('servicos')");
    expect(loja).not.toContain('servicos={[]}');
    expect(heroPublico).not.toContain('Servico');
    expect(heroPublico).not.toContain('estatisticas.servicos');
    expect(heroPublico).not.toContain('Serviços');
    expect(heroPublico).toContain('estatisticas.produtos');
    expect(heroPublico).toContain('estatisticas.visualizacoes');
    expect(heroPublico).toContain('estatisticas.contactos');
  });

  it('mantém o histórico do cliente exclusivamente em produtos', () => {
    expect(clienteHistorico).not.toContain('historico_contactos_servicos');
    expect(clienteHistorico).not.toContain('ListaServicos');
    expect(clienteHistorico).not.toContain("tipo: 'servico'");
    expect(clienteHistorico).not.toContain("setAbaAtiva('servicos')");
    expect(clienteHistorico).not.toContain('Serviços (');
  });

  it('mantém o resumo do vendedor sem consumo remoto de serviços', () => {
    expect(vendedorResumo).not.toContain('fetchServicosPorVendedor');
    expect(vendedorResumo).not.toContain("'historico_contactos_servicos'");
    expect(vendedorResumo).not.toContain("'servicos'");
    expect(vendedorResumo).not.toMatch(/stats\.servicos/i);
  });

  it('mantém o desempenho do vendedor exclusivamente em produtos', () => {
    expect(vendedorDesempenho).not.toContain('fetchServicosPorVendedor');
    expect(vendedorDesempenho).not.toContain('totalCliquesServicos');
    expect(vendedorDesempenho).not.toContain('maisContactadosServicos');
    expect(vendedorDesempenho).not.toContain('Contactos em serviços');
    expect(vendedorDesempenho).not.toContain('Serviços com mais contactos');
    expect(vendedorDesempenho).not.toContain('produtos e serviços');
  });

  it('mantém as estatísticas do vendedor exclusivamente em produtos', () => {
    expect(vendedorEstatisticas).not.toContain('fetchServicosPorVendedor');
    expect(vendedorEstatisticas).not.toContain('Servico');
    expect(vendedorEstatisticas).not.toContain('servicosAtivos');
    expect(vendedorEstatisticas).not.toContain('Serviços ativos');
    expect(vendedorEstatisticas).not.toContain('produtos e serviços');
  });

  it('mantém os contactos do vendedor exclusivamente em produtos', () => {
    expect(vendedorContactos).not.toContain(
      'fetchHistoricoContactosServicosVendedor',
    );
    expect(vendedorContactos).not.toContain("tipo: 'servico'");
    expect(vendedorContactos).not.toContain('servicos?:');
    expect(vendedorContactos).not.toContain('produtos e serviços');
    expect(vendedorContactos).not.toContain('Serviços com mais contactos');
  });

  it('congela somente a escrita legada e mantém Admin restrito', () => {
    for (const policy of [
      'servicos_gerir_proprios',
      'vendedor aprovado pode atualizar seus servicos',
      'vendedor aprovado pode criar servico',
      'vendedor aprovado pode eliminar seus servicos',
    ]) {
      expect(migration).toContain(
        `drop policy if exists "${policy}" on public.servicos;`,
      );
    }

    expect(migration).toContain(
      'create policy "servicos_admin_gerir_fase1"',
    );
    expect(migration).toContain('using (public.eh_admin())');
    expect(migration).not.toMatch(
      /drop table|drop column|vendedor_id[^\n]*drop|prestador_id[^\n]*drop|produtos|encomendas|logistica/i,
    );
  });
});
