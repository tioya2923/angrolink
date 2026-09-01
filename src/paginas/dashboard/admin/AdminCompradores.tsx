import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, ExternalLink, MapPin, Search, ShoppingBag } from 'lucide-react';
import { useAtualizacaoTempoReal } from '@/hooks/useAtualizacaoTempoReal';
import { useFiltroTerritorialAngola } from '@/hooks/useFiltroTerritorialAngola';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { listarCompradoresAdmin, type FiltrosCompradoresAdmin, type ResultadoCompradoresAdmin, type TipoCompradorAdmin } from '@/services/adminCompradores';
import { formatarData } from './admin360Util';

const LIMITE = 25;
const vazio: ResultadoCompradoresAdmin = { itens: [], paginacao: { totalResultados: 0, limite: LIMITE, offset: 0 }, contagens: { total: 0, ativos: 0, inativos: 0, casa: 0, negocio: 0, comDisputas: 0 } };

export default function AdminCompradores() {
  const [tipo, setTipo] = useState<TipoCompradorAdmin | 'todos'>('todos');
  const [estado, setEstado] = useState<'todos' | 'ativo' | 'inativo'>('todos');
  const filtroTerritorial = useFiltroTerritorialAngola();
  const [comDisputas, setComDisputas] = useState(false);
  const [comCancelamentos, setComCancelamentos] = useState(false);
  const [recentes, setRecentes] = useState(false);
  const [pesquisaInput, setPesquisaInput] = useState('');
  const [pesquisa, setPesquisa] = useState('');
  const [offset, setOffset] = useState(0);
  const [resultado, setResultado] = useState<ResultadoCompradoresAdmin>(vazio);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    const temporizador = window.setTimeout(() => { setPesquisa(pesquisaInput); setOffset(0); }, 350);
    return () => window.clearTimeout(temporizador);
  }, [pesquisaInput]);

  const carregar = useCallback(async () => {
    setACarregar(true); setErro(false);
    const filtros: FiltrosCompradoresAdmin = {
      tipoComprador: tipo === 'todos' ? null : tipo,
      contaAtiva: estado === 'todos' ? null : estado === 'ativo',
      provincia: filtroTerritorial.provinciaSelecionada?.nome ?? null,
      municipio: filtroTerritorial.municipioSelecionado?.nome ?? null,
      comDisputas: comDisputas || null,
      comCancelamentos: comCancelamentos || null,
      registoRecente: recentes || null,
      pesquisa,
      limite: LIMITE,
      offset,
    };
    try { setResultado(await listarCompradoresAdmin(filtros)); } catch { setErro(true); } finally { setACarregar(false); }
  }, [comCancelamentos, comDisputas, estado, filtroTerritorial.municipioSelecionado, filtroTerritorial.provinciaSelecionada, offset, pesquisa, recentes, tipo]);

  useEffect(() => { void carregar(); }, [carregar]);
  useAtualizacaoTempoReal(['clientes', 'encomendas', 'pagamentos', 'disputas_encomenda'], carregar);

  const alterar = <T,>(definir: (valor: T) => void, valor: T) => { definir(valor); setOffset(0); };
  const totalPaginas = Math.max(1, Math.ceil(resultado.paginacao.totalResultados / Math.max(1, resultado.paginacao.limite)));
  const paginaAtual = Math.floor(resultado.paginacao.offset / Math.max(1, resultado.paginacao.limite)) + 1;

  return <div className="space-y-6">
    <header className="painel-dashboard-cabecalho flex items-center gap-3"><span className="relative z-10 rounded-xl bg-primary-foreground/15 p-3 text-primary-foreground"><ShoppingBag className="size-5" /></span><div><h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">Compradores</h1><p className="relative z-10 text-sm text-primary-foreground/80">Consulta operacional de contas, encomendas e situações de apoio.</p></div></header>
    <nav className="flex flex-wrap gap-2" aria-label="Resumo de compradores">
      <FiltroContagem ativo={tipo === 'todos' && estado === 'todos' && !comDisputas} texto="Todos" numero={resultado.contagens.total} aoClicar={() => { alterar(setTipo, 'todos'); alterar(setEstado, 'todos'); alterar(setComDisputas, false); }} />
      <FiltroContagem ativo={estado === 'ativo'} texto="Ativos" numero={resultado.contagens.ativos} aoClicar={() => alterar(setEstado, 'ativo')} />
      <FiltroContagem ativo={estado === 'inativo'} texto="Inativos" numero={resultado.contagens.inativos} aoClicar={() => alterar(setEstado, 'inativo')} />
      <FiltroContagem ativo={tipo === 'casa'} texto="Casa" numero={resultado.contagens.casa} aoClicar={() => alterar(setTipo, 'casa')} />
      <FiltroContagem ativo={tipo === 'negocio'} texto="Negócio" numero={resultado.contagens.negocio} aoClicar={() => alterar(setTipo, 'negocio')} />
      <FiltroContagem ativo={comDisputas} texto="Com disputas" numero={resultado.contagens.comDisputas} aoClicar={() => alterar(setComDisputas, !comDisputas)} />
    </nav>
    <section className="painel-dashboard-form grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <label className="space-y-1 sm:col-span-2"><span className="text-xs font-semibold">Pesquisar</span><span className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3"><Search className="size-4 text-muted-foreground" /><input value={pesquisaInput} onChange={evento => setPesquisaInput(evento.target.value)} placeholder="Nome, e-mail ou telefone" className="w-full bg-transparent text-sm outline-none" /></span></label>
      <CampoSelect rotulo="Tipo" valor={tipo} aoAlterar={valor => alterar(setTipo, valor as TipoCompradorAdmin | 'todos')} itens={[['todos', 'Todos'], ['casa', 'Casa'], ['negocio', 'Negócio']]} />
      <CampoSelect rotulo="Estado" valor={estado} aoAlterar={valor => alterar(setEstado, valor as 'todos' | 'ativo' | 'inativo')} itens={[['todos', 'Todos'], ['ativo', 'Ativos'], ['inativo', 'Inativos']]} />
      <CampoSelect rotulo="Província" valor={filtroTerritorial.provinciaId || 'todas'} aoAlterar={valor => { filtroTerritorial.selecionarProvincia(valor === 'todas' ? '' : valor); setOffset(0); }} itens={[['todas', filtroTerritorial.aCarregarProvincias ? 'A carregar províncias...' : 'Todas as províncias'], ...filtroTerritorial.provincias.map(item => [item.id, item.nome] as [string, string])]} desativado={filtroTerritorial.aCarregarProvincias} />
      <CampoSelect rotulo="Município" valor={filtroTerritorial.municipioId || 'todos'} aoAlterar={valor => { filtroTerritorial.selecionarMunicipio(valor === 'todos' ? '' : valor); setOffset(0); }} itens={[['todos', !filtroTerritorial.provinciaId ? 'Selecione primeiro a província' : filtroTerritorial.aCarregarMunicipios ? 'A carregar municípios...' : 'Todos os municípios'], ...filtroTerritorial.municipios.map(item => [item.id, item.nome] as [string, string])]} desativado={!filtroTerritorial.provinciaId || filtroTerritorial.aCarregarMunicipios || Boolean(filtroTerritorial.erroMunicipios)} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:col-span-2"><Alternador texto="Com cancelamentos" marcado={comCancelamentos} aoAlterar={valor => alterar(setComCancelamentos, valor)} /><Alternador texto="Registados recentemente" marcado={recentes} aoAlterar={valor => alterar(setRecentes, valor)} /></div>
    </section>
    {filtroTerritorial.erroProvincias && <p className="text-xs text-destructive">{filtroTerritorial.erroProvincias} <button type="button" onClick={() => void filtroTerritorial.carregarProvincias()} className="font-semibold underline">Tentar novamente</button></p>}
    {filtroTerritorial.erroMunicipios && <p className="text-xs text-destructive">{filtroTerritorial.erroMunicipios} <button type="button" onClick={filtroTerritorial.recarregarMunicipios} className="font-semibold underline">Tentar novamente</button></p>}
    {erro ? <Erro aoTentar={carregar} /> : aCarregar && resultado.itens.length === 0 ? <p className="painel-dashboard-form text-sm text-muted-foreground">A carregar compradores…</p> : <>
      {resultado.itens.length === 0 ? <p className="painel-dashboard-form border-dashed py-12 text-center text-sm text-muted-foreground">Nenhum comprador encontrado com estes filtros.</p> : <div className={`grid gap-3 ${aCarregar ? 'opacity-60' : ''}`}>{resultado.itens.map(comprador => <article key={comprador.clienteId} className="rounded-2xl border-2 border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"><div className="flex flex-col gap-4 sm:flex-row"><Avatar nome={comprador.nome} fotoUrl={comprador.fotoUrl} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-titulo text-lg font-bold">{comprador.nome}</h2><Etiqueta texto={comprador.tipoComprador === 'negocio' ? 'Negócio' : 'Casa'} /><Etiqueta texto={comprador.contaAtiva ? 'Ativa' : 'Inativa'} variante={comprador.contaAtiva ? 'sucesso' : 'neutra'} /></div><div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4"><p className="break-all">{comprador.email || 'Sem e-mail'}</p><p>{comprador.telefone || 'Sem telefone'}</p><p className="flex items-center gap-1"><MapPin className="size-3.5 text-primary" />{[comprador.municipio, comprador.provincia].filter(Boolean).join(', ') || 'Localização não indicada'}</p><p className="flex items-center gap-1"><CalendarDays className="size-3.5 text-primary" />{formatarData(comprador.criadoEm)}</p></div><div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-center text-sm sm:max-w-md"><Metrica texto="Encomendas" valor={comprador.totalEncomendas} /><Metrica texto="Cancelamentos" valor={comprador.encomendasCanceladas} /><Metrica texto="Disputas" valor={comprador.totalDisputas} /></div><p className="mt-3 text-xs text-muted-foreground">Última atividade: {formatarData(comprador.ultimaAtividadeEm)}</p></div><Link to={`/dashboard/compradores/${comprador.clienteId}`} className="inline-flex shrink-0 items-center gap-1 self-start rounded-md border border-primary px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5">Ver comprador <ExternalLink className="size-4" /></Link></div></article>)}</div>}
      <footer className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">{resultado.paginacao.totalResultados} resultado{resultado.paginacao.totalResultados === 1 ? '' : 's'} · Página {paginaAtual} de {totalPaginas}</p><div className="flex gap-2"><button disabled={resultado.paginacao.offset === 0 || aCarregar} onClick={() => setOffset(valor => Math.max(0, valor - resultado.paginacao.limite))} className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-xs font-semibold disabled:opacity-50"><ChevronLeft className="size-4" />Anterior</button><button disabled={resultado.paginacao.offset + resultado.paginacao.limite >= resultado.paginacao.totalResultados || aCarregar} onClick={() => setOffset(valor => valor + resultado.paginacao.limite)} className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-xs font-semibold disabled:opacity-50">Próxima<ChevronRight className="size-4" /></button></div></footer>
    </>}
  </div>;
}

function CampoSelect({ rotulo, valor, aoAlterar, itens, desativado = false }: { rotulo: string; valor: string; aoAlterar: (valor: string) => void; itens: Array<[string, string]>; desativado?: boolean }) { return <label className="space-y-1"><span className="text-xs font-semibold">{rotulo}</span><Select value={valor} onValueChange={aoAlterar} disabled={desativado}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{itens.map(([valorItem, texto]) => <SelectItem key={valorItem} value={valorItem}>{texto}</SelectItem>)}</SelectContent></Select></label>; }
function FiltroContagem({ ativo, texto, numero, aoClicar }: { ativo: boolean; texto: string; numero: number; aoClicar: () => void }) { return <button onClick={aoClicar} className={`rounded-full border px-3 py-2 text-xs font-semibold ${ativo ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/40'}`}>{texto} ({numero})</button>; }
function Alternador({ texto, marcado, aoAlterar }: { texto: string; marcado: boolean; aoAlterar: (valor: boolean) => void }) { return <label className="flex items-center gap-2"><input type="checkbox" checked={marcado} onChange={evento => aoAlterar(evento.target.checked)} className="size-4 accent-primary" />{texto}</label>; }
function Avatar({ nome, fotoUrl }: { nome: string; fotoUrl: string | null }) { return fotoUrl ? <img src={fotoUrl} alt={`Foto de ${nome}`} className="size-14 shrink-0 rounded-full border-2 border-primary/20 object-cover" /> : <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-titulo font-bold text-primary-foreground">{nome.trim().charAt(0).toUpperCase() || '?'}</span>; }
function Etiqueta({ texto, variante = 'normal' }: { texto: string; variante?: 'normal' | 'sucesso' | 'neutra' }) { const classe = variante === 'sucesso' ? 'border-green-200 bg-green-50 text-green-800' : variante === 'neutra' ? 'border-border bg-muted text-muted-foreground' : 'border-primary/20 bg-primary/5 text-primary'; return <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${classe}`}>{texto}</span>; }
function Metrica({ texto, valor }: { texto: string; valor: number }) { return <div><p className="font-titulo text-base font-bold text-primary">{valor}</p><p className="text-[11px] text-muted-foreground">{texto}</p></div>; }
function Erro({ aoTentar }: { aoTentar: () => Promise<void> }) { return <div className="painel-dashboard-form border-destructive/30"><p className="font-semibold text-destructive">Não foi possível carregar compradores.</p><button onClick={() => void aoTentar()} className="mt-3 rounded-md border border-destructive px-3 py-2 text-xs font-semibold text-destructive">Tentar novamente</button></div>; }
