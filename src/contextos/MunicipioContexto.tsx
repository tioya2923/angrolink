import { createContext, useContext, useState, type ReactNode } from 'react';
import type { MunicipioAngola, ProvinciaAngola } from '@/services/territorioAngola';

interface MunicipioContextoTipo { municipioId: string; municipioNome: string; provinciaId: string; provinciaNome: string; selecionarProvincia: (provincia: ProvinciaAngola | null) => void; selecionarMunicipio: (municipio: MunicipioAngola | null) => void; limparMunicipio: () => void; }
const MunicipioCtx = createContext<MunicipioContextoTipo | null>(null);
export function MunicipioProvider({ children }: { children: ReactNode }) {
  const [municipio, setMunicipio] = useState<MunicipioAngola | null>(null);
  const [provincia, setProvincia] = useState<ProvinciaAngola | null>(null);
  return <MunicipioCtx.Provider value={{ municipioId: municipio?.id ?? '', municipioNome: municipio?.nome ?? '', provinciaId: provincia?.id ?? municipio?.provinciaId ?? '', provinciaNome: provincia?.nome ?? '', selecionarProvincia: setProvincia, selecionarMunicipio: setMunicipio, limparMunicipio: () => setMunicipio(null) }}>{children}</MunicipioCtx.Provider>;
}
export function useMunicipio() { const contexto = useContext(MunicipioCtx); if (!contexto) throw new Error('useMunicipio deve ser usado dentro de MunicipioProvider'); return contexto; }
export default useMunicipio;
