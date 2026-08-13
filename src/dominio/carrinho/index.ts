export const CHAVE_CARRINHO = 'angrolink:carrinho:v1';
export const VERSAO_CARRINHO = 1;

export type TipoVendaCarrinho = 'grosso' | 'retalho' | 'ambos';

export type ItemCarrinho = {
  produto_id: string;
  vendedor_id: string;
  vendedor_nome: string;
  nome: string;
  imagem: string | null;
  unidade: string;
  quantidade: number;
  preco_retalho_centimos: number;
  preco_grosso_centimos: number | null;
  tipo_venda: TipoVendaCarrinho;
  quantidade_minima: number;
  quantidade_minima_grosso: number | null;
  disponivel: boolean;
  atualizado_em: string;
};

export type CarrinhoPersistido = {
  versao: typeof VERSAO_CARRINHO;
  itens: ItemCarrinho[];
};

export type GrupoCarrinho = {
  vendedor_id: string;
  vendedor_nome: string;
  itens: ItemCarrinho[];
};

export type ProdutoParaCta = {
  id?: string | null;
  vendedor_id?: string | null;
  disponivel?: boolean | null;
  publicado?: boolean | null;
};

export function produtoPodeUsarCtaTransacional(
  produto: ProdutoParaCta,
  vendedorElegivel: boolean,
  vendedorDono: boolean,
) {
  return Boolean(
    produto.id
      && produto.vendedor_id
      && produto.disponivel === true
      && produto.publicado !== false
      && vendedorElegivel
      && !vendedorDono,
  );
}

export function quantidadeMinimaItem(item: Pick<ItemCarrinho, 'tipo_venda' | 'quantidade_minima' | 'quantidade_minima_grosso'>) {
  if (item.tipo_venda === 'grosso') return item.quantidade_minima_grosso ?? item.quantidade_minima;
  return item.quantidade_minima;
}

export function normalizarQuantidadeCarrinho(quantidade: number, minimo: number) {
  if (!Number.isFinite(quantidade)) return minimo;
  return Math.max(minimo, Math.round(quantidade * 1000) / 1000);
}

export function precoUnitarioEstimadoCentimos(item: ItemCarrinho) {
  const grossoAplicavel = (item.tipo_venda === 'grosso' || item.tipo_venda === 'ambos')
    && item.preco_grosso_centimos !== null
    && item.quantidade_minima_grosso !== null
    && item.quantidade >= item.quantidade_minima_grosso;
  return grossoAplicavel ? item.preco_grosso_centimos! : item.preco_retalho_centimos;
}

export function subtotalEstimadoCentimos(item: ItemCarrinho) {
  return Math.round(precoUnitarioEstimadoCentimos(item) * item.quantidade);
}

export function subtotalCarrinhoCentimos(itens: ItemCarrinho[]) {
  return itens.reduce((total, item) => total + subtotalEstimadoCentimos(item), 0);
}

export function quantidadeTotalCarrinho(itens: ItemCarrinho[]) {
  return itens.reduce((total, item) => total + item.quantidade, 0);
}

/** Campos que alteram a preparação comercial do carrinho. */
export function assinaturaRevalidacaoCarrinho(itens: ItemCarrinho[]) {
  return itens
    .map((item) => [item.produto_id, item.vendedor_id, item.quantidade, item.unidade, item.tipo_venda, item.quantidade_minima, item.quantidade_minima_grosso].join(':'))
    .sort()
    .join('|');
}

/** Ignora atualizado_em: é metadado da sincronização, não uma razão para renderizar novamente. */
export function itensCarrinhoEquivalentes(atuais: ItemCarrinho[], proximos: ItemCarrinho[]) {
  if (atuais.length !== proximos.length) return false;
  return atuais.every((atual, indice) => {
    const proximo = proximos[indice];
    return Boolean(proximo)
      && atual.produto_id === proximo.produto_id
      && atual.vendedor_id === proximo.vendedor_id
      && atual.vendedor_nome === proximo.vendedor_nome
      && atual.nome === proximo.nome
      && atual.imagem === proximo.imagem
      && atual.unidade === proximo.unidade
      && atual.quantidade === proximo.quantidade
      && atual.preco_retalho_centimos === proximo.preco_retalho_centimos
      && atual.preco_grosso_centimos === proximo.preco_grosso_centimos
      && atual.tipo_venda === proximo.tipo_venda
      && atual.quantidade_minima === proximo.quantidade_minima
      && atual.quantidade_minima_grosso === proximo.quantidade_minima_grosso
      && atual.disponivel === proximo.disponivel;
  });
}

export function agruparItensPorVendedor(itens: ItemCarrinho[]): GrupoCarrinho[] {
  const grupos = new Map<string, GrupoCarrinho>();
  itens.forEach((item) => {
    const grupo = grupos.get(item.vendedor_id) ?? { vendedor_id: item.vendedor_id, vendedor_nome: item.vendedor_nome, itens: [] };
    grupo.itens.push(item);
    grupos.set(item.vendedor_id, grupo);
  });
  return [...grupos.values()];
}

export function restaurarCarrinho(valor: string | null): ItemCarrinho[] {
  if (!valor) return [];
  try {
    const dados = JSON.parse(valor) as Partial<CarrinhoPersistido>;
    if (dados.versao !== VERSAO_CARRINHO || !Array.isArray(dados.itens)) return [];
    return dados.itens.filter((item): item is ItemCarrinho => Boolean(
      item && typeof item.produto_id === 'string' && typeof item.vendedor_id === 'string'
        && typeof item.quantidade === 'number' && item.quantidade > 0,
    ));
  } catch {
    return [];
  }
}
