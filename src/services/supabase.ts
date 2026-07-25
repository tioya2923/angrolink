import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

// =============================
// VARIÁVEIS DE AMBIENTE
// =============================
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// =============================
// VALIDAÇÃO DE CONFIGURAÇÃO
// =============================
if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL não está definida no .env');
}

if (!supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY não está definida no .env');
}

// =============================
// CLIENTE SUPABASE TIPADO
// =============================
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey
);

// =============================
// CONSTANTES SUPABASE
// =============================
export const BUCKET_PRODUTOS =
  import.meta.env.VITE_SUPABASE_BUCKET_PRODUTOS || 'produtos';

export const SUPABASE_STORAGE_PRODUTOS_URL =
  `${supabaseUrl}/storage/v1/object/public/${BUCKET_PRODUTOS}/`;

export const BUCKET_VENDEDORES = 'vendedores';

export const SUPABASE_STORAGE_VENDEDORES_URL =
  `${supabaseUrl}/storage/v1/object/public/${BUCKET_VENDEDORES}/`;