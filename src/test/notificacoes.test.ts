import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { eUrlDestinoInterna, normalizarNotificacao } from '@/services/notificacoes';

const base = {
  id: 'notificacao-1',
  utilizador_id: 'utilizador-1',
  contexto: 'compra',
  tipo: 'vendedor_confirmou',
  titulo: 'Encomenda confirmada',
  mensagem: 'O vendedor confirmou a tua encomenda.',
  entidade_tipo: 'encomenda',
  entidade_id: 'encomenda-1',
  url_destino: '/dashboard/encomendas/encomenda-1',
  lida: false,
  lida_em: null,
  metadata: {},
  criado_em: '2026-08-23T10:00:00.000Z',
};

const ler = (ficheiro: string) => readFileSync(resolve(process.cwd(), ficheiro), 'utf8');

describe('serviço de notificações', () => {
  it('normaliza apenas contratos de notificação completos e seguros para a UI', () => {
    expect(normalizarNotificacao(base)).toMatchObject({ id: 'notificacao-1', contexto: 'compra', lida: false });
    expect(normalizarNotificacao({ ...base, contexto: 'admin' })).toBeNull();
    expect(normalizarNotificacao({ ...base, lida: 'false' })).toBeNull();
    expect(normalizarNotificacao({ ...base, metadata: undefined })).toBeNull();
  });

  const id = '11111111-1111-4111-8111-111111111111';

  it.each([
    ['chat canónico', `/dashboard/conversas-produtos/${id}`],
    ['chat pré-compra legado', `/dashboard/mensagens/pre-compra/${id}`],
    ['compra', `/dashboard/compras/${id}`],
    ['encomenda', `/dashboard/encomendas/${id}`],
    ['tarefa', `/dashboard/tarefas/${id}`],
  ])('aceita individualmente a rota permitida de %s', (_nome, destino) => {
    expect(eUrlDestinoInterna(destino)).toBe(true);
  });

  it.each([
    ['URL externa', 'https://outro-site'],
    ['protocolo javascript', 'javascript:alert(1)'],
    ['URL protocol-relative', '//outro-site'],
    ['caminho interno arbitrário', `/dashboard/desconhecido/${id}`],
    ['UUID inválido', '/dashboard/encomendas/abc'],
    ['query string', `/dashboard/encomendas/${id}?seguinte=/dashboard`],
    ['fragmento', `/dashboard/encomendas/${id}#detalhe`],
    ['string vazia', ''],
    ['apenas espaços', '   '],
  ])('recusa individualmente %s', (_nome, destino) => {
    expect(eUrlDestinoInterna(destino)).toBe(false);
  });

  it('recusa ausência de destino', () => {
    expect(eUrlDestinoInterna(null)).toBe(false);
  });

  it('mantém os destinos de encomenda compatíveis com as rotas reais de cada papel', () => {
    const router = ler('src/paginas/dashboard/DashboardRouter.tsx');

    expect(router).toContain('<Route path="compras/:id" element={<ClienteEncomendaDetalhe rotaVoltar="/dashboard/compras"/>}/>');
    expect(router).toContain('<Route path="encomendas/:id" element={<VendedorEncomendaDetalhe/>}/>');
    expect(router).toContain('<Route path="tarefas/:id" element={protegerRotaOperacionalParceiro(<ParceiroTarefaDetalhe />)} />');
    expect(router).toContain('<Route path="mensagens/pre-compra/:conversaId" element={<ConversasPreCompra/>}/>');
  });

  it('mantém a comunicação institucional alinhada com a fase inicial', () => {
    const faixa = ler('src/componentes/FaixaConfianca.tsx');
    const comoFunciona = ler('src/paginas/PaginaComoFunciona.tsx');
    const rodape = ler('src/componentes/Rodape.tsx');

    for (const texto of ['Vendedores aprovados', 'Grosso e retalho', 'Chat seguro para produtos', 'Entregas no Huambo']) {
      expect(faixa).toContain(texto);
    }
    for (const texto of ['Chat pré-compra seguro para produtos', 'telefone não é partilhado nesse chat', 'Carrinho e checkout de produtos', 'Entregas no Huambo', 'Os serviços preservam o respetivo fluxo próprio de contacto.']) {
      expect(comoFunciona).toContain(texto);
    }
    expect(faixa).not.toContain('Contacto direto por WhatsApp');
    expect(faixa).not.toContain('Entrega em várias províncias');
    expect(comoFunciona).not.toContain('em toda Angola');
    expect(comoFunciona).not.toContain('não processa pagamentos nem intermedeia a negociação');
    expect(rodape).toContain('to="/como-funciona"');
    expect(rodape).not.toContain('Falar no WhatsApp');
    expect(rodape).not.toContain('wa.me/244000000000');
    expect(rodape).not.toContain('info@angrolink.co.ao');
    expect(rodape).not.toContain('+244 900 000 000');
  });
});
