import { supabase } from '@/services/supabase';

export interface InventarioProdutoVendedor {
  produtoId: string;
  controloAtivo: boolean;
  quantidadeFisica: string | null;
  quantidadeReservada: string | null;
  quantidadeDisponivel: string | null;
  unidade: string;
}

interface InventarioProdutoRpc {
  produto_id: string;
  controlo_ativo: boolean;
  quantidade_fisica: number | string | null;
  quantidade_reservada: number | string | null;
  quantidade_disponivel: number | string | null;
  unidade: string | null;
}

interface DefinirInventarioProdutoArgs {
  produtoId: string;
  controloAtivo: boolean;
  quantidadeFisica: string;
}

type RpcInventarioTemporaria = {
  (
    nome: 'obter_inventario_produto_vendedor',
    argumentos: { p_produto_id: string },
  ): ReturnType<typeof supabase.rpc>;
  (
    nome: 'definir_inventario_produto_vendedor',
    argumentos: {
      p_produto_id: string;
      p_controlo_ativo: boolean;
      p_quantidade_fisica: string;
    },
  ): ReturnType<typeof supabase.rpc>;
};

// TEMPORÁRIO: remover depois da migration e regeneração de database.types.ts.
const rpcInventario = supabase.rpc.bind(supabase) as unknown as RpcInventarioTemporaria;

function decimalOpcional(valor: number | string | null | undefined): string | null {
  if (valor === null || valor === undefined || valor === '') return null;
  return typeof valor === 'string' ? valor : String(valor);
}

function mapearInventario(dados: InventarioProdutoRpc): InventarioProdutoVendedor {
  return {
    produtoId: dados.produto_id,
    controloAtivo: dados.controlo_ativo === true,
    quantidadeFisica: decimalOpcional(dados.quantidade_fisica),
    quantidadeReservada: decimalOpcional(dados.quantidade_reservada),
    quantidadeDisponivel: decimalOpcional(dados.quantidade_disponivel),
    unidade: dados.unidade?.trim() || 'unidade',
  };
}

export function validarQuantidadeInventario(valor: string): string | null {
  const normalizado = valor.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,3})?$/.test(normalizado)) return null;

  const [inteiro, fracao] = normalizado.split('.');
  const inteiroCanonico = inteiro.replace(/^0+(?=\d)/, '');
  if (inteiroCanonico.length > 15) return null;

  // Mantém a parte decimal original (inclusive zeros à direita) e evita a
  // conversão binária de valores numeric(18,3) grandes no browser.
  return fracao === undefined ? inteiroCanonico : `${inteiroCanonico}.${fracao}`;
}

export function quantidadeDecimalPositiva(valor: string | null | undefined): boolean {
  return Boolean(valor && /^\d+(?:\.\d{1,3})?$/.test(valor) && /[1-9]/.test(valor));
}

export function erroUnidadeProdutoComReservas(erro: unknown): boolean {
  return erro instanceof Error
    && erro.message.includes('Não é possível alterar a unidade enquanto existirem quantidades reservadas.');
}

export function mensagemErroInventario(erro: unknown): string {
  const mensagem = erro instanceof Error ? erro.message : '';

  if (mensagem.includes('Sessão inválida')) {
    return 'A sua sessão expirou. Inicie sessão novamente para gerir o inventário.';
  }
  if (mensagem.includes('Produto não encontrado ou sem permissão')) {
    return 'Não foi possível aceder ao inventário deste produto.';
  }
  if (mensagem.includes('quantidade física é inválida')) {
    return 'Indique uma quantidade física válida, não negativa e com no máximo três casas decimais.';
  }
  if (mensagem.includes('inferior às reservas ativas')) {
    return 'A quantidade física não pode ser inferior à quantidade atualmente reservada.';
  }
  if (mensagem.includes('desativar o controlo de stock enquanto existirem reservas ativas')) {
    return 'Não é possível desativar o controlo de stock enquanto existirem quantidades reservadas.';
  }

  return 'Não foi possível atualizar o inventário agora. Tente novamente.';
}

export async function obterInventarioProdutoVendedor(produtoId: string): Promise<InventarioProdutoVendedor> {
  const { data, error } = await rpcInventario('obter_inventario_produto_vendedor', {
    p_produto_id: produtoId,
  });

  if (error || !data || typeof data !== 'object') {
    throw new Error(error?.message || 'Não foi possível carregar o inventário.');
  }

  return mapearInventario(data as unknown as InventarioProdutoRpc);
}

export async function definirInventarioProdutoVendedor({
  produtoId,
  controloAtivo,
  quantidadeFisica,
}: DefinirInventarioProdutoArgs): Promise<InventarioProdutoVendedor> {
  const { data, error } = await rpcInventario('definir_inventario_produto_vendedor', {
    p_produto_id: produtoId,
    p_controlo_ativo: controloAtivo,
    p_quantidade_fisica: quantidadeFisica,
  });

  if (error || !data || typeof data !== 'object') {
    throw new Error(error?.message || 'Não foi possível atualizar o inventário.');
  }

  return mapearInventario(data as unknown as InventarioProdutoRpc);
}
