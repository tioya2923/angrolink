import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ClipboardList, Clock3, FileCheck2, MapPin, ShieldAlert, Truck, CircleHelp, Phone, MessageCircle } from 'lucide-react';
import { useAuth } from '@/contextos/AuthContexto';
import { useToast } from '@/hooks/use-toast';
import { useAtualizacaoTempoReal } from '@/hooks/useAtualizacaoTempoReal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SeletorTelefone from '@/componentes/SeletorTelefone';
import { PROVINCIAS, MUNICIPIOS } from '@/dados/constantes';
import { separarIndicativo } from '@/dados/paises';
import { normalizarEmail, telefoneCompleto } from '@/lib/verificacoesConta';
import { atualizarDisponibilidadeParceiroEntrega, atualizarMeuParceiroEntrega, fetchMeuParceiroEntrega, reenviarDocumentoParceiro, obterUrlDocumentoParceiro, uploadFotoPerfilParceiro } from '@/services/api';

type SecaoParceiro = 'resumo' | 'pedidos' | 'dados' | 'veiculo' | 'areas' | 'documentos' | 'apoio';

const TITULOS: Record<SecaoParceiro, [string, string]> = {
  resumo: ['Painel do entregador', 'Acompanhe a sua conta, disponibilidade e preparação para receber pedidos.'],
  pedidos: ['Pedidos de entrega', 'Aqui aparecerão os pedidos compatíveis com a sua zona, veículo e capacidade.'],
  dados: ['Dados e perfil', 'Atualize o seu nome, contactos, endereço e fotografia de perfil.'],
  veiculo: ['Veículo e disponibilidade', 'Mantenha o veículo validado e indique quando está pronto para entregar.'],
  areas: ['Cobertura', 'Defina as zonas em que pode receber pedidos.'],
  documentos: ['Documentos e verificação', 'Acompanhe o estado da documentação enviada para análise.'],
  apoio: ['Apoio ANGROLINK', 'Encontre orientações para trabalhar na plataforma e resolver situações da conta.'],
};

const NOME_DOCUMENTO: Record<string, string> = {
  bi: 'Bilhete de Identidade',
  carta_conducao: 'Carta de condução',
  livrete_veiculo: 'Livrete / título do veículo',
  seguro_automovel: 'Seguro automóvel',
  inspecao_tecnica: 'Inspeção técnica',
  licenca_transporte_mercadorias: 'Licença de transporte de mercadorias',
};

