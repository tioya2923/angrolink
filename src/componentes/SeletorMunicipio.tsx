import { useMunicipio } from '@/contextos/MunicipioContexto';
import { useFiltroTerritorialAngola } from '@/hooks/useFiltroTerritorialAngola';

export default function SeletorMunicipio() {
  const { selecionarMunicipio: guardarMunicipio, selecionarProvincia: guardarProvincia } = useMunicipio();
  const filtro = useFiltroTerritorialAngola();

  return <div className="flex flex-col gap-3">
    <div className="flex flex-col gap-3 sm:flex-row">
      <select value={filtro.provinciaId} onChange={e => { const proximaProvincia = filtro.provincias.find(provincia => provincia.id === e.target.value) ?? null; filtro.selecionarProvincia(e.target.value); guardarProvincia(proximaProvincia); guardarMunicipio(null); }} disabled={filtro.aCarregarProvincias} className="flex-1 border-2 border-border bg-background px-3 py-3 text-sm text-foreground disabled:opacity-50" aria-label="Selecionar província"><option value="">{filtro.aCarregarProvincias ? 'A carregar províncias...' : 'Todas as províncias'}</option>{filtro.provincias.map(provincia => <option key={provincia.id} value={provincia.id}>{provincia.nome}</option>)}</select>
      <select value={filtro.municipioId} onChange={e => { const proximoMunicipio = filtro.municipios.find(municipio => municipio.id === e.target.value) ?? null; filtro.selecionarMunicipio(e.target.value); guardarMunicipio(proximoMunicipio); }} disabled={!filtro.provinciaId || filtro.aCarregarMunicipios || Boolean(filtro.erroMunicipios)} className="flex-1 border-2 border-border bg-background px-3 py-3 text-sm text-foreground disabled:opacity-50" aria-label="Selecionar município"><option value="">{!filtro.provinciaId ? 'Selecione primeiro a província' : filtro.aCarregarMunicipios ? 'A carregar municípios...' : 'Todos os municípios'}</option>{filtro.municipios.map(municipio => <option key={municipio.id} value={municipio.id}>{municipio.nome}</option>)}</select>
    </div>
    {filtro.erroProvincias && <p className="text-xs text-destructive">{filtro.erroProvincias} <button type="button" onClick={() => void filtro.carregarProvincias()} className="font-semibold underline">Tentar novamente</button></p>}
    {filtro.erroMunicipios && <p className="text-xs text-destructive">{filtro.erroMunicipios} <button type="button" onClick={filtro.recarregarMunicipios} className="font-semibold underline">Tentar novamente</button></p>}
  </div>;
}
