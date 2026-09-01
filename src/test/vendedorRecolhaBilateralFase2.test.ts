import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ler = (ficheiro: string) => readFileSync(resolve(process.cwd(), ficheiro), 'utf8');
const detalhe = ler('src/paginas/dashboard/vendedor/VendedorEncomendaDetalhe.tsx');
const encomendas = ler('src/services/encomendas.ts');
const realtime = ler('src/hooks/useEncomendasTempoReal.ts');

describe('recolha bilateral — detalhe do vendedor', () => {
  it('mantém o contrato temporário e a RPC protegida pela atribuição', () => {
    for (const valor of ['atribuicao_id', 'chegou_origem', 'recolhida', 'chegou_origem_em', 'recolhida_em', 'nome_entregador', 'veiculo', 'confirmarRecolhaEncomendaVendedor', "'confirmar_recolha_encomenda_vendedor'", 'p_atribuicao_id']) expect(encomendas).toContain(valor);
  });
  it('exige todas as condições visuais antes de permitir confirmar recolha', () => {
    for (const valor of ["modalidade_recebimento === 'entrega'", "encomenda.estado === 'pronta_para_levantamento'", "entrega?.estado === 'chegou_origem'", 'entrega.atribuicao_id', 'podeConfirmarRecolha']) expect(detalhe).toContain(valor);
    expect(detalhe).toContain('confirmarRecolhaEncomendaVendedor(entrega.atribuicao_id)');
    expect(detalhe).not.toContain('confirmarRecolhaEncomendaVendedor(encomenda.id)');
  });
  it('preserva diálogo bilateral, estados logísticos e ausência de trânsito prematuro', () => {
    for (const valor of ['Confirmar entrega ao entregador', 'entregaste fisicamente', 'transfere a custódia', 'A confirmar…', 'nao_atribuido', 'atribuida', 'aceite', 'chegou_origem', 'recolhida', 'recusada', 'cancelada', 'concluida', 'A aguardar atribuição de um entregador.', 'Entregador confirmado', 'Entregador chegou para recolha', 'Recolha confirmada', 'A encomenda está agora com o entregador.']) expect(detalhe).toContain(valor);
    expect(detalhe).not.toContain('Em trânsito');
  });
  it('preserva disputa, financeiro, OTP e ações comerciais', () => {
    for (const valor of ['fetchDisputaEncomenda', 'disputa={disputa}', 'ResumoFinanceiroVendedorEncomenda', 'obterResumoFinanceiroEncomendaVendedor', 'resumoCarregando', 'resumoErro', 'validarCodigoLevantamento', 'inputMode="numeric"', 'maxLength={6}', "replace(/\\D/g, '')", '.slice(0, 6)', 'codigo.length !== 6', 'Tentativas restantes', 'O cliente deve gerar um novo código', 'Confirmar encomenda', 'Iniciar preparação', 'Marcar como pronta para recolha', 'Marcar como pronta para levantamento']) expect(detalhe).toContain(valor);
  });
  it('reutiliza realtime filtrado e não expõe escritas ou documentos privados', () => {
    for (const valor of ['useEncomendasTempoReal', "ativo: utilizador?.papel === 'vendedor'", 'encomendaId: id', 'carregar']) expect(detalhe).toContain(valor);
    expect(realtime).toContain('encomendaId');
    for (const proibido of ['supabase.from', 'atribuicoes_entrega_encomenda', 'Bilhete de Identidade', 'Carta de Condução', 'storage']) expect(detalhe).not.toContain(proibido);
  });
});
