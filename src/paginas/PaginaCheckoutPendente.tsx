import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, MapPin, PackageX, ShoppingBag, Truck } from 'lucide-react';
import Cabecalho from '@/componentes/Cabecalho';
import Rodape from '@/componentes/Rodape';
import { useAuth } from '@/contextos/AuthContexto';
import { useCarrinho } from '@/hooks/useCarrinho';
import { agruparItensPorVendedor, subtotalCarrinhoCentimos, subtotalEstimadoCentimos } from '@/dominio/carrinho';
import { formatarCentimosAoa } from '@/dominio/encomendas';
import { criarEncomendaLevantamento } from '@/services/encomendas';
import { atualizarEstadoItensCarrinho, obterLocaisLevantamento, type LocalLevantamentoVendedor } from '@/services/carrinho';
import { useToast } from '@/hooks/use-toast';

type ResultadoGrupo = { vendedorId: string; vendedor: string; encomendaId?: string; codigo?: string; erro?: string };

function mensagemAmigavel(erro: unknown) {
  const mensagem = erro instanceof Error
    ? erro.message
    : typeof erro === 'object' && erro !== null && 'message' in erro && typeof erro.message === 'string'
      ? erro.message
      : '';
  if (mensagem.includes('não existe ou não está disponível')) return 'Um produto deste grupo deixou de estar disponível.';
  if (mensagem.includes('não está elegível') || mensagem.includes('não está disponível para receber')) return 'Este vendedor não está disponível para receber encomendas.';
  if (mensagem.includes('quantidade')) return 'Uma quantidade já não respeita o mínimo definido pelo vendedor.';
  return 'Não foi possível criar esta encomenda. Reveja os produtos e tente novamente.';
}

