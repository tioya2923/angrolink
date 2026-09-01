import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ler = (caminho: string) => readFileSync(join(process.cwd(), caminho), 'utf8');

describe('Admin 360 V1', () => {
  const servico = ler('src/services/admin360.ts');
  const detalheDisputa = ler('src/paginas/dashboard/admin/AdminDisputaDetalhe.tsx');

  it('centraliza o acesso administrativo nas RPCs aprovadas', () => {
    for (const rpc of [
      'listar_encomendas_admin', 'obter_encomenda_admin', 'listar_financeiro_admin',
      'listar_disputas_admin', 'obter_disputa_admin', 'assumir_disputa_admin',
      'resolver_disputa_sem_reembolso_admin', 'resolver_disputa_reembolso_parcial_admin',
      'resolver_disputa_reembolso_total_admin',
    ]) expect(servico).toContain(`"${rpc}"`);
    expect(servico).not.toContain("from('pagamentos')");
    expect(servico).not.toContain("from('reembolsos_pagamento')");
  });

  it('não permite que a UI decida devolver taxa do processador', () => {
    expect(servico).toContain('p_valor_taxa_processador_centimos: 0');
    expect(detalheDisputa).not.toContain('Taxa do processador (Kz)');
  });

  it('gera a chave por submissão lógica e não durante o retry', () => {
    expect(detalheDisputa).toContain('setChave(criarChaveIdempotenciaAdmin())');
    expect(detalheDisputa).toContain('chaveIdempotencia: chave');
    expect(detalheDisputa.match(/criarChaveIdempotenciaAdmin\(\)/g)).toHaveLength(1);
  });

  it('protege contra duplo clique e não apresenta OTP', () => {
    expect(detalheDisputa).toContain('disabled={aProcessar');
    for (const pagina of [
      'src/paginas/dashboard/admin/AdminEncomendaDetalhe.tsx',
      'src/paginas/dashboard/admin/AdminDisputaDetalhe.tsx',
    ]) {
      const conteudo = ler(pagina).toLowerCase();
      expect(conteudo).not.toContain('codigo_hash');
      expect(conteudo).not.toContain('codigos_levantamento');
    }
  });

  it('mantém as rotas Admin 360 exclusivamente dentro do ramo administrativo', () => {
    const router = ler('src/paginas/dashboard/DashboardRouter.tsx');
    const inicioAdmin = router.indexOf('{utilizador.papel==="admin"');
    const rotaFinanceiro = router.indexOf('<Route path="financeiro"');
    const fimAdmin = router.indexOf('{utilizador.papel==="vendedor"');
    expect(inicioAdmin).toBeGreaterThan(-1);
    expect(rotaFinanceiro).toBeGreaterThan(inicioAdmin);
    expect(rotaFinanceiro).toBeLessThan(fimAdmin);
  });
});
