import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, FileWarning, Mail, MapPin, Phone, Search } from 'lucide-react';
import { useAtualizacaoTempoReal } from '@/hooks/useAtualizacaoTempoReal';
import { useFiltroTerritorialAngola } from '@/hooks/useFiltroTerritorialAngola';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  listarUtilizadoresAdmin,
  type EstadoDiretorioAdmin,
  type PapelDiretorioAdmin,
  type ResultadoDiretorioAdmin,
  type UtilizadorDiretorioAdmin,
} from '@/services/adminUtilizadores';

const LIMITE = 25;
const vazio: ResultadoDiretorioAdmin = {
  itens: [],
  paginacao: { totalResultados: 0, limite: LIMITE, offset: 0 },
  contagens: { totalGlobal: 0, clientes: 0, vendedores: 0, parceirosEntrega: 0, administradores: 0 },
};

const filtrosPapel: Array<{ valor: PapelDiretorioAdmin | 'todos'; rotulo: string; chaveContagem: keyof ResultadoDiretorioAdmin['contagens'] }> = [
  { valor: 'todos', rotulo: 'Todos', chaveContagem: 'totalGlobal' },
  { valor: 'cliente', rotulo: 'Compradores', chaveContagem: 'clientes' },
  { valor: 'vendedor', rotulo: 'Vendedores', chaveContagem: 'vendedores' },
  { valor: 'parceiro_entrega', rotulo: 'Entregadores', chaveContagem: 'parceirosEntrega' },
  { valor: 'admin', rotulo: 'Administradores', chaveContagem: 'administradores' },
];

const nomesPapel: Record<PapelDiretorioAdmin, string> = {
  cliente: 'Comprador', vendedor: 'Vendedor', parceiro_entrega: 'Entregador', admin: 'Administrador',
};
const nomesEstado: Record<EstadoDiretorioAdmin, string> = {
  ativo: 'Ativo', pendente: 'Pendente', suspenso: 'Suspenso', rejeitado: 'Rejeitado', inativo: 'Inativo',
};

