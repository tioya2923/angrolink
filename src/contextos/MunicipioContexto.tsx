/**
 * ========================================
 * CONTEXTO DO MUNICÍPIO
 * ========================================
 * Estado global para o município selecionado.
 * Usado em toda a aplicação para filtrar produtos.
 */

import { createContext, useContext, useState, ReactNode } from 'react';
import { MUNICIPIOS } from '@/dados/constantes';

interface MunicipioContextoTipo {
  /** ID do município selecionado */
  municipioId: string;
  /** Nome do município selecionado */
  municipioNome: string;
  /** ID da província do município */
  provinciaId: string;
  /** Alterar o município selecionado */
  selecionarMunicipio: (id: string) => void;
  /** Limpar a seleção */
  limparMunicipio: () => void;
}

const MunicipioCtx = createContext<MunicipioContextoTipo | null>(null);

export function MunicipioProvider({ children }: { children: ReactNode }) {
  const [municipioId, setMunicipioId] = useState('');

  const municipio = MUNICIPIOS.find(m => m.id === municipioId);

  const selecionarMunicipio = (id: string) => setMunicipioId(id);
  const limparMunicipio = () => setMunicipioId('');

  return (
    <MunicipioCtx.Provider
      value={{
        municipioId,
        municipioNome: municipio?.nome || '',
        provinciaId: municipio?.provincia_id || '',
        selecionarMunicipio,
        limparMunicipio,
      }}
    >
      {children}
    </MunicipioCtx.Provider>
  );
}

/** Hook para aceder ao contexto do município */
export function useMunicipio() {
  const ctx = useContext(MunicipioCtx);
  if (!ctx) {
    throw new Error('useMunicipio deve ser usado dentro de MunicipioProvider');
  }
  return ctx;
}

// 🔥 EXTRA: export default para evitar conflitos de import
export default useMunicipio;