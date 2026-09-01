import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ler = (ficheiro: string) => readFileSync(resolve(process.cwd(), ficheiro), 'utf8');
const checkout = ler('src/paginas/PaginaCheckoutPendente.tsx');
const detalhe = ler('src/componentes/encomendas/EncomendaDetalheConteudo.tsx');
const vendedor = ler('src/paginas/dashboard/vendedor/VendedorEncomendaDetalhe.tsx');
const admin = ler('src/paginas/dashboard/admin/AdminEncomendaDetalhe.tsx');
const parceiro = ler('src/paginas/dashboard/parceiro/ParceiroTarefas.tsx');

describe('checkout de entrega V1 — interface', () => {
  it('oferece as duas modalidades funcionais sem botão de entrega desativado', () => {
    expect(checkout).toContain("useState<ModalidadeRecebimentoEncomenda>('levantamento')");
    expect(checkout).toContain("setModalidadeRecebimento('entrega')");
    expect(checkout).toContain('Levantamento no vendedor');
    expect(checkout).toContain('Confirmar encomenda com entrega');
    expect(checkout).not.toContain('Entrega — em breve');
  });

  it('usa serviço de território, loading, erro, retry e nomes canónicos', () => {
    for (const contrato of ['useFiltroTerritorialAngola', 'aCarregarProvincias', 'aCarregarMunicipios', 'erroProvincias', 'erroMunicipios', 'carregarProvincias', 'recarregarMunicipios', 'provinciaSelecionada!.nome', 'municipioSelecionado!.nome']) expect(checkout).toContain(contrato);
    expect(checkout).toContain('selecionarProvincia');
    expect(checkout).toContain('selecionarMunicipio');
  });

  it('mantém uma criação por vendedor, sucesso parcial e remoção seletiva', () => {
    expect(checkout).toContain('for (const grupo of gruposAtualizados)');
    expect(checkout).toContain('criarEncomendaEntrega');
    expect(checkout).toContain('removerItens(gruposAtualizados');
    expect(checkout).toContain('permanecem no carrinho para nova tentativa');
    expect(checkout).toContain('Nenhuma encomenda foi criada.');
  });

  it('mantém uma chave de idempotência por grupo até ao sucesso local', () => {
    for (const contrato of ['obterChaveIdempotenciaCheckout', 'concluirChaveIdempotenciaCheckout', 'idempotencyKey: chaveIdempotencia', 'confirmacaoEmCurso']) {
      expect(checkout).toContain(contrato);
    }
    expect(checkout).toContain('removerItens(gruposAtualizados');
    expect(checkout.indexOf('removerItens(gruposAtualizados')).toBeLessThan(checkout.indexOf('concluirChaveIdempotenciaCheckout(utilizador.id'));
  });

  it('apresenta pagamento e custo de entrega sem prometer preço logístico', () => {
    expect(checkout).toContain('Pagar na entrega');
    expect(checkout).toContain('Custo da entrega ainda será confirmado.');
    expect(checkout).not.toContain('Frete incluído');
  });

  it('distingue entrega no cliente, vendedor, admin e entregador', () => {
    expect(detalhe).toContain('Destino de entrega');
    expect(detalhe).toContain('A aguardar atribuição de entregador.');
    expect(vendedor).toContain("encomenda.modalidade_recebimento === 'entrega'");
    expect(vendedor).toContain("!eEntrega && encomenda.estado === 'pronta_para_levantamento'");
    expect(admin).toContain('Logística e matching');
    expect(parceiro).toContain('Tarefas de entrega');
  });
});
