import { supabase } from '@/services/supabase';

export interface ProvinciaAngola {
  id: string;
  codigoOficial: string;
  nome: string;
  ordem: number;
}

export interface MunicipioAngola {
  id: string;
  codigoOficial: string;
  nome: string;
  provinciaId: string;
}

export type EstadoSelecaoTerritorial = 'CANONICO' | 'LEGADO' | 'INCOMPLETO';

export interface SelecaoTerritorialExistente {
  estado: EstadoSelecaoTerritorial;
  provincia: ProvinciaAngola | null;
  municipio: MunicipioAngola | null;
}

let provinciasEmMemoria: ProvinciaAngola[] | null = null;
const municipiosEmMemoria = new Map<string, MunicipioAngola[]>();

/** Espelha a normalização conservadora aplicada pela função SQL territorial. */
export function normalizarTextoTerritorialFrontend(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-PT');
}

export async function listarProvinciasAngola(): Promise<ProvinciaAngola[]> {
  if (provinciasEmMemoria) return provinciasEmMemoria;

  const { data, error } = await supabase.rpc('listar_provincias_angola');
  if (error) throw new Error('Não foi possível carregar as províncias de Angola.');

  provinciasEmMemoria = (data ?? []).map(item => ({
    id: item.id,
    codigoOficial: item.codigo_oficial,
    nome: item.nome,
    ordem: item.ordem,
  }));
  return provinciasEmMemoria;
}

export async function listarMunicipiosAngola(provinciaId: string): Promise<MunicipioAngola[]> {
  const emCache = municipiosEmMemoria.get(provinciaId);
  if (emCache) return emCache;

  const { data, error } = await supabase.rpc('listar_municipios_angola', {
    p_provincia_id: provinciaId,
  });
  if (error) throw new Error('Não foi possível carregar os municípios desta província.');

  const municipios = (data ?? []).map(item => ({
    id: item.id,
    codigoOficial: item.codigo_oficial,
    nome: item.nome,
    provinciaId: item.provincia_id,
  }));
  municipiosEmMemoria.set(provinciaId, municipios);
  return municipios;
}

export async function resolverSelecaoTerritorialExistente(provinciaNome?: string | null, municipioNome?: string | null): Promise<SelecaoTerritorialExistente> {
  const provinciaTexto = provinciaNome?.trim() ?? '';
  const municipioTexto = municipioNome?.trim() ?? '';
  if (!provinciaTexto || !municipioTexto) return { estado: 'INCOMPLETO', provincia: null, municipio: null };

  const provincias = await listarProvinciasAngola();
  const provincia = provincias.find(item => normalizarTextoTerritorialFrontend(item.nome) === normalizarTextoTerritorialFrontend(provinciaTexto)) ?? null;
  if (!provincia) return { estado: 'LEGADO', provincia: null, municipio: null };

  const municipios = await listarMunicipiosAngola(provincia.id);
  const municipio = municipios.find(item => normalizarTextoTerritorialFrontend(item.nome) === normalizarTextoTerritorialFrontend(municipioTexto)) ?? null;
  return { estado: municipio ? 'CANONICO' : 'LEGADO', provincia, municipio };
}

export function limparCacheTerritorioAngola() {
  provinciasEmMemoria = null;
  municipiosEmMemoria.clear();
}
