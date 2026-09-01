import type { Database } from '@/types/database.types';
import { supabase } from './supabase';

export type PapelDiretorioAdmin = 'cliente' | 'vendedor' | 'parceiro_entrega' | 'admin';
export type EstadoDiretorioAdmin = 'ativo' | 'pendente' | 'suspenso' | 'rejeitado' | 'inativo';

export interface FiltrosDiretorioAdmin {
  papel?: PapelDiretorioAdmin | null;
  estado?: EstadoDiretorioAdmin | null;
  provincia?: string | null;
  registoRecente?: boolean | null;
  pesquisa?: string | null;
  limite?: number;
  offset?: number;
}

export interface UtilizadorDiretorioAdmin {
  userId: string;
  papeis: PapelDiretorioAdmin[];
  nomeApresentacao: string;
  fotoUrl: string | null;
  estadosPapeis: Partial<Record<PapelDiretorioAdmin, EstadoDiretorioAdmin | null>>;
  email: string | null;
  telefone: string | null;
  provincia: string | null;
  municipio: string | null;
  criadoEm: string;
  temPendenciaDocumental: boolean;
  pendenciasDocumentaisPapeis: Partial<Record<'vendedor' | 'parceiro_entrega', boolean>>;
}

export interface ResultadoDiretorioAdmin {
  itens: UtilizadorDiretorioAdmin[];
  paginacao: { totalResultados: number; limite: number; offset: number };
  contagens: { totalGlobal: number; clientes: number; vendedores: number; parceirosEntrega: number; administradores: number };
}

type RetornoRpc = Database['public']['Functions']['listar_utilizadores_admin']['Returns'];

const papeisValidos: PapelDiretorioAdmin[] = ['cliente', 'vendedor', 'parceiro_entrega', 'admin'];
const estadosValidos: EstadoDiretorioAdmin[] = ['ativo', 'pendente', 'suspenso', 'rejeitado', 'inativo'];

function registo(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
    ? valor as Record<string, unknown>
    : null;
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' ? valor : null;
}

function numero(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

function estado(valor: unknown): EstadoDiretorioAdmin | null {
  return typeof valor === 'string' && estadosValidos.includes(valor as EstadoDiretorioAdmin)
    ? valor as EstadoDiretorioAdmin
    : null;
}

function validarItem(valor: unknown): UtilizadorDiretorioAdmin | null {
  const item = registo(valor);
  if (!item) return null;

  const userId = texto(item.user_id);
  const nomeApresentacao = texto(item.nome_apresentacao);
  const criadoEm = texto(item.criado_em);
  if (!userId || !nomeApresentacao || !criadoEm || !Array.isArray(item.papeis)) return null;

  const papeis = item.papeis.filter((papel): papel is PapelDiretorioAdmin =>
    typeof papel === 'string' && papeisValidos.includes(papel as PapelDiretorioAdmin),
  );
  if (papeis.length === 0) return null;

  const estadosRaw = registo(item.estados_papeis) || {};
  const estadosPapeis: UtilizadorDiretorioAdmin['estadosPapeis'] = {};
  for (const papel of papeisValidos) estadosPapeis[papel] = estado(estadosRaw[papel]);

  const pendenciasRaw = registo(item.pendencias_documentais_papeis) || {};
  return {
    userId,
    papeis,
    nomeApresentacao,
    fotoUrl: texto(item.foto_url),
    estadosPapeis,
    email: texto(item.email),
    telefone: texto(item.telefone),
    provincia: texto(item.provincia),
    municipio: texto(item.municipio),
    criadoEm,
    temPendenciaDocumental: item.tem_pendencia_documental === true,
    pendenciasDocumentaisPapeis: {
      vendedor: pendenciasRaw.vendedor === true,
      parceiro_entrega: pendenciasRaw.parceiro_entrega === true,
    },
  };
}

function validarResultado(valor: RetornoRpc): ResultadoDiretorioAdmin {
  const resultado = registo(valor);
  const paginacao = resultado && registo(resultado.paginacao);
  const contagens = resultado && registo(resultado.contagens);
  const itensRaw = resultado?.itens;

  const totalResultados = numero(paginacao?.total_resultados);
  const limite = numero(paginacao?.limite);
  const offset = numero(paginacao?.offset);
  const totalGlobal = numero(contagens?.total_global);
  const clientes = numero(contagens?.clientes);
  const vendedores = numero(contagens?.vendedores);
  const parceirosEntrega = numero(contagens?.parceiros_entrega);
  const administradores = numero(contagens?.administradores);

  if (!Array.isArray(itensRaw) || totalResultados === null || limite === null || offset === null
    || totalGlobal === null || clientes === null || vendedores === null
    || parceirosEntrega === null || administradores === null) {
    throw new Error('A resposta do diretório administrativo está incompleta.');
  }

  return {
    itens: itensRaw.map(validarItem).filter((item): item is UtilizadorDiretorioAdmin => item !== null),
    paginacao: { totalResultados, limite, offset },
    contagens: { totalGlobal, clientes, vendedores, parceirosEntrega, administradores },
  };
}

export async function listarUtilizadoresAdmin(filtros: FiltrosDiretorioAdmin = {}): Promise<ResultadoDiretorioAdmin> {
  const { data, error } = await supabase.rpc('listar_utilizadores_admin', {
    p_papel: filtros.papel ?? null,
    p_estado: filtros.estado ?? null,
    p_provincia: filtros.provincia ?? null,
    p_registo_recente: filtros.registoRecente ?? null,
    p_pesquisa: filtros.pesquisa?.trim() || null,
    p_limite: filtros.limite ?? 25,
    p_offset: Math.max(filtros.offset ?? 0, 0),
  });

  if (error) throw error;
  return validarResultado(data);
}
