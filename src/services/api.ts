import type { Database } from '@/types/database.types';
import type { DadosRenovacaoDocumentoParceiro } from '@/dominio/documentosParceiro';
import type { AtributosLogisticosProduto } from '@/dominio/logisticaProduto';

type ProdutoInsert = Database['public']['Tables']['produtos']['Insert'];
type ProdutoUpdate = Database['public']['Tables']['produtos']['Update'];

type ServicoInsert = Database['public']['Tables']['servicos']['Insert'];
type ServicoUpdate = Database['public']['Tables']['servicos']['Update'];

type VendedorUpdate = Database['public']['Tables']['vendedores']['Update'];
type VeiculoEntregaUpdate = Database['public']['Tables']['veiculos_entrega']['Update'];

export interface DadosOperacionaisVeiculoAtualizaveis {
  capacidade_kg: number;
  capacidade_volume_m3: number | null;
  possui_refrigeracao: boolean;
  possui_caixa_carga: boolean;
  aceita_paletes: boolean;
}

import { PlanoVendedor, Produto, Vendedor, Servico } from "@/tipos";
import {
  supabase,
  BUCKET_PRODUTOS,
  BUCKET_VENDEDORES,
  SUPABASE_STORAGE_PRODUTOS_URL,
} from "./supabase";
import { COLUNAS_VENDEDOR_PUBLICAS, listarVendedoresPublicos } from './vendedores';

// Get the active vendor ID from localStorage or session storage
const getVendedorAtivoId = (): string | null => {
  if (typeof window === "undefined") return null;

  const userRaw = localStorage.getItem("angrolink_auth_user");

  if (!userRaw) return null;

  try {
    const user = JSON.parse(userRaw);
    return user?.vendedor_id || null;
  } catch {
    return null;
  }
};

async function garantirVendedorAprovado(vendedorId: string) {
  const vendedor = await fetchMeuVendedor();
  if (!vendedor || vendedor.id !== vendedorId) {
    throw new Error('NÃ£o foi possÃ­vel validar o estado do vendedor.');
  }

  if (vendedor.status_aprovacao !== 'aprovado') {
    throw new Error(
      'A tua conta de vendedor nÃ£o estÃ¡ aprovada para gerir produtos ou serviÃ§os.'
    );
  }
}


// =============================
// UTILS
// =============================
const tiposVendaPermitidos = ["retalho", "grosso", "ambos"];

// Normaliza valores booleanos vindos do Supabase.
const toBool = (v: any, defaultValue = false) => {
  if (v === null || v === undefined) return defaultValue;
  return v === true || v === "true" || v === 1;
};


// Normaliza texto para comparar categorias sem problemas de acentos/maiÃºsculas.
export const normalizarTexto = (texto: string) =>
  texto
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

// Normaliza produto para evitar diferenÃ§as entre pÃ¡ginas pÃºblicas e dashboard.
const normalizarProduto = (p: any): Produto => {
  const nomeCategoria = p.categoria?.nome || "Sem categoria";
  const imagem = p.imagem_url || "/placeholder.png";

  return {
    ...p,

    vendedor: p.vendedor || null,
    categoria: p.categoria || null,

    tipo_venda: String(p.tipo_venda || "").toLowerCase().trim(),

    destaque: toBool(p.destaque, false),
    disponivel: toBool(p.disponivel, true),

    imagem_url: p.imagem_url || null,
    imagem_principal: imagem,

    categoria_nome: nomeCategoria,
  } as Produto;
};

const normalizarVendedor = (v: any): Vendedor => {
  return {
    ...v,

    email: v.email || null,
    telefone_whatsapp: v.telefone_whatsapp || null,
    whatsapp: v.whatsapp || null,
    nome_responsavel: v.nome_responsavel || null,

    provincia: v.provincia || "",
    municipio: v.municipio || "",

    tipo_vendedor: normalizarTipoVendedor(v.tipo_vendedor),
    plano: v.plano || "gratuito",

    verificado: toBool(v.verificado, false),
    entrega_disponivel: toBool(v.entrega_disponivel, false),
    venda_grosso: toBool(v.venda_grosso, false),
    venda_retalho: toBool(v.venda_retalho, false),
    compra_produtores: toBool(v.compra_produtores, false),
    entrega_outras_provincias: toBool(v.entrega_outras_provincias, false),
    venda_presencial: toBool(v.venda_presencial, false),

    status_aprovacao: v.status_aprovacao || "pendente",
  } as Vendedor;
};

type ItemPublicoComVendedorId = {
  vendedor_id: string | null;
};

async function associarVendedoresPublicos<T extends ItemPublicoComVendedorId>(
  itens: T[],
): Promise<Array<T & { vendedor: Vendedor }>> {
  const vendedores = await listarVendedoresPublicos(
    itens.flatMap((item) => item.vendedor_id ? [item.vendedor_id] : []),
  );
  const vendedoresPorId = new Map(
    vendedores.map((vendedor) => [vendedor.id, normalizarVendedor(vendedor)]),
  );

  return itens.flatMap((item) => {
    const vendedor = item.vendedor_id
      ? vendedoresPorId.get(item.vendedor_id)
      : undefined;
    return vendedor ? [{ ...item, vendedor }] : [];
  });
}

// =============================
// FILTROS
// =============================

interface FetchProdutosParams {
  provincia?: string;
  municipio?: string;
  tipoComprador?: "casa" | "negocio";
  categoria?: string;
  pesquisa?: string;
}

// =============================
// FETCH PRODUTOS
// =============================