export default function ParceiroResumo({ secao = 'resumo' }: { secao?: SecaoParceiro }) {
  const { utilizador } = useAuth();
  const { toast } = useToast();
  const [parceiro, setParceiro] = useState<any>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [fotoVeiculoUrl, setFotoVeiculoUrl] = useState<string | null>(null);
  const [fotoPerfilUrl, setFotoPerfilUrl] = useState<string | null>(null);

  const carregarParceiro = async () => {
    if (!utilizador?.id) return;
    try {
      const dados = await fetchMeuParceiroEntrega(utilizador.id);
      setParceiro(dados);
      const caminhoFoto = dados?.veiculos_entrega?.[0]?.foto_veiculo_path;
      if (caminhoFoto) {
        try {
          setFotoVeiculoUrl(await obterUrlDocumentoParceiro(caminhoFoto));
        } catch {
          setFotoVeiculoUrl(null);
        }
      } else setFotoVeiculoUrl(null);
      if (dados?.foto_perfil_url) {
        try {
          setFotoPerfilUrl(await obterUrlDocumentoParceiro(dados.foto_perfil_url));
        } catch {
          setFotoPerfilUrl(null);
        }
      } else setFotoPerfilUrl(null);
    } catch {
      toast({ title: 'Não foi possível carregar os seus dados.', variant: 'destructive' });
    }
  };

  useEffect(() => {
    void carregarParceiro();
  }, [utilizador?.id]);

  useAtualizacaoTempoReal(
    ['parceiros_entrega', 'veiculos_entrega', 'documentos_parceiro_entrega', 'areas_cobertura_entrega'],
    carregarParceiro,
  );

  const aprovado = parceiro?.estado === 'aprovado';
  const veiculo = parceiro?.veiculos_entrega?.[0];
  const documentos = useMemo(() => parceiro?.documentos_parceiro_entrega || [], [parceiro]);
  const [titulo, descricao] = TITULOS[secao];

  const atualizarParceiro = async (dados: any) => {
    if (!parceiro) return null;
    try {
      setAGuardar(true);
      const atualizado = await atualizarMeuParceiroEntrega(parceiro.id, dados);
      // A atualização do perfil devolve apenas a tabela principal. Mantemos
      // veículos, zonas e documentos já carregados no painel.
      setParceiro((atual: any) => ({ ...atual, ...atualizado }));
      toast({ title: 'Dados atualizados com sucesso.' });
      return atualizado;
    } catch (erro: any) {
      toast({ title: 'Não foi possível guardar os dados', description: erro.message || 'Tente novamente.', variant: 'destructive' });
      throw erro;
    } finally { setAGuardar(false); }
  };

  const mudarDisponibilidade = async (disponibilidade: boolean) => {
    if (!parceiro) return;
    try {
      setAGuardar(true);
      await atualizarDisponibilidadeParceiroEntrega(parceiro.id, disponibilidade);
      setParceiro((atual: any) => ({ ...atual, disponibilidade }));
      toast({ title: disponibilidade ? 'Disponibilidade ativada' : 'Disponibilidade desativada' });
    } catch (erro: any) {
      toast({ title: 'Não foi possível atualizar', description: erro.message || 'Tente novamente.', variant: 'destructive' });
    } finally { setAGuardar(false); }
  };

  const reenviarDocumento = async (documento: any, frente: File, verso: File) => {
    try {
      setAGuardar(true);
      await reenviarDocumentoParceiro(documento.id, frente, verso);
      setParceiro((atual: any) => ({
        ...atual,
        estado: 'em_analise',
        documentos_parceiro_entrega: atual.documentos_parceiro_entrega.map((item: any) => item.id === documento.id ? { ...item, estado: 'pendente', motivo_rejeicao: null } : item),
      }));
      toast({ title: 'Documento reenviado', description: 'O documento voltou para análise.' });
    } catch (erro: any) {
      toast({ title: 'Não foi possível reenviar', description: erro.message || 'Tente novamente.', variant: 'destructive' });
    } finally { setAGuardar(false); }
  };

  if (!parceiro) return <p className="py-10 text-center font-corpo text-sm text-muted-foreground">A carregar painel de entregador…</p>;

  return <div className="space-y-6">
    <header className="painel-dashboard-cabecalho"><h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">{titulo}</h1><p className="relative z-10 mt-1 font-corpo text-sm text-primary-foreground/80">{descricao}</p></header>
    {secao === 'resumo' && <Resumo parceiro={parceiro} documentos={documentos} veiculo={veiculo} fotoVeiculoUrl={fotoVeiculoUrl} aprovado={aprovado} mudarDisponibilidade={mudarDisponibilidade} aGuardar={aGuardar}/>}
    {secao === 'pedidos' && <Pedidos parceiro={parceiro} aprovado={aprovado}/>} 
    {secao === 'dados' && <Dados parceiro={parceiro} fotoPerfilUrl={fotoPerfilUrl} atualizarParceiro={atualizarParceiro} aGuardar={aGuardar}/>}
    {secao === 'veiculo' && <Veiculo parceiro={parceiro} veiculo={veiculo} fotoVeiculoUrl={fotoVeiculoUrl} aprovado={aprovado} mudarDisponibilidade={mudarDisponibilidade} aGuardar={aGuardar}/>}
    {secao === 'areas' && <Areas parceiro={parceiro}/>} 
    {secao === 'documentos' && <Documentos documentos={documentos} reenviar={reenviarDocumento} aGuardar={aGuardar}/>} 
    {secao === 'apoio' && <Apoio parceiro={parceiro}/>} 
  </div>;
}