export default function PaginaCheckoutPendente() {
  const { utilizador, pronto } = useAuth(); const { toast } = useToast(); const navigate = useNavigate();
  const { itens, atualizarItens, removerItens } = useCarrinho();
  const [nome, setNome] = useState(''); const [telefone, setTelefone] = useState(''); const [observacoes, setObservacoes] = useState('');
  const [locais, setLocais] = useState<Map<string, LocalLevantamentoVendedor>>(new Map()); const [aValidar, setAValidar] = useState(false); const [aConfirmar, setAConfirmar] = useState(false); const [resultados, setResultados] = useState<ResultadoGrupo[]>([]);

  useEffect(() => { setNome(utilizador?.nome || ''); setTelefone(utilizador?.telefone || ''); }, [utilizador?.nome, utilizador?.telefone]);
  const grupos = useMemo(() => agruparItensPorVendedor(itens), [itens]);
  const carregar = useCallback(async () => {
    if (!itens.length) return;
    try {
      setAValidar(true);
      const itensAtualizados = await atualizarEstadoItensCarrinho(itens);
      atualizarItens(itensAtualizados);
      setLocais(await obterLocaisLevantamento(itensAtualizados.map((item) => item.vendedor_id)));
    } catch { toast({ title: 'Não foi possível revalidar o carrinho.', variant: 'destructive' }); } finally { setAValidar(false); }
  }, [atualizarItens, itens, toast]);
  useEffect(() => { void carregar(); }, [carregar]);

  const temIndisponivel = itens.some((item) => !item.disponivel);
  const confirmar = async () => {
    if (utilizador?.papel !== 'cliente') { toast({ title: 'Entre com uma conta de cliente para confirmar encomendas.', variant: 'destructive' }); return; }
    if (!nome.trim() || !telefone.trim()) { toast({ title: 'Indique nome e telefone para o levantamento.', variant: 'destructive' }); return; }
    const itensAtualizados = await atualizarEstadoItensCarrinho(itens);
    atualizarItens(itensAtualizados);
    const gruposAtualizados = agruparItensPorVendedor(itensAtualizados);
    if (itensAtualizados.some((item) => !item.disponivel)) { toast({ title: 'Existem produtos indisponíveis no carrinho.', description: 'Remova-os ou volte a tentar mais tarde.', variant: 'destructive' }); return; }
    setAConfirmar(true); setResultados([]);
    const resposta: ResultadoGrupo[] = [];
    for (const grupo of gruposAtualizados) {
      try {
        const encomenda = await criarEncomendaLevantamento({ itens: grupo.itens.map((item) => ({ produto_id: item.produto_id, quantidade: item.quantidade })), modalidade: 'levantamento', nomeDestinatario: nome, telefoneDestinatario: telefone, observacoesCliente: observacoes });
        resposta.push({ vendedorId: grupo.vendedor_id, vendedor: grupo.vendedor_nome, encomendaId: encomenda.id, codigo: encomenda.codigo_publico });
      } catch (erro) { resposta.push({ vendedorId: grupo.vendedor_id, vendedor: grupo.vendedor_nome, erro: mensagemAmigavel(erro) }); }
    }
    const criadas = resposta.filter((resultado) => resultado.encomendaId);
    if (criadas.length) removerItens(gruposAtualizados.filter((grupo) => criadas.some((resultado) => resultado.vendedorId === grupo.vendedor_id)).flatMap((grupo) => grupo.itens.map((item) => item.produto_id)));
    setResultados(resposta); setAConfirmar(false);
    if (criadas.length === resposta.length) {
      toast({ title: resposta.length === 1 ? 'Encomenda criada com sucesso.' : 'Encomendas criadas com sucesso.' });
      if (criadas.length === 1) navigate(`/dashboard/encomendas/${criadas[0].encomendaId}`); else navigate('/dashboard/encomendas');
    }
  };

  if (!pronto) return null;
  if (!utilizador) return <div className="flex min-h-screen flex-col"><Cabecalho /><main className="container flex-1 py-12 text-center"><h1 className="font-titulo text-2xl font-bold">Entre para continuar</h1><Link to="/login" state={{ destino: '/checkout' }} className="mt-4 inline-block rounded-lg bg-green-800 px-4 py-2 font-semibold text-white">Entrar</Link></main><Rodape /></div>;
  if (utilizador.papel !== 'cliente') return <div className="flex min-h-screen flex-col"><Cabecalho /><main className="container flex-1 py-12 text-center"><h1 className="font-titulo text-2xl font-bold">Checkout disponível para clientes</h1><p className="mt-2 text-sm text-muted-foreground">Esta conta pode consultar produtos, mas não pode criar encomendas como cliente.</p><Link to="/carrinho" className="mt-4 inline-block rounded-lg border border-green-700 px-4 py-2 font-semibold text-green-800">Voltar ao carrinho</Link></main><Rodape /></div>;
  if (itens.length === 0) return <div className="flex min-h-screen flex-col"><Cabecalho /><main className="container flex-1 py-12 text-center"><ShoppingBag className="mx-auto size-10 text-muted-foreground" /><h1 className="mt-3 font-titulo text-2xl font-bold">O carrinho está vazio</h1><Link to="/pesquisa" className="mt-4 inline-block rounded-lg bg-green-800 px-4 py-2 font-semibold text-white">Ver produtos</Link></main><Rodape /></div>;

  return <div className="flex min-h-screen flex-col"><Cabecalho /><main className="container flex-1 py-6"><Link to="/carrinho" className="text-sm text-muted-foreground hover:text-green-800">← Voltar ao carrinho</Link><header className="mt-4 rounded-2xl bg-green-800 p-6 text-white"><h1 className="font-titulo text-3xl font-bold">Confirmar encomenda</h1><p className="mt-2 text-sm text-green-100">Levantamento no vendedor. Cada vendedor receberá uma encomenda separada.</p></header><div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]"><div className="space-y-5"><section className="rounded-2xl border bg-card p-5"><h2 className="font-titulo text-xl font-bold">Dados para levantamento</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Nome<input value={nome} onChange={(evento) => setNome(evento.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="text-sm font-medium">Telefone<input value={telefone} onChange={(evento) => setTelefone(evento.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label></div><label className="mt-3 block text-sm font-medium">Observações (opcional)<textarea value={observacoes} onChange={(evento) => setObservacoes(evento.target.value)} className="mt-1 min-h-20 w-full rounded-lg border px-3 py-2" placeholder="Indicação para o vendedor" /></label></section>{grupos.map((grupo) => { const local = locais.get(grupo.vendedor_id); return <section key={grupo.vendedor_id} className="rounded-2xl border bg-card p-5"><h2 className="font-titulo text-xl font-bold text-green-900">{local?.nome_comercial || grupo.vendedor_nome}</h2><div className="mt-3 space-y-2 text-sm">{grupo.itens.map((item) => <div key={item.produto_id} className="flex justify-between gap-3"><span>{item.nome} <span className="text-muted-foreground">× {item.quantidade} {item.unidade}</span></span><span>{formatarCentimosAoa(item.quantidade * (item.preco_retalho_centimos || 0))}</span></div>)}</div><div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-950"><p className="flex items-center gap-1 font-semibold"><MapPin className="size-4" />Local de levantamento</p><p className="mt-1">{[local?.provincia, local?.municipio, local?.bairro, local?.endereco_detalhado, local?.ponto_referencia].filter(Boolean).join(' · ') || 'O vendedor confirmará o local de levantamento.'}</p></div><p className="mt-3 text-xs text-muted-foreground">O valor final é confirmado pela ANGROLINK no momento da criação.</p></section>; })}{resultados.length > 0 && <section className="rounded-2xl border p-5"><h2 className="font-titulo text-lg font-bold">Resultado da confirmação</h2>{resultados.map((resultado) => <p key={resultado.vendedorId} className={`mt-2 text-sm ${resultado.encomendaId ? 'text-green-800' : 'text-red-700'}`}>{resultado.encomendaId ? <CheckCircle2 className="mr-1 inline size-4" /> : '✕ '}{resultado.vendedor}: {resultado.encomendaId ? `encomenda ${resultado.codigo || 'criada'}` : resultado.erro}</p>)}</section>}</div><aside className="h-fit rounded-2xl border-2 border-green-200 bg-green-50 p-5"><h2 className="font-titulo text-xl font-bold">Resumo</h2><p className="mt-3 text-sm">{grupos.length} vendedor(es) · {itens.length} produto(s)</p><p className="mt-4 text-2xl font-bold text-green-900">{formatarCentimosAoa(subtotalCarrinhoCentimos(itens))}</p><p className="mt-1 text-xs text-muted-foreground">Estimativa; preços e disponibilidade são validados no servidor.</p><button type="button" disabled={aConfirmar || aValidar || temIndisponivel} onClick={() => void confirmar()} className="mt-5 w-full rounded-lg bg-green-800 px-4 py-3 font-semibold text-white disabled:opacity-50">{aConfirmar ? 'A criar encomendas…' : aValidar ? 'A validar carrinho…' : 'Confirmar todas as encomendas'}</button><button type="button" disabled className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm text-muted-foreground"><Truck className="size-4" />Entrega — em breve</button>{temIndisponivel && <p className="mt-3 flex gap-1 text-xs text-red-700"><PackageX className="size-4" />Remova produtos indisponíveis antes de confirmar.</p>}</aside></div></main><Rodape /></div>;
}
