import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listarMunicipiosAngola,
  listarProvinciasAngola,
  type MunicipioAngola,
  type ProvinciaAngola,
} from '@/services/territorioAngola';

export function useFiltroTerritorialAngola() {
  const [provinciaId, setProvinciaId] = useState('');
  const [municipioId, setMunicipioId] = useState('');
  const [provincias, setProvincias] = useState<ProvinciaAngola[]>([]);
  const [municipios, setMunicipios] = useState<MunicipioAngola[]>([]);
  const [aCarregarProvincias, setACarregarProvincias] = useState(true);
  const [aCarregarMunicipios, setACarregarMunicipios] = useState(false);
  const [erroProvincias, setErroProvincias] = useState('');
  const [erroMunicipios, setErroMunicipios] = useState('');
  const [tentativaMunicipios, setTentativaMunicipios] = useState(0);

  const carregarProvincias = useCallback(async () => {
    setACarregarProvincias(true);
    setErroProvincias('');

    try {
      setProvincias(await listarProvinciasAngola());
    } catch {
      setErroProvincias('Não foi possível carregar as províncias.');
    } finally {
      setACarregarProvincias(false);
    }
  }, []);

  useEffect(() => {
    void carregarProvincias();
  }, [carregarProvincias]);

  useEffect(() => {
    if (!provinciaId) {
      setMunicipios([]);
      setErroMunicipios('');
      return;
    }

    let ativo = true;
    setACarregarMunicipios(true);
    setErroMunicipios('');

    void listarMunicipiosAngola(provinciaId)
      .then(dados => {
        if (ativo) setMunicipios(dados);
      })
      .catch(() => {
        if (ativo) setErroMunicipios('Não foi possível carregar os municípios.');
      })
      .finally(() => {
        if (ativo) setACarregarMunicipios(false);
      });

    return () => {
      ativo = false;
    };
  }, [provinciaId, tentativaMunicipios]);

  const selecionarProvincia = useCallback((id: string) => {
    setProvinciaId(id);
    setMunicipioId('');
  }, []);

  const selecionarMunicipio = useCallback((id: string) => {
    setMunicipioId(id);
  }, []);

  const definirSelecao = useCallback((proximoProvinciaId: string, proximoMunicipioId: string) => {
    setProvinciaId(proximoProvinciaId);
    setMunicipioId(proximoMunicipioId);
  }, []);

  const recarregarMunicipios = useCallback(() => {
    if (provinciaId) setTentativaMunicipios(tentativa => tentativa + 1);
  }, [provinciaId]);

  const provinciaSelecionada = useMemo(
    () => provincias.find(item => item.id === provinciaId) ?? null,
    [provincias, provinciaId],
  );
  const municipioSelecionado = useMemo(
    () => municipios.find(item => item.id === municipioId && item.provinciaId === provinciaId) ?? null,
    [municipios, municipioId, provinciaId],
  );

  return {
    provinciaId,
    municipioId,
    provincias,
    municipios,
    provinciaSelecionada,
    municipioSelecionado,
    aCarregarProvincias,
    aCarregarMunicipios,
    erroProvincias,
    erroMunicipios,
    selecionarProvincia,
    selecionarMunicipio,
    definirSelecao,
    carregarProvincias,
    recarregarMunicipios,
  };
}
