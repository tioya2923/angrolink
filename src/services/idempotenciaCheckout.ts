import type { ItemEncomendaSolicitado } from '@/dominio/encomendas';

export type IntencaoCheckoutGrupo = {
  modalidade: 'levantamento' | 'entrega';
  vendedorId: string;
  itens: ItemEncomendaSolicitado[];
  nomeDestinatario: string;
  telefoneDestinatario: string;
  observacoesCliente?: string;
  provincia?: string;
  municipio?: string;
  bairro?: string;
  enderecoDetalhado?: string;
  pontoReferencia?: string;
  instrucoesEntrega?: string;
};

type EntradaPersistida = { fingerprint: string; chave: string };

const PREFIXO_STORAGE = 'angrolink:checkout-idempotencia:v1';

function textoNormalizado(valor: string | undefined) {
  return (valor ?? '').trim().replace(/\s+/g, ' ');
}

function quantidadeNormalizada(quantidade: number) {
  return Number.isFinite(quantidade) ? quantidade.toFixed(3) : String(quantidade);
}

function chaveStorage(userId: string, intencao: IntencaoCheckoutGrupo) {
  return `${PREFIXO_STORAGE}:${userId}:${intencao.modalidade}:${intencao.vendedorId}`;
}

/** Não é autoritativo: apenas decide se a mesma intenção deve reutilizar UUID. */
export function criarFingerprintCheckout(intencao: IntencaoCheckoutGrupo) {
  const itens = [...intencao.itens]
    .map(item => ({ produto_id: item.produto_id, quantidade: quantidadeNormalizada(item.quantidade) }))
    .sort((a, b) => a.produto_id.localeCompare(b.produto_id));

  return JSON.stringify({
    modalidade: intencao.modalidade,
    vendedor_id: intencao.vendedorId,
    itens,
    nome_destinatario: textoNormalizado(intencao.nomeDestinatario),
    telefone_destinatario: textoNormalizado(intencao.telefoneDestinatario),
    observacoes_cliente: textoNormalizado(intencao.observacoesCliente),
    ...(intencao.modalidade === 'entrega' ? {
      provincia: textoNormalizado(intencao.provincia),
      municipio: textoNormalizado(intencao.municipio),
      bairro: textoNormalizado(intencao.bairro),
      endereco_detalhado: textoNormalizado(intencao.enderecoDetalhado),
      ponto_referencia: textoNormalizado(intencao.pontoReferencia),
      instrucoes_entrega: textoNormalizado(intencao.instrucoesEntrega),
    } : {}),
  });
}

export function obterChaveIdempotenciaCheckout(userId: string, intencao: IntencaoCheckoutGrupo) {
  const storageKey = chaveStorage(userId, intencao);
  const fingerprint = criarFingerprintCheckout(intencao);
  const bruto = sessionStorage.getItem(storageKey);

  if (bruto) {
    try {
      const entrada = JSON.parse(bruto) as Partial<EntradaPersistida>;
      if (entrada.fingerprint === fingerprint && typeof entrada.chave === 'string' && entrada.chave) {
        return entrada.chave;
      }
    } catch {
      // Uma entrada local inválida é substituída por uma nova intenção segura.
    }
  }

  const chave = crypto.randomUUID();
  sessionStorage.setItem(storageKey, JSON.stringify({ fingerprint, chave } satisfies EntradaPersistida));
  return chave;
}

/** Só remove a chave que acabou de ser processada localmente com sucesso. */
export function concluirChaveIdempotenciaCheckout(userId: string, intencao: IntencaoCheckoutGrupo, chave: string) {
  const storageKey = chaveStorage(userId, intencao);
  const bruto = sessionStorage.getItem(storageKey);
  if (!bruto) return;

  try {
    const entrada = JSON.parse(bruto) as Partial<EntradaPersistida>;
    if (entrada.chave === chave && entrada.fingerprint === criarFingerprintCheckout(intencao)) {
      sessionStorage.removeItem(storageKey);
    }
  } catch {
    // Não remover uma entrada que não pode ser confirmada como pertencente à intenção atual.
  }
}

export function mensagemErroCheckout(erro: unknown) {
  const mensagem = erro instanceof Error
    ? erro.message
    : typeof erro === 'object' && erro !== null && 'message' in erro && typeof erro.message === 'string'
      ? erro.message
      : '';
  const normalizada = mensagem.toLocaleLowerCase('pt-PT');

  if (normalizada.includes('stock suficiente')) return 'Já não existe stock suficiente para um dos produtos deste vendedor.';
  if (normalizada.includes('não existe ou não está disponível') || normalizada.includes('produto deixou de estar disponível')) return 'Um produto deste grupo deixou de estar disponível. Reveja o carrinho.';
  if (normalizada.includes('não está elegível') || normalizada.includes('não está disponível para receber')) return 'Este vendedor não está disponível para receber encomendas.';
  if (normalizada.includes('quantidade') || normalizada.includes('mínimo')) return 'Uma quantidade deste grupo deixou de ser válida. Reveja o carrinho.';
  if (normalizada.includes('território válido')) return 'Selecione uma província e um município válidos para a entrega.';
  if (normalizada.includes('chave de idempotência') || normalizada.includes('payload diferente') || normalizada.includes('intenção')) return 'Os dados desta tentativa foram alterados. Reveja o grupo e tente novamente.';
  if (normalizada.includes('sessão inválida') || normalizada.includes('sessao invalida')) return 'A sua sessão expirou. Entre novamente para confirmar a encomenda.';
  return 'Não foi possível confirmar a encomenda. Verifique a ligação e tente novamente.';
}