function Resumo({ parceiro, documentos, veiculo, fotoVeiculoUrl, aprovado, mudarDisponibilidade, aGuardar }: any) {
  const documentosAprovados = documentos.filter((d: any) => d.estado === 'aprovado').length;
  return <>
    <Estado parceiro={parceiro} aprovado={aprovado}/>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Indicador rotulo="Pedidos ativos" valor="0" descricao="Disponível na próxima fase" icone={<ClipboardList/>}/>
      <Indicador rotulo="Disponibilidade" valor={parceiro.disponibilidade ? 'Ativa' : 'Inativa'} descricao={parceiro.disponibilidade ? 'Pronto para pedidos' : 'Ative quando estiver pronto'} icone={<Clock3/>}/>
      <Indicador rotulo="Documentos" valor={`${documentosAprovados}/${documentos.length}`} descricao="Documentos validados" icone={<FileCheck2/>}/>
      <Indicador rotulo="Zona base" valor={parceiro.areas_cobertura_entrega?.length || 0} descricao="Zona(s) registada(s)" icone={<MapPin/>}/>
    </div>
    <div className="grid gap-5 lg:grid-cols-2"><Disponibilidade parceiro={parceiro} aprovado={aprovado} mudar={mudarDisponibilidade} aGuardar={aGuardar}/><ResumoVeiculo veiculo={veiculo} fotoVeiculoUrl={fotoVeiculoUrl}/></div>
  </>;
}

