/**
 * ========================================
 * SELETOR DE MUNICÍPIO
 * ========================================
 * Dropdown para selecionar província e município.
 * Filtra os municípios com base na província selecionada.
 */

import { useState } from 'react';
import { PROVINCIAS, MUNICIPIOS } from '@/dados/constantes';
import { useMunicipio } from '@/contextos/MunicipioContexto';

export default function SeletorMunicipio() {
  const { municipioId, selecionarMunicipio } = useMunicipio();
  const [provinciaId, setProvinciaId] = useState('');

  // Filtrar municípios pela província selecionada
  const municipiosFiltrados = provinciaId
    ? MUNICIPIOS.filter(m => m.provincia_id === provinciaId)
    : [];

  const handleProvinciaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setProvinciaId(e.target.value);
    selecionarMunicipio(''); // limpar município ao trocar província
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Dropdown Província */}
      <select
        value={provinciaId}
        onChange={handleProvinciaChange}
        className="flex-1 border-2 border-border bg-background text-foreground font-corpo text-sm px-3 py-3 focus:outline-none focus:border-primary transition-colors"
        aria-label="Selecionar província"
      >
        <option value="">Selecione a província</option>
        {PROVINCIAS.map(p => (
          <option key={p.id} value={p.id}>{p.nome}</option>
        ))}
      </select>

      {/* Dropdown Município */}
      <select
        value={municipioId}
        onChange={e => selecionarMunicipio(e.target.value)}
        disabled={!provinciaId}
        className="flex-1 border-2 border-border bg-background text-foreground font-corpo text-sm px-3 py-3 focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
        aria-label="Selecionar município"
      >
        <option value="">Selecione o município</option>
        {municipiosFiltrados.map(m => (
          <option key={m.id} value={m.id}>{m.nome}</option>
        ))}
      </select>
    </div>
  );
}
