import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ler = (caminho: string) => readFileSync(caminho, 'utf8');
const recomendacoes = ler('src/paginas/dashboard/cliente/ClienteRecomendacoes.tsx');
const cardServico = ler('src/componentes/CardServico.tsx');
const cadastro = ler('src/paginas/PaginaAnunciar.tsx');
const metadados = ler('index.html');

describe('coerência dos conteúdos públicos de produtos', () => {
  it('leva a recomendação de produto para a sua rota interna sem registar contacto WhatsApp', () => {
    expect(recomendacoes).toContain('to={`/produto/${produto.id}`}');
    expect(recomendacoes).toContain('Ver produto');
    expect(recomendacoes).not.toContain('gerarLinkWhatsApp');
    expect(recomendacoes).not.toContain('incrementarCliqueWhatsappProduto');
    expect(recomendacoes).not.toContain('guardarHistoricoContacto');
  });

  it('preserva o contacto WhatsApp do fluxo próprio de serviços', () => {
    expect(cardServico).toContain('gerarLinkWhatsApp');
    expect(cardServico).toContain('WhatsApp');
  });

  it('descreve a conta de comprador segundo o chat e checkout de produtos', () => {
    expect(cadastro).toContain('Descubra produtos, converse com vendedores no chat da plataforma');
    expect(cadastro).toContain('e faça encomendas pelo carrinho.');
    expect(cadastro).not.toContain('Encontre produtos e contacte vendedores diretamente via\n                      WhatsApp.');
  });

  it('alinha os metadados de produtos ao chat e carrinho sem prometer pagamento ou entrega', () => {
    const texto = 'Descubra produtos, converse com vendedores no chat da plataforma e faça encomendas pelo carrinho.';
    expect(metadados).toContain(`name="description" content="${texto}"`);
    expect(metadados).toContain(`property="og:description" content="${texto}"`);
    expect(metadados).not.toContain('pagamentos online');
    expect(metadados).not.toContain('entrega nacional');
  });
});
