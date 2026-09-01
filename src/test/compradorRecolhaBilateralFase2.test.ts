import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function ler(caminho: string) {
  return readFileSync(resolve(process.cwd(), caminho), 'utf8');
}

const detalhePartilhado = ler('src/componentes/encomendas/EncomendaDetalheConteudo.tsx');
const detalheComprador = ler('src/paginas/dashboard/cliente/ClienteEncomendaDetalhe.tsx');
const rotas = ler('src/paginas/dashboard/DashboardRouter.tsx');
const inicioProgresso = detalhePartilhado.indexOf('function ProgressoEntregaComprador');
const fimProgresso = detalhePartilhado.indexOf('function Linha', inicioProgresso);
const progressoComprador = detalhePartilhado.slice(inicioProgresso, fimProgresso);

describe('recolha bilateral — apresentação do comprador na fase 2', () => {
  it('reutiliza o detalhe partilhado para cliente e vendedor comprador, com rotas distintas', () => {
    expect(detalheComprador).toContain('<EncomendaDetalheConteudo encomenda={encomenda} contexto="cliente" disputa={disputa} />');
    expect(rotas).toContain('path="encomendas/:id" element={<ClienteEncomendaDetalhe/>}');
    expect(rotas).toContain('path="compras/:id" element={<ClienteEncomendaDetalhe rotaVoltar="/dashboard/compras"/>}');
    expect(detalheComprador).toContain("rotaVoltar = '/dashboard/encomendas'");
  });

  it('condiciona o acompanhamento à modalidade de entrega e cobre os estados logísticos', () => {
    expect(detalhePartilhado).toContain("encomenda.modalidade_recebimento === 'entrega'");
    expect(detalhePartilhado).toContain("contexto === 'cliente'");
    for (const estado of ['nao_atribuido', 'atribuida', 'aceite', 'chegou_origem', 'recolhida']) {
      expect(detalhePartilhado).toContain(`'${estado}'`);
    }
    for (const texto of [
      'A aguardar entregador',
      'A entrega ainda não possui um entregador atribuído.',
      'Entregador atribuído',
      'A aguardar confirmação do entregador.',
      'Entregador confirmado',
      'Entregador chegou para recolher a encomenda',
      'O entregador encontra-se no vendedor e aguarda a entrega da encomenda.',
      'Encomenda recolhida pelo entregador',
      'A tua encomenda está agora com o entregador.',
    ]) expect(detalhePartilhado).toContain(texto);
  });

  it('mostra apenas dados operacionais seguros e marcos temporais quando existirem', () => {
    for (const campo of ['nome_entregador', 'tipo_veiculo', 'marca', 'modelo', 'matricula', 'atribuido_em', 'aceite_em', 'chegou_origem_em', 'recolhida_em']) {
      expect(detalhePartilhado).toContain(campo);
    }
    expect(progressoComprador).toContain("['aceite', 'chegou_origem', 'recolhida', 'concluida']");
    expect(progressoComprador).not.toMatch(/documentos?|telefone|frente_path|verso_path|access_token|signed/i);
    expect(progressoComprador).not.toContain('Em trânsito');
    expect(progressoComprador).not.toContain('A caminho');
    expect(progressoComprador).not.toContain('Saiu para entrega');
  });

  it('não atribui ao comprador ações operacionais de recolha', () => {
    expect(detalheComprador).not.toContain('confirmarChegadaOrigemEntregador');
    expect(detalheComprador).not.toContain('confirmarRecolhaEncomendaVendedor');
    expect(detalhePartilhado).not.toContain('confirmarChegadaOrigemEntregador');
    expect(detalhePartilhado).not.toContain('confirmarRecolhaEncomendaVendedor');
    expect(detalheComprador).not.toContain("from('atribuicoes_entrega_encomenda')");
  });

  it('preserva levantamento, OTP, pagamentos, disputas e Realtime por encomenda', () => {
    for (const valor of ['modalidade_recebimento === \'levantamento\'', 'obterCodigoLevantamento', 'Gerar código', 'PagamentoClienteEncomenda', 'fetchDisputaEncomenda', 'abrirDisputaEncomenda', 'useEncomendasTempoReal', 'encomendaId: id']) {
      expect(detalheComprador).toContain(valor);
    }
    expect(detalheComprador).not.toContain("from('encomendas')");
  });
});
