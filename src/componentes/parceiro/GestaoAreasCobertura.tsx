import { useCallback, useEffect, useState } from "react";
import {
  atualizarAreaCobertura,
  criarAreaCobertura,
  removerAreaCobertura,
  type AreaCoberturaEntrega,
} from "@/services/coberturaEntrega";
import {
  listarMunicipiosAngola,
  listarProvinciasAngola,
  type MunicipioAngola,
  type ProvinciaAngola,
} from "@/services/territorioAngola";

interface GestaoAreasCoberturaProps {
  areas: AreaCoberturaEntrega[];
  aoAlterar: () => Promise<void>;
}

export function GestaoAreasCobertura({ areas, aoAlterar }: GestaoAreasCoberturaProps) {
  const [provincias, setProvincias] = useState<ProvinciaAngola[]>([]);
  const [municipios, setMunicipios] = useState<MunicipioAngola[]>([]);
  const [provinciaId, setProvinciaId] = useState("");
  const [municipioId, setMunicipioId] = useState("");
  const [bairro, setBairro] = useState("");
  const [aGuardar, setAGuardar] = useState(false);
  const [aCarregarProvincias, setACarregarProvincias] = useState(true);
  const [aCarregarMunicipios, setACarregarMunicipios] = useState(false);
  const [erroProvincias, setErroProvincias] = useState<string | null>(null);
  const [erroMunicipios, setErroMunicipios] = useState<string | null>(null);
  const [erroOperacao, setErroOperacao] = useState<string | null>(null);
  const [tentativaMunicipios, setTentativaMunicipios] = useState(0);

  const carregarProvincias = useCallback(async () => {
    try {
      setACarregarProvincias(true);
      setErroProvincias(null);
      setProvincias(await listarProvinciasAngola());
    } catch {
      setErroProvincias("Não foi possível carregar as províncias.");
    } finally {
      setACarregarProvincias(false);
    }
  }, []);

  useEffect(() => {
    void carregarProvincias();
  }, [carregarProvincias]);

  useEffect(() => {
    let ativo = true;

    setMunicipioId("");
    setMunicipios([]);
    setErroMunicipios(null);

    if (!provinciaId) {
      setACarregarMunicipios(false);
      return () => {
        ativo = false;
      };
    }

    setACarregarMunicipios(true);
    void listarMunicipiosAngola(provinciaId)
      .then(dados => {
        if (ativo) setMunicipios(dados);
      })
      .catch(() => {
        if (ativo) setErroMunicipios("Não foi possível carregar os municípios.");
      })
      .finally(() => {
        if (ativo) setACarregarMunicipios(false);
      });

    return () => {
      ativo = false;
    };
  }, [provinciaId, tentativaMunicipios]);

  const selecionarProvincia = (novoId: string) => {
    setProvinciaId(novoId);
    setMunicipioId("");
    setMunicipios([]);
    setErroMunicipios(null);
  };

  const recarregarMunicipios = () => {
    if (provinciaId) setTentativaMunicipios(tentativa => tentativa + 1);
  };

  const guardar = async () => {
    const provincia = provincias.find(item => item.id === provinciaId);
    const municipio = municipios.find(
      item => item.id === municipioId && item.provinciaId === provinciaId,
    );
    if (!provincia || !municipio) {
      setErroOperacao("Selecione uma província e um município válidos.");
      return;
    }

    try {
      setAGuardar(true);
      setErroOperacao(null);
      await criarAreaCobertura({
        provincia: provincia.nome,
        municipio: municipio.nome,
        bairro: bairro.trim() || null,
      });
      setProvinciaId("");
      setMunicipioId("");
      setBairro("");
      await aoAlterar();
    } catch (causa) {
      setErroOperacao(causa instanceof Error ? causa.message : "Não foi possível guardar a área.");
    } finally {
      setAGuardar(false);
    }
  };

  const alterarEstado = async (area: AreaCoberturaEntrega) => {
    try {
      setAGuardar(true);
      setErroOperacao(null);
      await atualizarAreaCobertura(area.id, {
        provincia: area.provincia,
        municipio: area.municipio,
        bairro: area.bairro,
        ativo: !area.ativo,
      });
      await aoAlterar();
    } catch (causa) {
      setErroOperacao(causa instanceof Error ? causa.message : "Não foi possível atualizar a área.");
    } finally {
      setAGuardar(false);
    }
  };

  const editarBairro = async (area: AreaCoberturaEntrega) => {
    const resposta = window.prompt(
      "Indique o bairro ou zona de cobertura (deixe vazio para remover).",
      area.bairro ?? "",
    );
    if (resposta === null) return;

    try {
      setAGuardar(true);
      setErroOperacao(null);
      await atualizarAreaCobertura(area.id, {
        provincia: area.provincia,
        municipio: area.municipio,
        bairro: resposta.trim() || null,
        ativo: area.ativo,
      });
      await aoAlterar();
    } catch (causa) {
      setErroOperacao(causa instanceof Error ? causa.message : "Não foi possível atualizar a área.");
    } finally {
      setAGuardar(false);
    }
  };

  const remover = async (area: AreaCoberturaEntrega) => {
    if (!window.confirm(`Remover a cobertura de ${area.municipio}, ${area.provincia}?`)) return;
    try {
      setAGuardar(true);
      setErroOperacao(null);
      await removerAreaCobertura(area.id);
      await aoAlterar();
    } catch (causa) {
      setErroOperacao(causa instanceof Error ? causa.message : "Não foi possível remover a área.");
    } finally {
      setAGuardar(false);
    }
  };

  const municipioIndisponivel = !provinciaId || aCarregarMunicipios || Boolean(erroMunicipios) || aGuardar;

  return (
    <section className="painel-dashboard-form">
      <h2 className="font-titulo text-lg font-bold">Áreas de cobertura</h2>
      <p className="mt-1 text-sm text-muted-foreground">Defina apenas zonas onde realmente pode realizar entregas.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="space-y-1"><span className="text-xs font-semibold">Província</span><select value={provinciaId} onChange={evento => selecionarProvincia(evento.target.value)} className="w-full rounded-lg border bg-background p-2" disabled={aCarregarProvincias || aGuardar}><option value="">{aCarregarProvincias ? "A carregar províncias..." : "Selecionar província"}</option>{provincias.map(provincia => <option key={provincia.id} value={provincia.id}>{provincia.nome}</option>)}</select></label>
        <label className="space-y-1"><span className="text-xs font-semibold">Município</span><select value={municipioId} onChange={evento => setMunicipioId(evento.target.value)} className="w-full rounded-lg border bg-background p-2" disabled={municipioIndisponivel}><option value="">{aCarregarMunicipios ? "A carregar municípios..." : "Selecionar município"}</option>{municipios.map(municipio => <option key={municipio.id} value={municipio.id}>{municipio.nome}</option>)}</select></label>
        <label className="space-y-1"><span className="text-xs font-semibold">Bairro ou zona (opcional)</span><input value={bairro} onChange={evento => setBairro(evento.target.value)} placeholder="Ex.: Centralidade do Kilamba" className="w-full rounded-lg border bg-background p-2" disabled={aGuardar} /></label>
      </div>
      {erroProvincias && <p className="mt-3 text-sm text-destructive" role="alert">{erroProvincias} <button type="button" className="underline" disabled={aCarregarProvincias || aGuardar} onClick={() => void carregarProvincias()}>Tentar novamente</button></p>}
      {erroMunicipios && <p className="mt-3 text-sm text-destructive" role="alert">{erroMunicipios} <button type="button" className="underline" disabled={aCarregarMunicipios || aGuardar} onClick={recarregarMunicipios}>Tentar novamente</button></p>}
      <button type="button" disabled={aGuardar || aCarregarProvincias || aCarregarMunicipios || Boolean(erroProvincias) || Boolean(erroMunicipios)} onClick={() => void guardar()} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Adicionar área</button>
      {erroOperacao && <p className="mt-3 text-sm text-destructive" role="alert">{erroOperacao} <button type="button" className="underline" onClick={() => setErroOperacao(null)}>Fechar</button></p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">{areas.map(area => <article key={area.id} className="rounded-xl border bg-background p-3"><p className="font-semibold">{[area.bairro, area.municipio, area.provincia].filter(Boolean).join(", ")}</p><p className="mt-1 text-xs text-muted-foreground">{area.ativo ? "Ativa para entregas" : "Inativa"}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={aGuardar} onClick={() => void alterarEstado(area)} className="rounded border px-3 py-1 text-xs font-semibold">{area.ativo ? "Desativar" : "Ativar"}</button><button type="button" disabled={aGuardar} onClick={() => void editarBairro(area)} className="rounded border px-3 py-1 text-xs font-semibold">Editar bairro</button><button type="button" disabled={aGuardar} onClick={() => void remover(area)} className="rounded border border-destructive/50 px-3 py-1 text-xs font-semibold text-destructive">Remover</button></div></article>)}</div>
    </section>
  );
}