function Dados({ parceiro, fotoPerfilUrl, atualizarParceiro, aGuardar }: any) {
  const { toast } = useToast();
  const [nome, setNome] = useState(parceiro.nome_completo || '');
  const [email, setEmail] = useState(parceiro.email || '');
  const [provincia, setProvincia] = useState(PROVINCIAS.find(p => p.nome === parceiro.provincia)?.id || '');
  const [municipio, setMunicipio] = useState(MUNICIPIOS.find(m => m.nome === parceiro.municipio && m.provincia_id === provincia)?.id || '');
  const [bairro, setBairro] = useState(parceiro.bairro || '');
  const [telefoneIndicativo, setTelefoneIndicativo] = useState('244');
  const [telefone, setTelefone] = useState('');
  const [emergenciaIndicativo, setEmergenciaIndicativo] = useState('244');
  const [emergencia, setEmergencia] = useState('');
  const [fotoPerfilFile, setFotoPerfilFile] = useState<File | null>(null);
  const [fotoPerfilPreview, setFotoPerfilPreview] = useState(fotoPerfilUrl || '');

  useEffect(() => {
    setNome(parceiro.nome_completo || '');
    setEmail(parceiro.email || '');
    setProvincia(PROVINCIAS.find(p => p.nome === parceiro.provincia)?.id || '');
    setMunicipio(MUNICIPIOS.find(m => m.nome === parceiro.municipio && m.provincia_id === provincia)?.id || '');
    setBairro(parceiro.bairro || '');

    const telefoneAtual = separarIndicativo(parceiro.telefone || '');
    setTelefoneIndicativo(telefoneAtual.indicativo);
    setTelefone(telefoneAtual.numero);

    const emergenciaAtual = separarIndicativo(parceiro.contacto_emergencia || '');
    setEmergenciaIndicativo(emergenciaAtual.indicativo);
    setEmergencia(emergenciaAtual.numero);
    setFotoPerfilPreview(fotoPerfilUrl || '');
    setFotoPerfilFile(null);
  }, [parceiro, provincia, fotoPerfilUrl]);

  useEffect(() => {
    if (!fotoPerfilFile) return;
    const url = URL.createObjectURL(fotoPerfilFile);
    setFotoPerfilPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [fotoPerfilFile]);

  const municipiosFiltrados = MUNICIPIOS.filter(m => m.provincia_id === provincia);

  const salvarDados = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }

    if (!telefone.trim()) {
      toast({ title: 'Telefone obrigatório', variant: 'destructive' });
      return;
    }

    if (!emergencia.trim()) {
      toast({ title: 'Contacto de emergência obrigatório', variant: 'destructive' });
      return;
    }

    if (!provincia || !municipio) {
      toast({ title: 'Provincia e município obrigatórios', variant: 'destructive' });
      return;
    }

    try {
      let fotoUrl = parceiro.foto_perfil_url || null;
      if (fotoPerfilFile) {
        fotoUrl = await uploadFotoPerfilParceiro(parceiro.id, fotoPerfilFile);
      }

      const dados: Record<string, unknown> = {
        nome_completo: nome,
        email: email ? normalizarEmail(email) : null,
        telefone: telefoneCompleto(telefone, telefoneIndicativo),
        provincia: PROVINCIAS.find(p => p.id === provincia)?.nome || parceiro.provincia,
        municipio: MUNICIPIOS.find(m => m.id === municipio)?.nome || parceiro.municipio,
        bairro: bairro || null,
        zona_base: bairro || parceiro.zona_base || null,
        contacto_emergencia: telefoneCompleto(emergencia, emergenciaIndicativo),
        foto_perfil_url: fotoUrl,
        atualizado_em: new Date().toISOString(),
      };

      await atualizarParceiro(dados);
      toast({ title: 'Perfil atualizado', description: 'Os seus dados foram guardados.' });
    } catch (erro: any) {
      console.error('Erro ao atualizar perfil:', erro);
    }
  };

  return (
    <form onSubmit={salvarDados} className="painel-dashboard-form space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <Label>Nome completo</Label>
          <Input value={nome} onChange={e => setNome(e.target.value)} required />
        </div>
        <div className="space-y-3">
          <Label>Email (opcional)</Label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <Label>Telefone</Label>
          <SeletorTelefone indicativo={telefoneIndicativo} onIndicativoChange={setTelefoneIndicativo} valor={telefone} onValorChange={setTelefone} required />
        </div>
        <div className="space-y-3">
          <Label>Contacto de emergência</Label>
          <SeletorTelefone indicativo={emergenciaIndicativo} onIndicativoChange={setEmergenciaIndicativo} valor={emergencia} onValorChange={setEmergencia} required />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-3">
          <Label>Província</Label>
          <select value={provincia} onChange={e => setProvincia(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground" required>
            <option value="">Selecione</option>
            {PROVINCIAS.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        <div className="space-y-3">
          <Label>Município</Label>
          <select value={municipio} onChange={e => setMunicipio(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground" required>
            <option value="">Selecione</option>
            {municipiosFiltrados.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>
        <div className="space-y-3">
          <Label>Bairro</Label>
          <Input value={bairro} onChange={e => setBairro(e.target.value)} />
        </div>
      </div>

      <div className="space-y-3">
        <Label>Foto de perfil</Label>
        <div className="flex items-center gap-4">
          <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition">
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 3 * 1024 * 1024) {
                toast({ title: 'Imagem demasiado grande', description: 'Max 3MB.', variant: 'destructive' });
                return;
              }
              setFotoPerfilFile(file);
            }} />
            Alterar foto
          </label>
          {fotoPerfilPreview && <img src={fotoPerfilPreview} alt="Foto de perfil" className="h-20 w-20 rounded-full object-cover border border-border" />}
        </div>
      </div>

      <button type="submit" disabled={aGuardar} className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
        {aGuardar ? 'A guardar...' : 'Guardar alterações'}
      </button>
    </form>
  );
}

function Estado({ parceiro, aprovado }: any) { const texto = aprovado ? 'Conta aprovada' : parceiro.estado === 'suspenso' ? 'Conta suspensa' : parceiro.estado === 'rejeitado' ? 'Pedido rejeitado' : 'Pedido em análise'; const detalhe = aprovado ? 'A sua documentação foi validada. Ative a disponibilidade quando estiver pronto para receber pedidos.' : parceiro.estado === 'suspenso' ? parceiro.motivo_suspensao || 'Contacte a equipa ANGROLINK para esclarecimentos.' : parceiro.estado === 'rejeitado' ? parceiro.motivo_rejeicao || 'Contacte a equipa ANGROLINK para saber como corrigir o pedido.' : 'A equipa ANGROLINK está a validar os seus documentos e veículo.'; return <section className={`rounded-2xl border-2 p-5 ${aprovado ? 'border-primary/30 bg-primary/5' : parceiro.estado === 'rejeitado' ? 'border-destructive/30 bg-destructive/5' : parceiro.estado === 'suspenso' ? 'border-orange-500/30 bg-orange-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}><div className="flex gap-3"><span className="mt-0.5 text-primary">{aprovado ? <CheckCircle2/> : parceiro.estado === 'suspenso' || parceiro.estado === 'rejeitado' ? <ShieldAlert/> : <Clock3/>}</span><div><h2 className="font-titulo text-lg font-bold">{texto}</h2><p className="mt-1 font-corpo text-sm text-muted-foreground">{detalhe}</p></div></div></section>; }

function Indicador({ rotulo, valor, descricao, icone }: any) { return <section className="painel-dashboard-item p-4"><span className="mb-3 block text-primary">{icone}</span><p className="font-titulo text-xl font-bold">{valor}</p><p className="font-corpo text-sm font-semibold">{rotulo}</p><p className="mt-1 font-corpo text-xs text-muted-foreground">{descricao}</p></section>; }

function Disponibilidade({ parceiro, aprovado, mudar, aGuardar }: any) { return <section className="painel-dashboard-form"><h2 className="font-titulo text-lg font-bold">Disponibilidade</h2><p className="mt-1 font-corpo text-sm text-muted-foreground">A disponibilidade só pode ser ativada depois da aprovação administrativa.</p><div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/25 p-4"><div><p className="font-corpo text-sm font-semibold">Receber pedidos de entrega</p><p className="font-corpo text-xs text-muted-foreground">{parceiro.disponibilidade ? 'Está disponível para receber pedidos.' : 'Está indisponível neste momento.'}</p></div><button disabled={!aprovado || aGuardar} onClick={() => mudar(!parceiro.disponibilidade)} className={`rounded-full px-4 py-2 font-corpo text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ${parceiro.disponibilidade ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground'}`}>{parceiro.disponibilidade ? 'Disponível' : 'Indisponível'}</button></div></section>; }

function ResumoVeiculo({ veiculo, fotoVeiculoUrl }: any) { return <section className="painel-dashboard-form"><div className="flex items-center gap-2"><Truck className="size-5 text-primary"/><h2 className="font-titulo text-lg font-bold">Veículo principal</h2></div>{veiculo ? <div className="mt-4 space-y-4"><div className="grid gap-4 sm:grid-cols-[1.5fr_1fr]"><div><p className="font-corpo text-sm font-semibold capitalize">{veiculo.tipo_veiculo} · {veiculo.marca} {veiculo.modelo}</p><p className="mt-1 font-corpo text-xs text-muted-foreground">Matrícula: {veiculo.matricula} · Capacidade: {veiculo.capacidade_kg} kg</p></div>{fotoVeiculoUrl && <img src={fotoVeiculoUrl} alt="Foto do veículo" className="h-28 w-full rounded-xl border border-border object-cover sm:w-48"/>}</div>{!fotoVeiculoUrl && <p className="text-xs text-muted-foreground">Foto do veículo ainda não disponível.</p>}</div> : <p className="mt-3 font-corpo text-sm text-muted-foreground">Nenhum veículo associado.</p>}</section>; }

function Pedidos({ parceiro, aprovado }: any) { return <section className="painel-dashboard-form text-center"><span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary"><ClipboardList className="size-7"/></span><h2 className="mt-4 font-titulo text-xl font-bold">Ainda não tem pedidos de entrega</h2><p className="mx-auto mt-2 max-w-xl font-corpo text-sm text-muted-foreground">Os pedidos aparecerão aqui quando a fase de encomendas e atribuição automática de entregadores estiver ativa. {aprovado && parceiro.disponibilidade ? 'A sua conta está preparada para os receber.' : 'Mantenha a conta aprovada e a disponibilidade ativa para estar preparado.'}</p></section>; }

function Veiculo({ parceiro, veiculo, fotoVeiculoUrl, aprovado, mudarDisponibilidade, aGuardar }: any) { return <div className="space-y-5"><Disponibilidade parceiro={parceiro} aprovado={aprovado} mudar={mudarDisponibilidade} aGuardar={aGuardar}/><section className="painel-dashboard-form"><ResumoVeiculo veiculo={veiculo} fotoVeiculoUrl={fotoVeiculoUrl}/>{veiculo && <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-3"><Info rotulo="Cor" valor={veiculo.cor}/><Info rotulo="Volume" valor={veiculo.capacidade_volume_m3 ? `${veiculo.capacidade_volume_m3} m³` : 'Não indicado'}/><Info rotulo="Estado de verificação" valor={veiculo.estado_verificacao}/></div>}</section></div>; }

function Areas({ parceiro }: any) { const zonas = parceiro.areas_cobertura_entrega || []; return <section className="painel-dashboard-form"><h2 className="font-titulo text-lg font-bold">Zonas registadas</h2><p className="mt-1 font-corpo text-sm text-muted-foreground">Os pedidos futuros serão filtrados pela zona, capacidade do veículo e disponibilidade.</p>{zonas.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{zonas.map((zona: any) => <div key={zona.id} className="rounded-xl border border-primary/20 bg-primary/5 p-4"><MapPin className="mb-2 size-5 text-primary"/><p className="font-corpo text-sm font-semibold">{[zona.bairro, zona.municipio, zona.provincia].filter(Boolean).join(', ')}</p><p className="mt-1 font-corpo text-xs text-muted-foreground">{zona.ativo ? 'Zona ativa para entregas' : 'Zona temporariamente inativa'}</p></div>)}</div> : <p className="mt-5 rounded-xl border border-dashed border-border p-6 text-center font-corpo text-sm text-muted-foreground">Ainda não foi registada uma zona de cobertura.</p>}</section>; }

function Documentos({ documentos, reenviar, aGuardar }: any) { return <section className="painel-dashboard-form"><h2 className="font-titulo text-lg font-bold">Documentação enviada</h2><p className="mt-1 font-corpo text-sm text-muted-foreground">O administrador valida cada documento antes de aprovar a conta.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{documentos.map((documento: any) => <DocumentoCard key={documento.id} documento={documento} reenviar={reenviar} aGuardar={aGuardar}/>)}</div>{!documentos.length && <div className="mt-5 rounded-xl border border-dashed border-border p-6 text-center"><p className="font-corpo text-sm text-muted-foreground">Este pedido ficou sem documentos registados.</p><Link to="/parceiro-entregas/cadastro?corrigir=1" className="mt-3 inline-flex rounded-lg bg-primary px-4 py-2 font-corpo text-sm font-semibold text-primary-foreground">Completar cadastro e reenviar</Link></div>}</section>; }

function DocumentoPrevisualizacao({ documento }: { documento: any }) {
  const [urls, setUrls] = useState<{ frente: string; verso: string } | null>(null);

  useEffect(() => {
    let ativo = true;
    Promise.all([
      obterUrlDocumentoParceiro(documento.frente_path),
      obterUrlDocumentoParceiro(documento.verso_path),
    ]).then(([frente, verso]) => {
      if (ativo) setUrls({ frente, verso });
    }).catch(() => {
      if (ativo) setUrls(null);
    });
    return () => { ativo = false; };
  }, [documento.frente_path, documento.verso_path]);

  if (!urls) return <p className="mt-3 font-corpo text-xs text-muted-foreground">A preparar as imagens do documento…</p>;
  return <div className="mt-3 grid grid-cols-2 gap-2"><a href={urls.frente} target="_blank" rel="noreferrer" className="group"><img src={urls.frente} alt="Frente do documento" className="h-20 w-full rounded-lg border border-border object-cover transition group-hover:opacity-80"/><span className="mt-1 block text-center font-corpo text-xs text-primary">Ver frente</span></a><a href={urls.verso} target="_blank" rel="noreferrer" className="group"><img src={urls.verso} alt="Verso do documento" className="h-20 w-full rounded-lg border border-border object-cover transition group-hover:opacity-80"/><span className="mt-1 block text-center font-corpo text-xs text-primary">Ver verso</span></a></div>;
}

function DocumentoCard({ documento, reenviar, aGuardar }: any) { const [frente, setFrente] = useState<File | null>(null); const [verso, setVerso] = useState<File | null>(null); const rejeitado = documento.estado === 'rejeitado'; return <div className="rounded-xl border border-border bg-muted/20 p-4"><FileCheck2 className="mb-2 size-5 text-primary"/><p className="font-corpo text-sm font-semibold">{NOME_DOCUMENTO[documento.tipo_documento] || documento.tipo_documento}</p><p className={`mt-2 inline-flex rounded-full border px-2 py-0.5 font-corpo text-xs ${documento.estado === 'aprovado' ? 'border-primary/30 bg-primary/10 text-primary' : rejeitado ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-amber-500/30 bg-amber-500/10 text-amber-700'}`}>{documento.estado === 'aprovado' ? 'Aprovado' : rejeitado ? 'Rejeitado' : 'Em análise'}</p><DocumentoPrevisualizacao documento={documento}/>{documento.motivo_rejeicao && <p className="mt-2 font-corpo text-xs text-destructive">{documento.motivo_rejeicao}</p>}{rejeitado && <div className="mt-4 border-t border-border pt-3"><p className="font-corpo text-xs font-semibold">Reenviar frente e verso</p><div className="grid gap-3"><div className="space-y-1"><p className="font-corpo text-xs text-muted-foreground">Nova foto da frente</p><input id={`reanexar-frente-${documento.id}`} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => setFrente(e.target.files?.[0] || null)}/><label htmlFor={`reanexar-frente-${documento.id}`} className="inline-flex cursor-pointer items-center justify-center rounded-md border-2 border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition">Escolher imagem</label></div><div className="space-y-1"><p className="font-corpo text-xs text-muted-foreground">Nova foto do verso</p><input id={`reanexar-verso-${documento.id}`} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => setVerso(e.target.files?.[0] || null)}/><label htmlFor={`reanexar-verso-${documento.id}`} className="inline-flex cursor-pointer items-center justify-center rounded-md border-2 border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition">Escolher imagem</label></div></div><button disabled={!frente || !verso || aGuardar} onClick={() => frente && verso && reenviar(documento, frente, verso)} className="mt-3 w-full rounded-lg bg-primary px-3 py-2 font-corpo text-xs font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">Reenviar para análise</button></div>}</div>; }

function Info({ rotulo, valor }: { rotulo: string; valor: string }) { return <div><p className="font-corpo text-xs text-muted-foreground">{rotulo}</p><p className="mt-1 font-corpo text-sm font-semibold capitalize">{valor}</p></div>; }

function Apoio({ parceiro }: any) {
  return <div className="grid gap-5 lg:grid-cols-2">
    <section className="painel-dashboard-form"><div className="flex items-center gap-2"><CircleHelp className="size-5 text-primary"/><h2 className="font-titulo text-lg font-bold">Como funciona</h2></div><ol className="mt-4 space-y-3 font-corpo text-sm text-muted-foreground"><li><strong className="text-foreground">1. Fique disponível:</strong> apenas depois da aprovação.</li><li><strong className="text-foreground">2. Receba pedidos:</strong> compatíveis com zona e veículo.</li><li><strong className="text-foreground">3. Recolha a mercadoria:</strong> antes de iniciar o trajeto.</li><li><strong className="text-foreground">4. Conclua a entrega:</strong> com confirmação do destinatário.</li></ol></section>
    <section className="painel-dashboard-form"><h2 className="font-titulo text-lg font-bold">Precisa de ajuda?</h2><p className="mt-2 font-corpo text-sm text-muted-foreground">Contacte a equipa ANGROLINK para corrigir documentos ou esclarecer a situação da conta.</p><div className="mt-5 flex flex-wrap gap-3"><a href="tel:+244000000000" className="inline-flex items-center gap-2 rounded-lg border border-primary/30 px-3 py-2 font-corpo text-sm font-semibold text-primary hover:bg-primary/5"><Phone className="size-4"/>Ligar ao apoio</a><a href="https://wa.me/244000000000" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 font-corpo text-sm font-semibold text-primary-foreground"><MessageCircle className="size-4"/>WhatsApp de apoio</a></div><p className="mt-4 font-corpo text-xs text-muted-foreground">Estado atual: <strong>{String(parceiro.estado).replace('_', ' ')}</strong>.</p></section>
  </div>;
}