export default function AdminUtilizadores() {
  const [papel, setPapel] = useState<PapelDiretorioAdmin | 'todos'>('todos');
  const [estado, setEstado] = useState<EstadoDiretorioAdmin | 'todos'>('todos');
  const filtroTerritorial = useFiltroTerritorialAngola();
  const [recentes, setRecentes] = useState(false);
  const [pesquisaInput, setPesquisaInput] = useState('');
  const [pesquisa, setPesquisa] = useState('');
  const [offset, setOffset] = useState(0);
  const [resultado, setResultado] = useState<ResultadoDiretorioAdmin>(vazio);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    const temporizador = window.setTimeout(() => { setPesquisa(pesquisaInput); setOffset(0); }, 350);
    return () => window.clearTimeout(temporizador);
  }, [pesquisaInput]);

  const carregar = useCallback(async () => {
    setACarregar(true);
    setErro(false);
    try {
      setResultado(await listarUtilizadoresAdmin({
        papel: papel === 'todos' ? null : papel,
        estado: estado === 'todos' ? null : estado,
        provincia: filtroTerritorial.provinciaSelecionada?.nome ?? null,
        registoRecente: recentes || null,
        pesquisa,
        limite: LIMITE,
        offset,
      }));
    } catch {
      setErro(true);
    } finally {
      setACarregar(false);
    }
  }, [estado, filtroTerritorial.provinciaSelecionada, offset, papel, pesquisa, recentes]);

  useEffect(() => { void carregar(); }, [carregar]);
  useAtualizacaoTempoReal(['clientes', 'vendedores', 'parceiros_entrega', 'administradores', 'profiles'], carregar);

  const alterarFiltro = <T,>(definir: (valor: T) => void, valor: T) => { definir(valor); setOffset(0); };
  const paginaAtual = Math.floor(resultado.paginacao.offset / Math.max(resultado.paginacao.limite, 1)) + 1;
  const totalPaginas = Math.max(1, Math.ceil(resultado.paginacao.totalResultados / Math.max(resultado.paginacao.limite, 1)));
  const podeAnterior = resultado.paginacao.offset > 0;
  const podeSeguinte = resultado.paginacao.offset + resultado.paginacao.limite < resultado.paginacao.totalResultados;

  return <div className="space-y-6">
    <header className="painel-dashboard-cabecalho">
      <h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">Gestão de Utilizadores</h1>
      <p className="relative z-10 mt-1 font-corpo text-sm text-primary-foreground/80">Diretório administrativo de contas, capacidades e estados operacionais.</p>
    </header>

    <nav className="flex flex-wrap gap-2" aria-label="Filtrar por papel">
      {filtrosPapel.map(filtro => <button key={filtro.valor} onClick={() => alterarFiltro(setPapel, filtro.valor)} className={`rounded-full border px-3 py-2 font-corpo text-xs font-semibold transition-colors ${papel === filtro.valor ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/40'}`}>
        {filtro.rotulo} ({resultado.contagens[filtro.chaveContagem]})
      </button>)}
    </nav>

    <section className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="space-y-1 sm:col-span-2"><span className="font-corpo text-xs font-semibold">Pesquisar</span><span className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3"><Search className="size-4 text-muted-foreground"/><input value={pesquisaInput} onChange={evento => setPesquisaInput(evento.target.value)} placeholder="Nome, e-mail ou telefone" className="w-full bg-transparent font-corpo text-sm outline-none"/></span></label>
      <CampoSelect rotulo="Estado" valor={estado} aoAlterar={valor => alterarFiltro(setEstado, valor as EstadoDiretorioAdmin | 'todos')} itens={[['todos', 'Todos os estados'], ...Object.entries(nomesEstado)]}/>
      <CampoSelect rotulo="Província" valor={filtroTerritorial.provinciaId || 'todas'} aoAlterar={valor => { filtroTerritorial.selecionarProvincia(valor === 'todas' ? '' : valor); setOffset(0); }} itens={[['todas', filtroTerritorial.aCarregarProvincias ? 'A carregar províncias...' : 'Todas as províncias'], ...filtroTerritorial.provincias.map(item => [item.id, item.nome] as [string, string])]} desativado={filtroTerritorial.aCarregarProvincias} />
      <label className="flex items-center gap-2 font-corpo text-sm sm:col-span-2 lg:col-span-4"><input type="checkbox" checked={recentes} onChange={evento => alterarFiltro(setRecentes, evento.target.checked)} className="size-4 accent-primary"/>Registados nos últimos 30 dias</label>
    </section>
    {filtroTerritorial.erroProvincias && <p className="text-xs text-destructive">{filtroTerritorial.erroProvincias} <button type="button" onClick={() => void filtroTerritorial.carregarProvincias()} className="font-semibold underline">Tentar novamente</button></p>}

    {erro ? <EstadoMensagem titulo="Não foi possível carregar utilizadores" descricao="Tente novamente. Os dados sensíveis não foram expostos." acao={() => void carregar()} /> : aCarregar && resultado.itens.length === 0 ? <p className="py-10 text-center font-corpo text-sm text-muted-foreground">A carregar utilizadores…</p> : <>
      {resultado.itens.length === 0 ? <p className="rounded-xl border border-dashed border-border py-10 text-center font-corpo text-sm text-muted-foreground">Nenhum utilizador encontrado com estes filtros.</p> : <div className={`space-y-3 ${aCarregar ? 'opacity-60' : ''}`}>{resultado.itens.map(utilizador => <CartaoUtilizador key={utilizador.userId} utilizador={utilizador} papelDestacado={papel === 'todos' ? null : papel} />)}</div>}
      <footer className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"><p className="font-corpo text-xs text-muted-foreground">{resultado.paginacao.totalResultados} resultado{resultado.paginacao.totalResultados === 1 ? '' : 's'} · Página {paginaAtual} de {totalPaginas}</p><div className="flex gap-2"><button disabled={!podeAnterior || aCarregar} onClick={() => setOffset(valor => Math.max(0, valor - resultado.paginacao.limite))} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 font-corpo text-xs font-semibold disabled:opacity-50"><ChevronLeft className="size-4"/>Anterior</button><button disabled={!podeSeguinte || aCarregar} onClick={() => setOffset(valor => valor + resultado.paginacao.limite)} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 font-corpo text-xs font-semibold disabled:opacity-50">Próxima<ChevronRight className="size-4"/></button></div></footer>
    </>}
  </div>;
}

function CampoSelect({ rotulo, valor, aoAlterar, itens, desativado = false }: { rotulo: string; valor: string; aoAlterar: (valor: string) => void; itens: Array<[string, string]>; desativado?: boolean }) {
  return <label className="space-y-1"><span className="font-corpo text-xs font-semibold">{rotulo}</span><Select value={valor} onValueChange={aoAlterar} disabled={desativado}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{itens.map(([valorItem, rotuloItem]) => <SelectItem key={valorItem} value={valorItem}>{rotuloItem}</SelectItem>)}</SelectContent></Select></label>;
}