export async function fetchProdutos(
  params?: FetchProdutosParams
): Promise<Produto[]> {
  let query = supabase
    .from("produtos")
    .select(`
      *,
      categoria:categorias (*)
    `)
    .eq("disponivel", true)
    .eq("publicado", true)
    .order("criado_em", { ascending: false });

  if (params?.categoria) {
    query = query.eq("categoria_id", params.categoria);
  }

  if (params?.provincia) {
    query = query.ilike("provincia", `%${params.provincia}%`);
  }

  if (params?.municipio) {
    query = query.ilike("municipio", `%${params.municipio}%`);
  }

  if (params?.pesquisa) {
    query = query.ilike("nome_produto", `%${params.pesquisa}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao buscar produtos:", error);
    throw new Error("Erro ao carregar produtos");
  }

  let produtos = (await associarVendedoresPublicos(data || [])).map(normalizarProduto);

  if (params?.tipoComprador === "casa") {
    produtos = produtos.filter(
      p => p.tipo_venda === "retalho" || p.tipo_venda === "ambos"
    );
  }

  if (params?.tipoComprador === "negocio") {
    produtos = produtos.filter(
      p => p.tipo_venda === "grosso" || p.tipo_venda === "ambos"
    );
  }

  return produtos;
}

// =============================
// PRODUTO POR ID
// =============================

export async function fetchProdutoPorId(id: string): Promise<Produto | null> {
  const { data, error } = await supabase
    .from("produtos")
    .select(`
      *,
      categoria:categorias (*)
    `)
    .eq("id", id)
    .eq("disponivel", true)
    .eq("publicado", true)
    .single();

  if (error) {
    console.error("Erro ao buscar produto:", error);
    return null;
  }

  const [produto] = await associarVendedoresPublicos([data]);
  return produto ? normalizarProduto(produto) : null;
}

// Leitura privada usada no formulÃ¡rio de ediÃ§Ã£o. NÃ£o aplica os filtros do
// catÃ¡logo pÃºblico, para que o vendedor possa editar anÃºncios pausados.
export async function fetchProdutoParaEdicao(
  id: string,
  vendedorId: string,
): Promise<Produto | null> {
  const { data, error } = await supabase
    .from('produtos')
    .select('*, categoria:categorias (*)')
    .eq('id', id)
    .eq('vendedor_id', vendedorId)
    .maybeSingle();

  if (error) {
    console.error('Erro ao carregar produto para ediÃ§Ã£o:', error);
    return null;
  }

  return data ? normalizarProduto(data) : null;
}

// =============================
// PRODUTOS RELACIONADOS
// =============================

export async function fetchProdutosRelacionados(
  categoriaId: string,
  excluirId: string
): Promise<Produto[]> {
  const { data, error } = await supabase
    .from("produtos")
    .select(`
      *,
      categoria:categorias (*)
    `)
    .eq("categoria_id", categoriaId)
    .neq("id", excluirId)
    .eq("disponivel", true)
    .eq("publicado", true)
    .order("criado_em", { ascending: false })
    .limit(4);

  if (error) {
    console.error("Erro ao buscar relacionados:", error);
    return [];
  }

  return (await associarVendedoresPublicos(data || [])).map(normalizarProduto);
}

// =============================
// VENDEDOR
// =============================

export async function fetchVendedorPorId(id: string): Promise<Vendedor | null> {
  try {
    const [vendedor] = await listarVendedoresPublicos([id]);
    return vendedor ? normalizarVendedor(vendedor) : null;
  } catch (error) {
    console.error("Erro ao buscar vendedor:", error);
    return null;
  }
}

// =============================
// PRODUTOS DO VENDEDOR
// =============================

export async function fetchProdutosPorVendedor(
  vendedorId: string
): Promise<Produto[]> {
  const { data, error } = await supabase
    .from("produtos")
    .select(`
      *,
      categoria:categorias (*)
    `)
    .eq("vendedor_id", vendedorId)
    .order("criado_em", { ascending: false });

  if (error) {
    console.error("Erro ao buscar produtos do vendedor:", JSON.stringify(error, null, 2));
    return [];
  }

  return (await associarVendedoresPublicos(data || [])).map(normalizarProduto);
}

// =============================
// CATEGORIAS
// =============================

export async function fetchCategorias() {
  const { data, error } = await supabase
    .from("categorias")
    .select("*")
    .order("nome");

  if (error) {
    console.error("Erro ao buscar categorias:", error);
    return [];
  }

  return data || [];
}

// =============================
// UPLOAD IMAGEM
// =============================
export async function uploadImagemProduto(file: File) {
  // =============================
  // VALIDAÃ‡ÃƒO IMAGEM
  // =============================
  const tiposPermitidos = ["image/jpeg", "image/png", "image/webp"];

  if (!tiposPermitidos.includes(file.type)) {
    throw new Error("Formato de imagem invÃ¡lido");
  }

  if (file.size > 3 * 1024 * 1024) {
    throw new Error("Imagem demasiado grande (mÃ¡x 3MB)");
  }

  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };

  const extensao =
    mimeToExt[file.type] ||
    file.name.split('.').pop()?.toLowerCase() ||
    'jpg';
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const utilizadorId = authData.user?.id;

  if (authError || !utilizadorId) {
    throw new Error("Inicie sessão para enviar uma imagem de produto.");
  }

  const fileName = `${utilizadorId}/${Date.now()}-${Math.random()
    .toString(36)
    .substring(2)}.${extensao}`;
  const { error } = await supabase.storage
    .from(BUCKET_PRODUTOS)
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("Erro upload imagem:", error);

    throw new Error(
      `Erro upload imagem: ${error.message || "desconhecido"}`
    );
  }

  const { data } = supabase.storage
    .from(BUCKET_PRODUTOS)
    .getPublicUrl(fileName);

  if (!data?.publicUrl) {
    throw new Error("NÃ£o foi possÃ­vel gerar URL pÃºblica da imagem");
  }

  return data.publicUrl;
}

// =============================
// UPLOAD FOTO VENDEDOR
// =============================
// Usado para foto de perfil do vendedor.
// Fica separado do bucket de produtos.
export async function uploadImagemVendedor(file: File) {
  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];

  if (!tiposPermitidos.includes(file.type)) {
    throw new Error('Formato de imagem invÃ¡lido. Use JPG, PNG ou WEBP.');
  }

  if (file.size > 3 * 1024 * 1024) {
    throw new Error('Imagem demasiado grande (mÃ¡x 3MB)');
  }

  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };

  const extensao =
    mimeToExt[file.type] ||
    file.name.split('.').pop()?.toLowerCase() ||
    'jpg';

  const { data: dadosAuth, error: erroAuth } = await supabase.auth.getUser();
  const user = dadosAuth.user;

  if (erroAuth || !user) {
    throw new Error('Não foi possível identificar a sessão para enviar a imagem.');
  }

  const fileName = `${user.id}/perfil-${crypto.randomUUID()}.${extensao}`;

  const { error } = await supabase.storage
    .from(BUCKET_VENDEDORES)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    console.error('Erro upload imagem vendedor:', error);
    throw new Error('Não foi possível enviar a imagem.');
  }

  const { data } = supabase.storage
    .from(BUCKET_VENDEDORES)
    .getPublicUrl(fileName);

  if (!data?.publicUrl) {
    throw new Error('NÃ£o foi possÃ­vel gerar URL pÃºblica da imagem');
  }

  return data.publicUrl;
}

// =============================
// ELIMINAR IMAGEM DO STORAGE
// =============================
// Remove do Supabase Storage o ficheiro associado a uma URL pÃºblica.
export async function deleteImagemProdutoPorUrl(url?: string | null) {
  if (!url) return;

  try {
    const partes = url.split(`/${BUCKET_PRODUTOS}/`);
    const caminhoFicheiro = partes[1];

    if (!caminhoFicheiro) {
      console.warn("NÃ£o foi possÃ­vel extrair o caminho da imagem:", url);
      return;
    }

    const { error } = await supabase.storage
      .from(BUCKET_PRODUTOS)
      .remove([caminhoFicheiro]);

    if (error) {
      console.error("Erro ao remover imagem do Storage:", error);
    }
  } catch (err) {
    console.error("Erro inesperado ao remover imagem:", err);
  }
}

// =============================
// CRIAR PRODUTO
// =============================

interface CriarProdutoParams extends Partial<AtributosLogisticosProduto> {
  vendedor_id: string;
  nome_produto: string;
  descricao?: string;
  categoria_id: string;
  subcategoria?: string;
  preco_aproximado: number;
  preco_promocional?: number | null;
  unidade: string;
  tipo_venda: "retalho" | "grosso" | "ambos";
  municipio: string;
  provincia: string;
  imagem_url?: string | null;
  quantidade_minima?: number;
}

export async function fetchMeuVendedor(opcoes?: { lancarErro?: boolean }): Promise<Vendedor | null> {
  const { data, error } = await supabase.rpc('obter_meu_vendedor');
  if (error) {
    console.error('Erro ao buscar o próprio vendedor:', error);
    if (opcoes?.lancarErro) throw error;
    return null;
  }
  return data?.[0] ? normalizarVendedor(data[0]) : null;
}


export async function criarProduto(params: CriarProdutoParams) {
  // Evita guardar URLs externas ou invÃ¡lidas na coluna imagem_url.
  // =============================
  // VALIDAÃ‡ÃƒO FORTE
  // =============================
  if (!params.nome_produto?.trim()) {
    throw new Error("Nome do produto Ã© obrigatÃ³rio");
  }

  if (!params.categoria_id) {
    throw new Error("Categoria invÃ¡lida");
  }

  if (!params.preco_aproximado || params.preco_aproximado <= 0) {
    throw new Error("PreÃ§o invÃ¡lido");
  }

  if (
    params.preco_promocional != null &&
    (params.preco_promocional <= 0 || params.preco_promocional >= params.preco_aproximado)
  ) {
    throw new Error("PreÃ§o promocional deve ser positivo e inferior ao preÃ§o normal");
  }

  if (!params.unidade) {
    throw new Error("Unidade obrigatÃ³ria");
  }

  //const tiposVendaPermitidos = ["retalho", "grosso", "ambos"];

  if (!tiposVendaPermitidos.includes(params.tipo_venda)) {
    throw new Error("Tipo de venda invÃ¡lido");
  }

  if (params.quantidade_minima !== undefined && params.quantidade_minima < 1) {
  throw new Error("Quantidade mÃ­nima invÃ¡lida");
  }


  if (
    params.imagem_url &&
    !params.imagem_url.startsWith(SUPABASE_STORAGE_PRODUTOS_URL)
  ) {
    throw new Error("URL de imagem invÃ¡lida");
  }

  if (!params.vendedor_id) {
    throw new Error("Vendedor invÃ¡lido");
  }

  console.log('VENDEDOR_ID USADO AO CRIAR:', params.vendedor_id);

  await garantirVendedorAprovado(params.vendedor_id);


  const { data, error } = await supabase
    .from("produtos")
    .insert([
      {
        nome_produto: params.nome_produto,
        descricao: params.descricao || "",
        categoria_id: params.categoria_id,
        subcategoria: params.subcategoria || null,
        preco_aproximado: params.preco_aproximado,
        preco_promocional: params.preco_promocional ?? null,
        unidade: params.unidade,
        tipo_venda: params.tipo_venda,
        municipio: params.municipio,
        provincia: params.provincia,
        imagem_url: params.imagem_url || null,
        quantidade_minima: params.quantidade_minima ?? 1,
        peso_por_unidade_comercial_kg: params.peso_por_unidade_comercial_kg ?? null,
        volume_por_unidade_comercial_m3: params.volume_por_unidade_comercial_m3 ?? null,
        requer_refrigeracao: params.requer_refrigeracao ?? null,
        requer_caixa_carga: params.requer_caixa_carga ?? null,
        requer_paletes: params.requer_paletes ?? null,
        vendedor_id: params.vendedor_id,
        disponivel: true,
        destaque: false,
      },
    ])
    .select(`
      *,
      vendedor:vendedores (${COLUNAS_VENDEDOR_PUBLICAS}),
      categoria:categorias (*)
    `)
    .single();

  if (error) {
    console.error("Erro ao criar produto:", error);
    throw new Error("Erro ao criar produto");
  }

  return normalizarProduto(data);
}

// =============================
// ATUALIZAR PRODUTO
// =============================

export const updateProduto = async (id: string, dados: ProdutoUpdate) => {
  const vendedorId = getVendedorAtivoId();
  if (!vendedorId) {
    throw new Error("Vendedor nÃ£o autenticado");
  }

  await garantirVendedorAprovado(vendedorId);

  const { data, error } = await supabase
    .from("produtos")
    .update({
      ...dados,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("vendedor_id", vendedorId)
    .select(`
      *,
      vendedor:vendedores (${COLUNAS_VENDEDOR_PUBLICAS}),
      categoria:categorias (*)
    `)
    .single();

  if (error) {
    console.error("Erro ao atualizar produto:", error);

    console.log("message:", error.message);
    console.log("details:", error.details);
    console.log("hint:", error.hint);
    console.log("code:", error.code);

    throw error;
  }

  return normalizarProduto(data);
};

// =============================
// ELIMINAR PRODUTO
// =============================

export const deleteProduto = async (id: string) => {
  const vendedorId = getVendedorAtivoId();
  if (!vendedorId) {
    throw new Error("Vendedor nÃ£o autenticado");
  }

  await garantirVendedorAprovado(vendedorId);

  const { error } = await supabase
    .from("produtos")
    .delete()
    .eq("id", id)
    .eq("vendedor_id", vendedorId);

  if (error) {
    console.error("Erro ao eliminar produto:", error);
    throw error;
  }

  return true;
};

// =============================
// SERVIÃ‡OS
// =============================

interface CriarServicoParams {
  vendedor_id?: string;
  nome_servico: string;
  tipo_servico?: string;
  descricao?: string;
  preco_estimado?: number | null;
  preco_promocional?: number | null;
  provincia?: string;
  municipio?: string;
  zona_atuacao?: string;
  imagem_url?: string | null;

  nome_prestador?: string;
  telefone_whatsapp?: string;
}

const normalizarServico = (s: any): Servico => {
  return {
    ...s,
    vendedor: s.vendedor || null,
    disponivel: toBool(s.disponivel, true),
    destaque: toBool(s.destaque, false),
    imagem_url: s.imagem_url || null,
  } as Servico;
};

export async function criarServico(params: CriarServicoParams) {
  if (!params.nome_servico?.trim()) {
    throw new Error("Nome do serviÃ§o Ã© obrigatÃ³rio");
  }

  if (!params.vendedor_id) {
    throw new Error("Vendedor invÃ¡lido");
  }

  await garantirVendedorAprovado(params.vendedor_id);

  const { data, error } = await supabase
  .from("servicos")
  .insert([
    {
      nome_servico: params.nome_servico,
      tipo_servico: params.tipo_servico || null,
      descricao: params.descricao || "",
      preco_estimado: params.preco_estimado || null,
      preco_promocional: params.preco_promocional || null,
      provincia: params.provincia || "",
      municipio: params.municipio || "",
      zona_atuacao: params.zona_atuacao || "",
      imagem_url: params.imagem_url || null,

      nome_prestador: params.nome_prestador || null,
      telefone_whatsapp: params.telefone_whatsapp || null,

      vendedor_id: params.vendedor_id || null,

      disponivel: true,
      destaque: false,
    },
  ])
  .select(`
    *,
    vendedor:vendedores (${COLUNAS_VENDEDOR_PUBLICAS})
  `)
  .single();

  if (error) {
    console.error("Erro ao criar serviÃ§o:", error);
    throw new Error("Erro ao criar serviÃ§o");
  }

  return normalizarServico(data);
}

export async function fetchServicos(): Promise<Servico[]> {
  const { data, error } = await supabase
    .from("servicos")
    .select(`
      *
    `)
    .eq("disponivel", true)
    .eq("publicado", true)
    .order("criado_em", { ascending: false });

  if (error) {
    console.error("Erro ao buscar serviÃ§os:", error);
    return [];
  }

  return (await associarVendedoresPublicos(data || [])).map(normalizarServico);
}

export async function fetchServicosPorVendedor(
  vendedorId: string
): Promise<Servico[]> {
  const { data, error } = await supabase
    .from("servicos")
    .select('*')
    .eq("vendedor_id", vendedorId)
    .order("criado_em", { ascending: false });

  if (error) {
    console.error("Erro ao buscar serviÃ§os do vendedor:", JSON.stringify(error, null, 2));
    return [];
  }

  return (await associarVendedoresPublicos(data || [])).map(normalizarServico);
}

export async function updateServico(id: string, dados: any) {
  const vendedorId = getVendedorAtivoId();
  if (!vendedorId) {
    throw new Error("Vendedor nÃ£o autenticado");
  }

  await garantirVendedorAprovado(vendedorId);

  const { data, error } = await supabase
    .from("servicos")
    .update(dados)
    .eq("id", id)
    .eq("vendedor_id", vendedorId)
    .select(`
      *,
      vendedor:vendedores (${COLUNAS_VENDEDOR_PUBLICAS})
    `)
    .single();

  if (error) {
    console.error("Erro ao atualizar serviÃ§o:", error);
    throw error;
  }

  return normalizarServico(data);
}

export async function deleteServico(id: string) {
  const vendedorId = getVendedorAtivoId();
  if (!vendedorId) {
    throw new Error("Vendedor nÃ£o autenticado");
  }

  await garantirVendedorAprovado(vendedorId);

  const { error } = await supabase
    .from("servicos")
    .delete()
    .eq("id", id)
    .eq("vendedor_id", vendedorId);

  if (error) {
    console.error("Erro ao eliminar serviÃ§o:", error);
    throw error;
  }

  return true;
}

export async function fetchServicoPorId(id: string): Promise<Servico | null> {
  const { data, error } = await supabase
    .from("servicos")
    .select(`
      *
    `)
    .eq("id", id)
    .eq("disponivel", true)
    .eq("publicado", true)
    .single();

  if (error) {
    console.error("Erro ao buscar serviÃ§o:", error);
    return null;
  }

  const [servico] = await associarVendedoresPublicos([data]);
  return servico ? normalizarServico(servico) : null;
}

// Leitura privada usada no formulÃ¡rio de ediÃ§Ã£o de serviÃ§os.
export async function fetchServicoParaEdicao(
  id: string,
  vendedorId: string,
): Promise<Servico | null> {
  const { data, error } = await supabase
    .from('servicos')
    .select('*')
    .eq('id', id)
    .eq('vendedor_id', vendedorId)
    .maybeSingle();

  if (error) {
    console.error('Erro ao carregar serviÃ§o para ediÃ§Ã£o:', error);
    return null;
  }

  return data ? normalizarServico(data) : null;
}

// =============================
// ATUALIZAR VENDEDOR
// =============================
export async function updateVendedor(vendedorId: string, dados: any) {
  const vendedor = await fetchMeuVendedor();
  if (!vendedor || vendedor.id !== vendedorId) {
    throw new Error('Não tens permissão para atualizar este perfil.');
  }

  const { error } = await supabase
    .from("vendedores")
    .update(dados)
    .eq("id", vendedorId);

  if (error) {
    console.error("Erro ao atualizar vendedor:", error);
    throw error;
  }

  const atualizado = await fetchMeuVendedor();
  if (!atualizado) throw new Error('Não foi possível confirmar a atualização do perfil.');
  return atualizado;
}

// =============================
// ESTATÃSTICAS â€” PRODUTOS
// =============================
export async function incrementarVisualizacaoProduto(id: string) {

  console.log("RPC Produto ->", id);

  const { data, error } = await supabase.rpc(
    "incrementar_visualizacao_produto",
    {
      produto_id_param: id,
    }
  );

  console.log("RPC RESULT:", data);
  console.log("RPC ERROR:", error);

  if (error) {
    console.error(error);
  }
}

export async function incrementarCliqueWhatsappProduto(id: string) {
  const { error } = await supabase.rpc('incrementar_clique_whatsapp_produto', {
    produto_id_param: id,
  });

  if (error) {
    console.error('Erro ao incrementar clique WhatsApp do produto:', error);
  }
}

// =============================
// ESTATÃSTICAS â€” SERVIÃ‡OS
// =============================
export async function incrementarVisualizacaoServico(id: string) {

  console.log("RPC ServiÃ§o ->", id);

  const { data, error } = await supabase.rpc('incrementar_visualizacao_servico', {
    servico_id_param: id,
  });

  console.log("RPC RESULT:", data);
  console.log("RPC ERROR:", error);

  if (error) {
    console.error('Erro ao incrementar visualizaÃ§Ã£o do serviÃ§o:', error);
  }
}

export async function incrementarCliqueWhatsappServico(id: string) {
  const { error } = await supabase.rpc('incrementar_clique_whatsapp_servico', {
    servico_id_param: id,
  });

  if (error) {
    console.error('Erro ao incrementar clique WhatsApp do serviÃ§o:', error);
  }
}


// =============================
// HISTÃ“RICO DE CONTACTOS
// =============================

export async function guardarHistoricoContacto({
  cliente_id,
  produto,
}: {
  cliente_id: string;
  produto: any;
}) {
  if (!cliente_id || !produto?.id) return;

  const agora = new Date().toISOString();

  const {
    data: existente,
    error: erroBusca,
  } = await supabase
    .from('historico_contactos')
    .select('id')
    .eq('cliente_id', cliente_id)
    .eq('produto_id', produto.id)
    .maybeSingle();
    console.log('Produto:', produto.id);
    console.log('Cliente:', cliente_id);
    console.log('Existente:', existente);
    console.log('Erro busca:', erroBusca);

  if (erroBusca) {
    console.error(
      'Erro ao verificar histÃ³rico:',
      erroBusca
    );
    return;
  }

  // JÃ¡ existe â†’ atualiza apenas o Ãºltimo contacto
  if (existente) {
    console.log('Vou atualizar...');

    const { error } = await supabase
      .from('historico_contactos')
      .update({
        atualizado_em: agora,
      })
      .eq('id', existente.id);

    if (error) {
      console.error(
        'Erro ao atualizar histÃ³rico:',
        error
      );
    }

    console.log('Erro update:', error);

    return;
  }

  // NÃ£o existe â†’ cria o histÃ³rico
  const { error, } = await supabase
  
    .from('historico_contactos')
    .insert({
      cliente_id,
      produto_id: produto.id,
      vendedor_id:
        produto.vendedor_id || null,
      nome_produto:
        produto.nome_produto || 'Produto',
      nome_vendedor:
        produto.vendedor?.nome_comercial ||
        produto.nome_vendedor ||
        'Vendedor',
      criado_em: agora,
      atualizado_em: agora,
    });

  if (error) {
    console.error(
      'Erro ao guardar histÃ³rico:',
      error
    );
  }
}

// =============================
// VISUALIZAÃ‡Ã•ES DE PRODUTOS POR CLIENTE
// =============================

export async function guardarVisualizacaoProduto({
  cliente_id,
  produto,
}: {
  cliente_id: string;
  produto: any;
}) {
  if (!cliente_id || !produto?.id) return;

  const { error } = await supabase
    .from('visualizacoes_produtos')
    .insert({
      cliente_id,
      produto_id: produto.id,
      vendedor_id: produto.vendedor_id || null,
    });

  if (error) {
    console.error('Erro ao guardar visualizaÃ§Ã£o do produto:', error);
  }
}



// =============================
// VISUALIZAÃ‡Ã•ES DE SERVIÃ‡OS POR CLIENTE
// =============================

export async function guardarVisualizacaoServico({
  cliente_id,
  servico,
}: {
  cliente_id: string;
  servico: any;
}) {
  if (!cliente_id || !servico?.id) return;

  const { error } = await supabase
    .from('visualizacoes_servicos')
    .insert({
      cliente_id,
      servico_id: servico.id,
      vendedor_id: servico.vendedor_id || null,
    });

  if (error) {
    console.error('Erro ao guardar visualizaÃ§Ã£o do serviÃ§o:', error);
  }
}


// =============================
// ADMIN â€” VENDEDOR APROVAÃ‡ÃƒO
// =============================

export async function fetchVendedoresAdmin(): Promise<Vendedor[]> {
  const { data, error } = await supabase.rpc('listar_vendedores_admin');

  if (error) {
    console.error('Erro ao buscar vendedores:', error);
    return [];
  }

  return (data ?? []).map(normalizarVendedor);
}

export async function atualizarEstadoVendedor(
  vendedorId: string,
  estado: VendedorUpdate['status_aprovacao'],
  _adminId?: string | null,
  motivoRejeicao?: string | null,
) {
  const { error } = await supabase.rpc('atualizar_estado_vendedor_admin', { p_vendedor_id: vendedorId, p_estado: estado, p_motivo_rejeicao: motivoRejeicao?.trim() || undefined });

  if (error) {
    console.error('Erro ao atualizar estado:', error);
    throw error;
  }

  const atualizado = (await fetchVendedoresAdmin()).find((v) => v.id === vendedorId);
  if (!atualizado) throw new Error('Não foi possível confirmar a atualização do vendedor.');
  return atualizado;
}

// =============================
// ADMIN â€” PARCEIROS DE ENTREGAS
// =============================

export type EstadoParceiroAdmin =
  | 'rascunho'
  | 'documentos_pendentes'
  | 'em_analise'
  | 'aprovado'
  | 'rejeitado'
  | 'suspenso'
  | 'documentacao_expirada';

export async function fetchParceirosEntregaAdmin() {
  const db = supabase;
  const { data: parceiros, error } = await db
    .from('parceiros_entrega')
    .select('*')
    .order('criado_em', { ascending: false });

  if (error) {
    console.error('Erro ao buscar parceiros de entregas:', error);
    throw error;
  }

  if (!parceiros?.length) return [];

  // Carregamento explÃ­cito: a cache de relaÃ§Ãµes do PostgREST pode devolver
  // listas vazias num select aninhado, embora os dados existam nas tabelas.
  const ids = parceiros.map((parceiro: any) => parceiro.id);
  const [veiculos, areas, documentos] = await Promise.all([
    db.from('veiculos_entrega').select('*').in('parceiro_id', ids),
    db.from('areas_cobertura_entrega').select('*').in('parceiro_id', ids),
    db.from('documentos_parceiro_entrega').select('*').in('parceiro_id', ids),
  ]);

  if (veiculos.error) throw veiculos.error;
  if (areas.error) throw areas.error;
  if (documentos.error) throw documentos.error;

  return parceiros.map((parceiro: any) => ({
    ...parceiro,
    veiculos_entrega: (veiculos.data || []).filter((veiculo: any) => veiculo.parceiro_id === parceiro.id),
    areas_cobertura_entrega: (areas.data || []).filter((area: any) => area.parceiro_id === parceiro.id),
    documentos_parceiro_entrega: (documentos.data || []).filter((documento: any) => documento.parceiro_id === parceiro.id),
  }));
}

export async function atualizarEstadoParceiroEntrega(
  parceiroId: string,
  estado: EstadoParceiroAdmin,
  motivo?: string | null,
  adminId?: string | null,
) {
  const db = supabase;
  const motivoLimpo = motivo?.trim() || null;

  if ((estado === 'rejeitado' || estado === 'suspenso') && !motivoLimpo) {
    throw new Error('Indique o motivo desta decisÃ£o.');
  }

  if (estado === 'aprovado') {
    // A aprovação do parceiro e dos veículos tem de ocorrer na mesma
    // transação autorizada pelo servidor. Não há fallback para updates diretos.
    const { data, error } = await db.rpc(
      'aprovar_parceiro_entrega_admin',
      { p_parceiro_id: parceiroId },
    );

    if (error) throw error;
    return data;
  }

  const dados: Record<string, unknown> = {
    estado,
    disponibilidade: false,
  };

  if (estado === 'rejeitado') {
    dados.motivo_rejeicao = motivoLimpo;
    dados.motivo_suspensao = null;
  } else if (estado === 'suspenso') {
    dados.motivo_suspensao = motivoLimpo;
  } else {
    dados.motivo_rejeicao = null;
    dados.motivo_suspensao = null;
  }

  const { data, error } = await db
    .from('parceiros_entrega')
    .update(dados)
    .eq('id', parceiroId)
    .select('*')
    .single();

  if (error) throw error;

  return data;
}

export async function atualizarEstadoDocumentoParceiro(
  documentoId: string,
  estado: 'aprovado' | 'rejeitado',
  adminId?: string | null,
  motivo?: string | null,
) {
  const db = supabase;
  const motivoLimpo = motivo?.trim() || null;
  if (estado === 'rejeitado' && !motivoLimpo) throw new Error('Indique o motivo da rejeiÃ§Ã£o do documento.');

  const { data, error } = await db
    .from('documentos_parceiro_entrega')
    .update({
      estado,
      motivo_rejeicao: estado === 'rejeitado' ? motivoLimpo : null,
      analisado_por: adminId || null,
      analisado_em: new Date().toISOString(),
    })
    .eq('id', documentoId)
    .select('*')
    .single();

  if (error) throw error;

  if (estado === 'rejeitado') {
    const { error: erroParceiro } = await db
      .from('parceiros_entrega')
      .update({ estado: 'documentos_pendentes', disponibilidade: false })
      .eq('id', data.parceiro_id);
    if (erroParceiro) throw erroParceiro;
  }

  return data;
}

export async function reenviarDocumentoParceiro(
  documentoId: string,
  frente: File,
  verso: File,
  renovacao?: DadosRenovacaoDocumentoParceiro,
) {
  const { data: auth, error: erroAuth } = await supabase.auth.getUser();
  if (erroAuth || !auth.user) throw new Error('SessÃ£o invÃ¡lida. Entre novamente na sua conta.');

  const enviar = async (ficheiro: File, lado: 'frente' | 'verso') => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(ficheiro.type) || ficheiro.size > 3 * 1024 * 1024) {
      throw new Error('Use imagens JPG, PNG ou WEBP atÃ© 3 MB.');
    }
    const extensao = ficheiro.name.split('.').pop() || 'jpg';
    const caminho = `${auth.user!.id}/reenvio-${documentoId}-${lado}-${crypto.randomUUID()}.${extensao}`;
    const { error } = await supabase.storage.from('documentos-parceiros').upload(caminho, ficheiro, { contentType: ficheiro.type });
    if (error) throw error;
    return caminho;
  };

  const novosCaminhos: string[] = [];
  try {
    const frentePath = await enviar(frente, 'frente');
    novosCaminhos.push(frentePath);
    const versoPath = await enviar(verso, 'verso');
    novosCaminhos.push(versoPath);

    const resultado = renovacao
      ? await supabase.rpc('reenviar_documento_parceiro', {
          p_documento_id: documentoId,
          p_frente_path: frentePath,
          p_verso_path: versoPath,
          p_numero_documento: renovacao.numeroDocumento?.trim() || '',
          p_validade: renovacao.validade,
        })
      : await supabase.rpc('reenviar_documento_parceiro', {
          p_documento_id: documentoId,
          p_frente_path: frentePath,
          p_verso_path: versoPath,
        });
    if (resultado.error) throw resultado.error;
  } catch (erro) {
    if (novosCaminhos.length) {
      await supabase.storage.from('documentos-parceiros').remove(novosCaminhos);
    }
    throw erro;
  }
}

export async function obterUrlDocumentoParceiro(path: string) {
  // Registos antigos podem guardar a URL pÃºblica que era gerada no cadastro.
  // O bucket Ã© privado; convertemos essa URL de volta ao caminho do ficheiro
  // para gerar sempre uma URL assinada vÃ¡lida.
  const marcadorBucket = '/documentos-parceiros/';
  const inicioCaminho = path.indexOf(marcadorBucket);
  const caminho = inicioCaminho >= 0
    ? decodeURIComponent(path.slice(inicioCaminho + marcadorBucket.length).split('?')[0])
    : path;

  const { data, error } = await supabase.storage
    .from('documentos-parceiros')
    .createSignedUrl(caminho, 60 * 10);

  if (error) throw error;
  return data.signedUrl;
}

export async function fetchMeuParceiroEntrega(userId: string) {
  const db = supabase;
  const { data: parceiro, error } = await db
    .from('parceiros_entrega')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!parceiro) return null;

  // Consultas separadas evitam que uma relaÃ§Ã£o ainda nÃ£o atualizada na cache
  // do PostgREST faÃ§a o painel parecer vazio apÃ³s o cadastro.
  const [veiculos, areas, documentos] = await Promise.all([
    db.from('veiculos_entrega').select('*').eq('parceiro_id', parceiro.id),
    db.from('areas_cobertura_entrega').select('*').eq('parceiro_id', parceiro.id),
    db.from('documentos_parceiro_entrega').select('*').eq('parceiro_id', parceiro.id),
  ]);

  if (veiculos.error) throw veiculos.error;
  if (areas.error) throw areas.error;
  if (documentos.error) throw documentos.error;

  return {
    ...parceiro,
    veiculos_entrega: veiculos.data || [],
    areas_cobertura_entrega: areas.data || [],
    documentos_parceiro_entrega: documentos.data || [],
  };
}

export async function atualizarMeuParceiroEntrega(parceiroId: string, dados: Record<string, unknown>) {
  const db = supabase;
  const { data, error } = await db
    .from('parceiros_entrega')
    .update(dados)
    .eq('id', parceiroId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function atualizarVeiculoEntrega(
  veiculoId: string,
  dados: DadosOperacionaisVeiculoAtualizaveis,
) {
  if (!Number.isFinite(dados.capacidade_kg) || dados.capacidade_kg <= 0) {
    throw new Error('Indique uma capacidade máxima de carga válida.');
  }
  if (
    dados.capacidade_volume_m3 !== null &&
    (!Number.isFinite(dados.capacidade_volume_m3) ||
      dados.capacidade_volume_m3 <= 0)
  ) {
    throw new Error('Indique um volume aproximado válido ou deixe o campo em branco.');
  }
  if (
    typeof dados.possui_refrigeracao !== 'boolean' ||
    typeof dados.possui_caixa_carga !== 'boolean' ||
    typeof dados.aceita_paletes !== 'boolean'
  ) {
    throw new Error('Indique claramente o equipamento disponível no veículo.');
  }

  const dadosPermitidos: VeiculoEntregaUpdate = {
    capacidade_kg: dados.capacidade_kg,
    capacidade_volume_m3: dados.capacidade_volume_m3,
    possui_refrigeracao: dados.possui_refrigeracao,
    possui_caixa_carga: dados.possui_caixa_carga,
    aceita_paletes: dados.aceita_paletes,
  };
  const db = supabase;
  const { data: atualizado, error } = await db
    .from('veiculos_entrega')
    .update(dadosPermitidos)
    .eq('id', veiculoId)
    .select('*')
    .single();

  if (error) throw error;
  if (!atualizado) {
    throw new Error('Não foi possível confirmar a atualização do veículo.');
  }

  // A resposta do UPDATE confirma a escrita; esta leitura separada é a fonte
  // de verdade usada pelo painel e evita mostrar estado otimista/stale.
  const { data, error: erroLeitura } = await db
    .from('veiculos_entrega')
    .select('*')
    .eq('id', atualizado.id)
    .single();

  if (erroLeitura) throw erroLeitura;
  return data;
}

export async function atualizarAreaCoberturaEntrega(areaId: string, dados: Record<string, unknown>) {
  const db = supabase;
  const { data, error } = await db
    .from('areas_cobertura_entrega')
    .update(dados)
    .eq('id', areaId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function uploadFotoPerfilParceiro(ficheiro: File) {
  const {
    data: { user },
    error: erroSessao,
  } = await supabase.auth.getUser();

  if (erroSessao || !user) {
    throw new Error('Sessão inválida. Inicie sessão novamente para atualizar a fotografia.');
  }

  const extensao = ficheiro.name.split('.').pop() || 'jpg';
  const caminho = `${user.id}/perfil-${crypto.randomUUID()}.${extensao}`;
  const { error: uploadError } = await supabase.storage
    .from('documentos-parceiros')
    .upload(caminho, ficheiro, { contentType: ficheiro.type });
  if (uploadError) throw uploadError;

  // O bucket Ã© privado: guardamos o caminho e a interface cria uma URL
  // assinada temporÃ¡ria apenas para o dono ou administrador autorizado.
  return caminho;
}

export async function atualizarDisponibilidadeParceiroEntrega(
  parceiroId: string,
  disponibilidade: boolean,
) {
  const db = supabase;
  const { data, error } = await db
    .from('parceiros_entrega')
    .update({ disponibilidade })
    .eq('id', parceiroId)
    .select('disponibilidade')
    .single();

  if (error) throw error;
  return data;
}

export async function eliminarVendedorAdmin(id: string) {
  const { error } = await supabase.rpc('eliminar_vendedor_admin', { p_vendedor_id: id });

  if (error) {
    console.error('Erro ao eliminar vendedor:', error);
    throw error;
  }
}

export async function eliminarClienteAdmin(id: string) {
  const { error } = await supabase
    .from('clientes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao eliminar cliente:', error);
    throw error;
  }

  return true;
}


// =============================
// ADMIN â€” PRODUTOS
// =============================

export async function fetchProdutosAdmin(): Promise<Produto[]> {
  const [{ data, error }, vendedores] = await Promise.all([
    supabase
      .from('produtos')
      .select('*, categoria:categorias (*)')
      .order('criado_em', { ascending: false }),
    fetchVendedoresAdmin(),
  ]);

  if (error) {
    console.error('Erro ao buscar produtos admin:', error);
    throw error;
  }

  const vendedoresPorId = new Map(vendedores.map((vendedor) => [vendedor.id, vendedor]));
  return (data || []).map((produto) => normalizarProduto({
    ...produto,
    vendedor: vendedoresPorId.get(produto.vendedor_id) || null,
  }));
}

export async function updateProdutoAdmin(id: string, dados: ProdutoUpdate) {
  const { data, error } = await supabase
    .from('produtos')
    .update(dados)
    .eq('id', id)
    .select('*, categoria:categorias (*)')
    .single();

  if (error) {
    console.error('Erro ao atualizar produto admin:', error);
    throw error;
  }

  const vendedores = await fetchVendedoresAdmin();
  const vendedor = vendedores.find((item) => item.id === data.vendedor_id) || null;
  return normalizarProduto({ ...data, vendedor });
}


// =============================
// ADMIN â€” GESTÃƒO DE VENDEDORES
// =============================

export async function updateVendedorAdmin(
  id: string,
  dados: { plano: PlanoVendedor },
): Promise<Vendedor> {
  const { error } = await supabase.rpc('atualizar_plano_vendedor_admin', {
    p_vendedor_id: id,
    p_plano: dados.plano,
  });

  if (error) {
    console.error('Erro ao atualizar vendedor admin:', error);
    throw error;
  }

  const atualizado = (await fetchVendedoresAdmin()).find((v) => v.id === id);
  if (!atualizado) throw new Error('Não foi possível confirmar a atualização do vendedor.');
  return atualizado;
}

// =============================
// HISTÃ“RICO DE CONTACTOS â€” SERVIÃ‡OS
// =============================

export async function guardarHistoricoContactoServico({
  cliente_id,
  servico,
}: {
  cliente_id: string;
  servico: any;
}) {
  if (!cliente_id || !servico?.id) return;

  const agora = new Date().toISOString();

  const {
    data: existente,
    error: erroBusca,
  } = await supabase
    .from('historico_contactos_servicos')
    .select('id')
    .eq('cliente_id', cliente_id)
    .eq('servico_id', servico.id)
    .maybeSingle();

  if (erroBusca) {
    console.error(
      'Erro ao verificar histÃ³rico:',
      erroBusca
    );
    return;
  }

  // JÃ¡ existe â†’ atualiza apenas o Ãºltimo contacto
  if (existente) {
    const { error } = await supabase
      .from('historico_contactos_servicos')
      .update({
        atualizado_em: agora,
      })
      .eq('id', existente.id);

    if (error) {
      console.error(
        'Erro ao atualizar histÃ³rico:',
        error
      );
    }

    return;
  }

  // NÃ£o existe â†’ cria o histÃ³rico
  const { error } = await supabase
    .from('historico_contactos_servicos')
    .insert({
      cliente_id,
      servico_id: servico.id,
      vendedor_id:
        servico.vendedor_id || null,
      nome_servico:
        servico.nome_servico || 'ServiÃ§o',
      nome_prestador:
        servico.vendedor?.nome_comercial ||
        servico.nome_prestador ||
        'Prestador',
      criado_em: agora,
      atualizado_em: agora,
    });

  if (error) {
    console.error(
      'Erro ao guardar histÃ³rico:',
      error
    );
  }
}

// =============================
// HISTÃ“RICO RECEBIDO â€” PRODUTOS
// =============================

export async function fetchHistoricoContactosVendedor(
  _vendedorId: string
) {
  const { data, error } = await supabase.rpc('listar_contactos_produtos_vendedor');

  if (error) {
    console.error("Erro ao buscar histÃ³rico de produtos:", error);
    return [];
  }

  return data ?? [];
}

// =============================
// HISTÃ“RICO RECEBIDO â€” SERVIÃ‡OS
// =============================

export async function fetchHistoricoContactosServicosVendedor(
  _vendedorId: string
) {
  const { data, error } = await supabase.rpc('listar_contactos_servicos_vendedor');

  if (error) {
    console.error("Erro ao buscar histÃ³rico de serviÃ§os:", error);
    return [];
  }

  return data ?? [];
}

// =============================
// HISTÃ“RICO DE PESQUISAS
// =============================

export async function guardarHistoricoPesquisa({
  cliente_id,
  termo,
  categoria_id,
  provincia,
  municipio,
  tipo_comprador,
}: {
  cliente_id?: string | null;
  termo?: string | null;
  categoria_id?: string | null;
  provincia?: string | null;
  municipio?: string | null;
  tipo_comprador?: 'casa' | 'negocio' | null;
}) {
  if (!termo && !categoria_id && !provincia && !municipio) return;

  const { error } = await supabase
    .from('historico_pesquisas')
    .insert({
      cliente_id: cliente_id || null,
      termo: termo || null,
      categoria_id: categoria_id || null,
      provincia: provincia || null,
      municipio: municipio || null,
      tipo_comprador: tipo_comprador || null,
    });

  if (error) {
    console.error('Erro ao guardar histÃ³rico de pesquisa:', error);
  }
}

// =============================
// DESTAQUES â€” PRODUTOS
// =============================

export async function destacarProdutoGratis(produtoId: string) {
  const { error } = await supabase.rpc('destacar_produto_gratis', {
    produto_uuid: produtoId,
  });

  if (error) {
    console.error('Erro ao destacar produto:', error);
    throw new Error(error.message || 'NÃ£o foi possÃ­vel destacar o produto.');
  }

  return true;
}

export async function removerDestaqueProduto(produtoId: string) {
  const { error } = await supabase.rpc('remover_destaque_produto', {
    produto_uuid: produtoId,
  });

  if (error) {
    console.error('Erro ao remover destaque do produto:', error);

    throw new Error(
      error.message || 'NÃ£o foi possÃ­vel remover o destaque do produto.'
    );
  }

  return true;
}

// =============================
// DESTAQUES â€” SERVIÃ‡OS
// =============================

export async function destacarServicoGratis(servicoId: string) {
  const { error } = await supabase.rpc('destacar_servico_gratis', {
    servico_uuid: servicoId,
  });

  if (error) {
    console.error('Erro ao destacar serviÃ§o:', error);

    throw new Error(
      error.message || 'NÃ£o foi possÃ­vel destacar o serviÃ§o.'
    );
  }

  return true;
}

export async function removerDestaqueServico(servicoId: string) {
  const { error } = await supabase.rpc('remover_destaque_servico', {
    servico_uuid: servicoId,
  });

  if (error) {
    console.error('Erro ao remover destaque do serviÃ§o:', error);

    throw new Error(
      error.message || 'NÃ£o foi possÃ­vel remover o destaque do serviÃ§o.'
    );
  }

  return true;
}


// =============================
// FAVORITOS â€” PRODUTOS
// =============================

export async function adicionarFavoritoProduto(
  utilizadorId: string,
  produtoId: string
) {
  const { error } = await supabase
    .from('favoritos')
    .insert({
      utilizador_id: utilizadorId,
      produto_id: produtoId,
    });

  if (error) {
    console.error(
      'Erro ao adicionar favorito:',
      error
    );
    throw error;
  }

  return true;
}

export async function removerFavoritoProduto(
  utilizadorId: string,
  produtoId: string
) {
  const { error } = await supabase
    .from('favoritos')
    .delete()
    .eq('utilizador_id', utilizadorId)
    .eq('produto_id', produtoId);

  if (error) {
    console.error(
      'Erro ao remover favorito:',
      error
    );
    throw error;
  }

  return true;
}

export async function produtoFavoritado(
  utilizadorId: string,
  produtoId: string
) {
  const { data, error } = await supabase
    .from('favoritos')
    .select('id')
    .eq('utilizador_id', utilizadorId)
    .eq('produto_id', produtoId)
    .maybeSingle();

  if (error) {
    console.error(
      'Erro ao verificar favorito:',
      error
    );
    return false;
  }

  return !!data;
}

export async function listarFavoritosProdutos(
  utilizadorId: string
) {
  const { data, error } = await supabase
    .from('favoritos')
    .select(`
      produto_id,
      produtos (
        *,
        vendedor:vendedores (${COLUNAS_VENDEDOR_PUBLICAS}),
        categoria:categorias (*)
      )
    `)
    .eq('utilizador_id', utilizadorId)
    .not('produto_id', 'is', null);

  if (error) {
    console.error(
      'Erro ao listar favoritos:',
      error
    );
    return [];
  }

  return data || [];
}

// =============================
// FAVORITOS â€” SERVIÃ‡OS
// =============================

export async function adicionarFavoritoServico(
  utilizadorId: string,
  servicoId: string
) {
  const { error } = await supabase
    .from('favoritos')
    .insert({
      utilizador_id: utilizadorId,
      servico_id: servicoId,
    });

  if (error) {
    console.error('Erro ao adicionar favorito:', error);
    throw error;
  }

  return true;
}

export async function removerFavoritoServico(
  utilizadorId: string,
  servicoId: string
) {
  const { error } = await supabase
    .from('favoritos')
    .delete()
    .eq('utilizador_id', utilizadorId)
    .eq('servico_id', servicoId);

  if (error) {
    console.error('Erro ao remover favorito:', error);
    throw error;
  }

  return true;
}

export async function servicoFavoritado(
  utilizadorId: string,
  servicoId: string
) {
  const { data, error } = await supabase
    .from('favoritos')
    .select('id')
    .eq('utilizador_id', utilizadorId)
    .eq('servico_id', servicoId)
    .maybeSingle();

  if (error) {
    console.error('Erro ao verificar favorito:', error);
    return false;
  }

  return !!data;
}

export async function listarFavoritosServicos(
  utilizadorId: string
) {
  const { data, error } = await supabase
    .from('favoritos')
    .select(`
      servico_id,
      servicos (
        *,
        vendedor:vendedores (${COLUNAS_VENDEDOR_PUBLICAS})
      )
    `)
    .eq('utilizador_id', utilizadorId)
    .not('servico_id', 'is', null);

  if (error) {
    console.error('Erro ao listar favoritos:', error);
    return [];
  }

  return data || [];
}

// =============================
// ADMIN â€” RANKINGS
// =============================

export async function fetchRankingProdutosMaisClicados(limite = 10) {
  const [{ data, error }, vendedores] = await Promise.all([
    supabase
      .from('produtos')
      .select(`
        id,
        vendedor_id,
        nome_produto,
        preco_aproximado,
        municipio,
        provincia,
        cliques_whatsapp,
        visualizacoes,
        destaque,
        disponivel,
        imagem_url,
        categoria:categorias (
          id,
          nome
        )
      `)
      .order('cliques_whatsapp', { ascending: false })
      .limit(limite),
    fetchVendedoresAdmin(),
  ]);

  if (error) {
    console.error('Erro ao buscar ranking de produtos:', error);
    return [];
  }

  const vendedoresPorId = new Map(vendedores.map((vendedor) => [vendedor.id, vendedor]));
  return (data || []).map((produto) => ({
    ...produto,
    vendedor: vendedoresPorId.get(produto.vendedor_id) || null,
  }));
}

export async function fetchRankingVendedoresMaisAtivos(limite = 10) {
  const [vendedores, produtosResultado, servicosResultado] = await Promise.all([
    fetchVendedoresAdmin(),
    supabase
      .from('produtos')
      .select('vendedor_id, cliques_whatsapp, visualizacoes, disponivel'),
    supabase
      .from('servicos')
      .select('vendedor_id, cliques_whatsapp, visualizacoes, disponivel'),
  ]);

  if (produtosResultado.error || servicosResultado.error) {
    console.error('Erro ao buscar ranking de vendedores:', produtosResultado.error ?? servicosResultado.error);
    return [];
  }

  type ProdutoRanking = NonNullable<typeof produtosResultado.data>[number];
  type ServicoRanking = NonNullable<typeof servicosResultado.data>[number];
  const produtosPorVendedor = new Map<string, ProdutoRanking[]>();
  for (const produto of produtosResultado.data ?? []) {
    if (!produto.vendedor_id) continue;
    const produtos = produtosPorVendedor.get(produto.vendedor_id) ?? [];
    produtos.push(produto);
    produtosPorVendedor.set(produto.vendedor_id, produtos);
  }

  const servicosPorVendedor = new Map<string, ServicoRanking[]>();
  for (const servico of servicosResultado.data ?? []) {
    if (!servico.vendedor_id) continue;
    const servicos = servicosPorVendedor.get(servico.vendedor_id) ?? [];
    servicos.push(servico);
    servicosPorVendedor.set(servico.vendedor_id, servicos);
  }

  const ranking = vendedores.map((vendedor) => {
    const produtos = produtosPorVendedor.get(vendedor.id) ?? [];
    const servicos = servicosPorVendedor.get(vendedor.id) ?? [];

    const totalProdutos = produtos.length;
    const totalServicos = servicos.length;

    const totalCliquesProdutos = produtos.reduce(
      (acc: number, p: any) => acc + (p.cliques_whatsapp || 0),
      0
    );

    const totalCliquesServicos = servicos.reduce(
      (acc: number, s: any) => acc + (s.cliques_whatsapp || 0),
      0
    );

    const totalVisualizacoesProdutos = produtos.reduce(
      (acc: number, p: any) => acc + (p.visualizacoes || 0),
      0
    );

    const totalVisualizacoesServicos = servicos.reduce(
      (acc: number, s: any) => acc + (s.visualizacoes || 0),
      0
    );

    return {
      ...vendedor,
      totalProdutos,
      totalServicos,
      totalPublicacoes: totalProdutos + totalServicos,
      totalCliques: totalCliquesProdutos + totalCliquesServicos,
      totalVisualizacoes:
        totalVisualizacoesProdutos + totalVisualizacoesServicos,
    };
  });

  return ranking
    .sort((a, b) => {
      if (b.totalCliques !== a.totalCliques) {
        return b.totalCliques - a.totalCliques;
      }

      return b.totalPublicacoes - a.totalPublicacoes;
    })
    .slice(0, limite);
}

export async function fetchRankingCategoriasMaisProcuradas(limite = 10) {
  const { data, error } = await supabase
    .from('historico_pesquisas')
    .select(`
      categoria_id,
      categoria:categorias (
        id,
        nome
      )
    `)
    .not('categoria_id', 'is', null);

  if (error) {
    console.error('Erro ao buscar ranking de categorias:', error);
    return [];
  }

  const mapa = new Map();

  (data || []).forEach((item: any) => {
    const categoriaId = item.categoria_id;
    const categoriaNome = item.categoria?.nome || 'Sem categoria';

    if (!mapa.has(categoriaId)) {
      mapa.set(categoriaId, {
        categoria_id: categoriaId,
        nome: categoriaNome,
        total_pesquisas: 0,
      });
    }

    mapa.get(categoriaId).total_pesquisas += 1;
  });

  return Array.from(mapa.values())
    .sort((a, b) => b.total_pesquisas - a.total_pesquisas)
    .slice(0, limite);
}


// =============================
// ADMIN â€” VERIFICAÃ‡ÃƒO DE VENDEDORES
// =============================

export async function atualizarVerificacaoVendedor(
  vendedorId: string,
  verificado: boolean
) {
  const { error } = await supabase.rpc('atualizar_verificacao_vendedor_admin', {
    p_vendedor_id: vendedorId,
    p_verificado: verificado,
  });

  if (error) {
    console.error('Erro ao atualizar verificaÃ§Ã£o do vendedor:', error);
    throw error;
  }

  const atualizado = (await fetchVendedoresAdmin()).find((v) => v.id === vendedorId);
  if (!atualizado) throw new Error('Não foi possível confirmar a atualização do vendedor.');
  return atualizado;
}

export async function fetchResumoCliente(clienteId: string) {
  const [produtos, servicos, contactosProdutos, contactosServicos] = await Promise.all([
    supabase.from('visualizacoes_produtos').select('produto_id').eq('cliente_id', clienteId),
    supabase.from('visualizacoes_servicos').select('servico_id').eq('cliente_id', clienteId),
    supabase.from('historico_contactos').select('id').eq('cliente_id', clienteId),
    supabase.from('historico_contactos_servicos').select('id').eq('cliente_id', clienteId),
  ]);

  for (const resultado of [produtos, servicos, contactosProdutos, contactosServicos]) {
    if (resultado.error) throw resultado.error;
  }

  return {
    produtosVisualizados: new Set((produtos.data || []).map(item => item.produto_id).filter(Boolean)).size,
    servicosVisualizados: new Set((servicos.data || []).map(item => item.servico_id).filter(Boolean)).size,
    contactosFeitos: (contactosProdutos.data?.length || 0) + (contactosServicos.data?.length || 0),
  };
}

export type SugestaoPesquisa = {
  id: string;
  nome: string;
  tipo: 'produto' | 'servico';
};

const TIPOS_VENDEDOR_LEGADOS: Record<string, Vendedor['tipo_vendedor']> = {
  fazenda: 'produtor',
  mercado: 'revendedor',
  loja: 'mini_mercado',
  taxista: 'prestador_servico',
  moto_taxista: 'prestador_servico',
};

function normalizarTipoVendedor(tipo: unknown): Vendedor['tipo_vendedor'] {
  const valor = String(tipo || 'produtor').trim();
  return TIPOS_VENDEDOR_LEGADOS[valor] || valor as Vendedor['tipo_vendedor'];
}

/** SugestÃµes pÃºblicas, limitadas e filtradas pelas políticas de catálogo. */
export async function fetchSugestoesPesquisa(termo: string): Promise<SugestaoPesquisa[]> {
  const pesquisa = termo.trim();
  if (!pesquisa) return [];

  const [produtosRes, servicosRes] = await Promise.all([
    supabase
      .from('produtos')
      .select('id, nome_produto')
      .ilike('nome_produto', `%${pesquisa}%`)
      .eq('disponivel', true)
      .eq('publicado', true)
      .limit(5),
    supabase
      .from('servicos')
      .select('id, nome_servico')
      .ilike('nome_servico', `%${pesquisa}%`)
      .eq('disponivel', true)
      .eq('publicado', true)
      .limit(5),
  ]);

  if (produtosRes.error) throw produtosRes.error;
  if (servicosRes.error) throw servicosRes.error;

  return [
    ...(produtosRes.data || []).map((produto: any) => ({ id: produto.id, nome: produto.nome_produto, tipo: 'produto' as const })),
    ...(servicosRes.data || []).map((servico: any) => ({ id: servico.id, nome: servico.nome_servico, tipo: 'servico' as const })),
  ].slice(0, 8);
}
