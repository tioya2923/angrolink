import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ler = (ficheiro: string) => readFileSync(resolve(process.cwd(), ficheiro), 'utf8');
const migration = ler('supabase/migrations/20260911010000_adicionar_admin_logistica_parceiro.sql');
const service = ler('src/services/adminEntregador360.ts');
const detalhe = ler('src/paginas/dashboard/admin/AdminEntregadorDetalhe.tsx');
const produtos = ler('src/paginas/dashboard/vendedor/VendedorProdutos.tsx');

describe('Admin logística do parceiro', () => {
  it('cria três RPCs administrativas com fronteira SECURITY DEFINER controlada', () => {
    for (const rpc of ['obter_resumo_entregas_parceiro_admin', 'listar_entregas_parceiro_admin', 'obter_resumo_financeiro_parceiro_admin']) expect(migration).toContain(`public.${rpc}`);
    expect(migration).toContain('security definer');
    expect(migration).toContain('set search_path = pg_catalog, public');
    expect(migration).toContain('auth.uid() is null or not public.eh_admin()');
  });
  it('resume os estados reais e pagina por parceiro com joins server-side', () => {
    for (const estado of ['atribuida', 'aceite', 'chegou_origem', 'recolhida', 'chegou_destino', 'concluida', 'recusada', 'cancelada']) expect(migration).toContain(`'${estado}'`);
    for (const tabela of ['public.atribuicoes_entrega_encomenda', 'public.encomendas', 'public.vendedores', 'public.clientes', 'public.veiculos_entrega']) expect(migration).toContain(tabela);
    expect(migration).toContain('limit v_limite offset v_offset');
    expect(migration).toContain("'total_resultados'");
  });
  it('conta somente pagamentos na entrega confirmados e não cria remuneração fictícia', () => {
    expect(migration).toContain("p.estado = 'confirmado'");
    expect(migration).toContain("t.metodo = 'pagamento_na_entrega'");
    expect(migration).toContain("t.estado = 'confirmada'");
    expect(migration).toContain("'remuneracao_configurada', false");
    for (const proibido of ['ganhos_entregador', 'saldo_entregador', 'repasse_entregador', 'comissao_entregador']) expect(migration).not.toContain(proibido);
  });
  it('liga as abas aos contratos RPC e preserva loading, erro, vazio e paginação', () => {
    for (const nome of ['obterResumoEntregasParceiroAdmin', 'listarEntregasParceiroAdmin', 'obterResumoFinanceiroParceiroAdmin']) expect(service).toContain(nome);
    expect(service).not.toContain('rpcAdminLogistica');
    expect(service).toContain("supabase.rpc('obter_resumo_entregas_parceiro_admin'");
    for (const texto of ['A carregar entregas', 'Este entregador ainda não possui atribuições de entrega.', 'Remuneração logística ainda não configurada para o piloto.', 'Volume das encomendas não representa rendimento do entregador.']) expect(detalhe).toContain(texto);
  });
  it('usa uma grelha móvel de duas colunas para as cinco ações de produto', () => {
    expect(produtos).toContain('grid grid-cols-2 gap-2 sm:flex sm:flex-col');
    expect(produtos).toContain('col-span-2');
    for (const acao of ['Editar', 'Pausar', 'Destacar', 'Partilhar', 'Remover']) expect(produtos).toContain(acao);
    expect(produtos).not.toContain('flex sm:flex-col gap-2 shrink-0');
  });
});