function CartaoUtilizador({ utilizador, papelDestacado }: { utilizador: UtilizadorDiretorioAdmin; papelDestacado: PapelDiretorioAdmin | null }) {
  const papeisOrdenados = [...utilizador.papeis].sort((a, b) => Number(b === papelDestacado) - Number(a === papelDestacado));
  const pendencias = [utilizador.pendenciasDocumentaisPapeis.vendedor && 'Vendedor', utilizador.pendenciasDocumentaisPapeis.parceiro_entrega && 'Entregador'].filter(Boolean).join(' · ');
  return <article className="painel-dashboard-item p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-start"><Avatar utilizador={utilizador}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-titulo text-base font-bold">{utilizador.nomeApresentacao}</h2>{papeisOrdenados.map(papel => <span key={papel} className={`rounded-full border px-2 py-0.5 font-corpo text-[11px] font-semibold ${papel === papelDestacado ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>{nomesPapel[papel]}</span>)}</div><div className="mt-3 grid gap-2 font-corpo text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4"><Info icone={<Mail className="size-3.5"/>} valor={utilizador.email || 'Sem e-mail'}/><Info icone={<Phone className="size-3.5"/>} valor={utilizador.telefone || 'Sem telefone'}/><Info icone={<MapPin className="size-3.5"/>} valor={[utilizador.municipio, utilizador.provincia].filter(Boolean).join(', ') || 'Localização não indicada'}/><Info icone={<CalendarDays className="size-3.5"/>} valor={`Registado em ${new Date(utilizador.criadoEm).toLocaleDateString('pt-AO')}`}/></div><div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">{papeisOrdenados.map(papel => <EstadoPapel key={papel} papel={papel} estado={utilizador.estadosPapeis[papel] || 'inativo'} destacado={papel === papelDestacado}/>)}</div>{utilizador.temPendenciaDocumental && <p className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-corpo text-xs text-amber-800"><FileWarning className="size-3.5"/>Documentação pendente{pendencias ? `: ${pendencias}` : ''}</p>}</div>{utilizador.papeis.includes('cliente') ? <Link to={`/dashboard/compradores/${utilizador.userId}`} className="self-start rounded-md border border-primary px-3 py-2 font-corpo text-xs font-semibold text-primary hover:bg-primary/5">Ver detalhes</Link> : <button disabled title="O detalhe especializado ainda não está disponível para este papel." className="self-start rounded-md border border-border px-3 py-2 font-corpo text-xs font-semibold text-muted-foreground disabled:cursor-not-allowed">Detalhe em breve</button>}</div></article>;
}

function Avatar({ utilizador }: { utilizador: UtilizadorDiretorioAdmin }) { return utilizador.fotoUrl ? <img src={utilizador.fotoUrl} alt={`Foto de ${utilizador.nomeApresentacao}`} className="size-14 shrink-0 rounded-full border-2 border-primary/20 object-cover"/> : <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-titulo font-bold text-primary-foreground">{utilizador.nomeApresentacao.trim().charAt(0).toUpperCase() || '?'}</span>; }
function Info({ icone, valor }: { icone: ReactNode; valor: string }) { return <span className="flex min-w-0 items-center gap-1.5"><span className="shrink-0 text-primary">{icone}</span><span className="truncate">{valor}</span></span>; }
function EstadoPapel({ papel, estado, destacado }: { papel: PapelDiretorioAdmin; estado: EstadoDiretorioAdmin; destacado: boolean }) { const classe = estado === 'ativo' ? 'border-primary/30 bg-primary/5 text-primary' : estado === 'pendente' ? 'border-amber-500/40 bg-amber-500/10 text-amber-800' : 'border-destructive/30 bg-destructive/5 text-destructive'; return <span className={`rounded-md border px-2 py-1 font-corpo text-xs ${classe} ${destacado ? 'ring-1 ring-primary/25' : ''}`}>{nomesPapel[papel]}: {nomesEstado[estado]}</span>; }
function EstadoMensagem({ titulo, descricao, acao }: { titulo: string; descricao: string; acao: () => void }) { return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5"><p className="font-titulo font-bold text-destructive">{titulo}</p><p className="mt-1 font-corpo text-sm text-muted-foreground">{descricao}</p><button onClick={acao} className="mt-3 rounded-md border border-destructive px-3 py-2 font-corpo text-xs font-semibold text-destructive">Tentar novamente</button></div>; }
