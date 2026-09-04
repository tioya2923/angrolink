import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, FileCheck2, Loader2, RotateCcw, Send, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contextos/AuthContexto';
import { useToast } from '@/hooks/use-toast';
import { useAtualizacaoTempoReal } from '@/hooks/useAtualizacaoTempoReal';
import { CATALOGO_DOCUMENTOS, obterRequisitosDocumentos } from '@/dados/documentosVendedor';
import type { TipoVendedor } from '@/tipos';
import { fetchMeuVendedor } from '@/services/api';
import {
  listarDocumentosVendedor,
  documentoVendedorPodeSerReenviado,
  obterUrlAssinadaDocumentoVendedor,
  reenviarDocumentoVendedor,
  submeterDocumentosVendedor,
  type DocumentoVendedorParaSubmissao,
  type DocumentoVendedor,
} from '@/services/documentosVendedor';

type FicheirosReenvio = Record<string, { frente: File | null; verso: File | null }>;
type ValoresDocumentos = Record<string, Record<string, string>>;

const rotulosEstado = {
  pendente: 'Aguardando nova análise',
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
  expirado: 'Expirado',
} as const;

const estilosEstado = {
  pendente: 'border-amber-300 bg-amber-50 text-amber-800',
  em_analise: 'border-amber-300 bg-amber-50 text-amber-800',
  aprovado: 'border-primary/30 bg-primary/10 text-primary',
  rejeitado: 'border-destructive/30 bg-destructive/10 text-destructive',
  expirado: 'border-orange-300 bg-orange-50 text-orange-800',
} as const;

export default function VendedorDocumentos() {
  const { utilizador } = useAuth();
  const { toast } = useToast();
  const [documentos, setDocumentos] = useState<DocumentoVendedor[]>([]);
  const [tipoVendedor, setTipoVendedor] = useState<TipoVendedor | ''>('');
  const [ficheiros, setFicheiros] = useState<FicheirosReenvio>({});
  const [valoresAusentes, setValoresAusentes] = useState<ValoresDocumentos>({});
  const [ficheirosAusentes, setFicheirosAusentes] = useState<FicheirosReenvio>({});
  const [aReenviar, setAReenviar] = useState<string | null>(null);
  const [aSubmeter, setASubmeter] = useState(false);
  const [aCarregar, setACarregar] = useState(true);

  const carregar = useCallback(async () => {
    if (!utilizador?.vendedor_id) return;
    setACarregar(true);
    try {
      const [vendedor, documentosAtuais] = await Promise.all([
        fetchMeuVendedor({ lancarErro: true }),
        listarDocumentosVendedor(utilizador.vendedor_id),
      ]);
      setTipoVendedor(vendedor?.tipo_vendedor ?? '');
      setDocumentos(documentosAtuais);
    } catch (erro) {
      console.error('Erro ao carregar documentos do vendedor:', erro);
      toast({ title: 'Não foi possível carregar os documentos', variant: 'destructive' });
    } finally {
      setACarregar(false);
    }
  }, [toast, utilizador?.vendedor_id]);

  useEffect(() => { void carregar(); }, [carregar]);
  useAtualizacaoTempoReal(['documentos_vendedor', 'vendedores'], carregar);

  const documentosRejeitados = useMemo(
    () => documentos.filter(documento => documento.estado === 'rejeitado'),
    [documentos],
  );

  const documentosObrigatoriosAusentes = useMemo(() => {
    const tiposExistentes = new Set<DocumentoVendedor['tipo_documento']>(documentos.map(documento => documento.tipo_documento));
    return (obterRequisitosDocumentos(tipoVendedor)?.obrigatorios ?? [])
      .filter(tipo => !tiposExistentes.has(tipo as DocumentoVendedor['tipo_documento']))
      .filter(tipo => CATALOGO_DOCUMENTOS[tipo]);
  }, [documentos, tipoVendedor]);

  const escolherFicheiro = (documentoId: string, lado: 'frente' | 'verso') => (evento: ChangeEvent<HTMLInputElement>) => {
    const ficheiro = evento.target.files?.[0] ?? null;
    setFicheiros(anterior => ({
      ...anterior,
      [documentoId]: { frente: anterior[documentoId]?.frente ?? null, verso: anterior[documentoId]?.verso ?? null, [lado]: ficheiro },
    }));
  };

  const abrirDocumento = async (caminho: string) => {
    try {
      window.open(await obterUrlAssinadaDocumentoVendedor(caminho), '_blank', 'noopener,noreferrer');
    } catch {
      toast({ title: 'Não foi possível abrir o documento', description: 'Tente novamente.', variant: 'destructive' });
    }
  };

  const reenviar = async (documento: DocumentoVendedor) => {
    const selecao = ficheiros[documento.id];
    if (!selecao?.frente) {
      toast({ title: 'Envie a nova foto da frente', variant: 'destructive' });
      return;
    }
    if (documento.verso_path && !selecao.verso) {
      toast({ title: 'Envie também a nova foto do verso', variant: 'destructive' });
      return;
    }

    try {
      setAReenviar(documento.id);
      const atualizado = await reenviarDocumentoVendedor(
        documento,
        selecao.frente,
        selecao.verso,
        {
          numero: documento.numero_documento ?? '',
          validade: documento.validade ?? '',
          ...documento.dados_adicionais,
        },
      );
      setDocumentos(anterior => anterior.map(item => item.id === atualizado.id ? atualizado : item));
      setFicheiros(anterior => ({ ...anterior, [documento.id]: { frente: null, verso: null } }));
      toast({ title: 'Documento reenviado', description: 'Aguardando nova análise da equipa ANGROLINK.' });
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'Não foi possível reenviar o documento.';
      toast({ title: 'Reenvio não concluído', description: mensagem, variant: 'destructive' });
    } finally {
      setAReenviar(null);
    }
  };

  const alterarValorAusente = (documentoId: string, campoId: string, valor: string) => {
    setValoresAusentes(anterior => ({
      ...anterior,
      [documentoId]: { ...anterior[documentoId], [campoId]: valor },
    }));
  };

  const escolherFicheiroAusente = (documentoId: string, lado: 'frente' | 'verso') => (evento: ChangeEvent<HTMLInputElement>) => {
    const ficheiro = evento.target.files?.[0] ?? null;
    setFicheirosAusentes(anterior => ({
      ...anterior,
      [documentoId]: { frente: anterior[documentoId]?.frente ?? null, verso: anterior[documentoId]?.verso ?? null, [lado]: ficheiro },
    }));
  };

  const submeterAusentes = async () => {
    if (!utilizador.vendedor_id) return;
    const lote = documentosObrigatoriosAusentes.flatMap((tipoDocumento): DocumentoVendedorParaSubmissao[] => {
      const selecao = ficheirosAusentes[tipoDocumento];
      const valores = valoresAusentes[tipoDocumento] ?? {};
      const catalogo = CATALOGO_DOCUMENTOS[tipoDocumento];
      const camposCompletos = catalogo.campos.every(campo => valores[campo.id]?.trim());
      if (!selecao?.frente && !selecao?.verso && !Object.values(valores).some(valor => valor.trim())) return [];
      if (!selecao?.frente || !selecao.verso || !camposCompletos) return [];
      return [{ tipo_documento: tipoDocumento as DocumentoVendedorParaSubmissao['tipo_documento'], valores, frente: selecao.frente, verso: selecao.verso }];
    });

    if (lote.length === 0) {
      toast({ title: 'Complete pelo menos um documento', description: 'Escolha frente, verso e preencha os campos obrigatórios.', variant: 'destructive' });
      return;
    }

    try {
      setASubmeter(true);
      await submeterDocumentosVendedor(utilizador.vendedor_id, lote);
      setValoresAusentes({});
      setFicheirosAusentes({});
      await carregar();
      toast({ title: 'Documentos enviados', description: 'Os documentos estão pendentes de análise.' });
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'Não foi possível enviar os documentos.';
      toast({ title: 'Envio não concluído', description: mensagem, variant: 'destructive' });
    } finally {
      setASubmeter(false);
    }
  };

  if (!utilizador?.vendedor_id) return null;

  const rejeitado = utilizador.status_aprovacao === 'rejeitado';
  const suspenso = utilizador.status_aprovacao === 'suspenso';

  return (
    <div className="space-y-6">
      <header className="painel-dashboard-cabecalho">
        <div className="relative z-10 flex items-start gap-3">
          <FileCheck2 className="mt-1 size-7 text-primary-foreground" />
          <div>
            <h1 className="font-titulo text-2xl font-bold text-primary-foreground">Documentos e correção do cadastro</h1>
            <p className="mt-1 font-corpo text-sm text-primary-foreground/85">Consulte os documentos enviados e corrija apenas os que a equipa rejeitou.</p>
          </div>
        </div>
      </header>

      {rejeitado && (
        <section className="rounded-2xl border-2 border-destructive/35 bg-destructive/5 p-5">
          <div className="flex gap-3"><AlertTriangle className="mt-0.5 size-6 shrink-0 text-destructive" /><div>
            <h2 className="font-titulo text-lg font-bold text-foreground">Cadastro rejeitado</h2>
            <p className="mt-1 font-corpo text-sm text-muted-foreground">
              {documentosRejeitados.length > 0
                ? 'Revê os documentos assinalados abaixo e reenvia apenas os que precisam de correção.'
                : 'Não existem documentos assinalados para correção. Consulte o motivo geral do cadastro ou contacte o suporte ANGROLINK.'}
            </p>
            {utilizador.motivo_rejeicao && <p className="mt-3 rounded-lg bg-background/80 p-3 font-corpo text-sm text-foreground"><strong>Motivo indicado:</strong> {utilizador.motivo_rejeicao}</p>}
          </div></div>
        </section>
      )}

      {suspenso && (
        <section className="rounded-2xl border-2 border-orange-300 bg-orange-50 p-5"><div className="flex gap-3"><ShieldAlert className="mt-0.5 size-6 text-orange-700" /><div><h2 className="font-titulo text-lg font-bold">Conta suspensa</h2><p className="mt-1 font-corpo text-sm text-muted-foreground">As funções comerciais estão indisponíveis. Consulte o apoio ANGROLINK para resolver a situação.</p>{utilizador.motivo_rejeicao && <p className="mt-3 font-corpo text-sm"><strong>Motivo:</strong> {utilizador.motivo_rejeicao}</p>}</div></div></section>
      )}

      {!rejeitado && !suspenso && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5"><div className="flex gap-3"><Clock3 className="mt-0.5 size-6 text-amber-700" /><p className="font-corpo text-sm text-muted-foreground">A sua candidatura está em análise. Pode consultar os documentos enviados, mas as funções comerciais só ficam disponíveis após aprovação.</p></div></section>
      )}

      <section className="painel-dashboard-form">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-titulo text-lg font-bold">Documentos enviados</h2><p className="mt-1 font-corpo text-sm text-muted-foreground">Os ficheiros são privados e só podem ser abertos por si e por administradores autorizados.</p></div>{documentosRejeitados.length > 0 && <span className="rounded-full bg-primary/10 px-3 py-1 font-corpo text-xs font-semibold text-primary">{documentosRejeitados.length} a corrigir</span>}</div>
        {documentosObrigatoriosAusentes.length > 0 && <section className="mt-5 rounded-xl border-2 border-primary/25 bg-primary/5 p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-titulo text-lg font-bold">Concluir documentos obrigatórios</h2><p className="mt-1 font-corpo text-sm text-muted-foreground">Envie apenas os documentos obrigatórios que ainda não foram associados à candidatura.</p></div><Send className="size-5 shrink-0 text-primary" /></div><div className="mt-4 space-y-4">{documentosObrigatoriosAusentes.map(tipoDocumento => { const catalogo = CATALOGO_DOCUMENTOS[tipoDocumento]; const selecao = ficheirosAusentes[tipoDocumento]; return <div key={tipoDocumento} className="rounded-lg border border-border bg-card p-4"><h3 className="font-titulo text-base font-bold">{catalogo.nome}</h3><p className="mt-1 font-corpo text-xs text-muted-foreground">{catalogo.descricao}</p><div className={catalogo.campos.length > 1 ? 'mt-3 grid gap-3 sm:grid-cols-3' : 'mt-3'}>{catalogo.campos.map(campo => <label key={campo.id} className="block font-corpo text-xs font-medium">{campo.rotulo} *<input type={campo.tipo === 'data' ? 'date' : 'text'} value={valoresAusentes[tipoDocumento]?.[campo.id] ?? ''} onChange={evento => alterarValorAusente(tipoDocumento, campo.id, evento.target.value)} placeholder={campo.placeholder} maxLength={50} className="mt-1 block h-10 w-full rounded-md border-2 border-border bg-background px-3 text-sm" /></label>)}</div><div className="mt-3 grid gap-3 sm:grid-cols-2">{(['frente', 'verso'] as const).map(lado => <label key={lado} className="block font-corpo text-xs font-medium">Foto da {lado} *<input type="file" accept="image/jpeg,image/png,image/webp" onChange={escolherFicheiroAusente(tipoDocumento, lado)} className="mt-1 block w-full text-xs" />{selecao?.[lado] && <span className="mt-1 block truncate text-primary">{selecao[lado]!.name}</span>}</label>)}</div></div>; })}</div><button type="button" disabled={aSubmeter} onClick={() => void submeterAusentes()} className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2 font-corpo text-sm font-semibold text-primary-foreground disabled:opacity-60">{aSubmeter ? <><Loader2 className="mr-2 size-4 animate-spin" />A enviar...</> : <><Send className="mr-2 size-4" />Enviar documentos</>}</button></section>}
        {rejeitado && !aCarregar && documentosRejeitados.length === 0 && <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 font-corpo text-sm text-amber-900">O cadastro foi rejeitado por um motivo geral; nenhum documento foi marcado para reenvio.</p>}
        {aCarregar ? <p className="mt-5 font-corpo text-sm text-muted-foreground">A carregar documentos...</p> : documentos.length === 0 && documentosObrigatoriosAusentes.length === 0 ? <p className="mt-5 font-corpo text-sm text-muted-foreground">Ainda não existem documentos privados associados a esta candidatura.</p> : documentos.length > 0 ? <div className="mt-5 grid gap-4 lg:grid-cols-2">{documentos.map(documento => {
          const catalogo = CATALOGO_DOCUMENTOS[documento.tipo_documento];
          const emReenvio = aReenviar === documento.id;
          return <article key={documento.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-titulo text-base font-bold">{catalogo?.nome ?? documento.tipo_documento.replace(/_/g, ' ')}</h3>{documento.numero_documento && <p className="mt-1 font-corpo text-xs text-muted-foreground">N.º: {documento.numero_documento}</p>}</div><span className={`rounded-full border px-2.5 py-1 font-corpo text-xs font-semibold ${estilosEstado[documento.estado]}`}>{rotulosEstado[documento.estado]}</span></div>
            {documento.motivo_rejeicao && <p className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 font-corpo text-sm text-destructive"><strong>Motivo da rejeição:</strong> {documento.motivo_rejeicao}</p>}
            <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => abrirDocumento(documento.frente_path)} className="font-corpo text-sm font-semibold text-primary underline">Abrir frente</button>{documento.verso_path && <button type="button" onClick={() => abrirDocumento(documento.verso_path!)} className="font-corpo text-sm font-semibold text-primary underline">Abrir verso</button>}</div>
            {documentoVendedorPodeSerReenviado(documento.estado) && <div className="mt-4 border-t border-border pt-4"><p className="font-corpo text-sm font-semibold">Reenviar documento</p><p className="mt-1 font-corpo text-xs text-muted-foreground">Envie fotos nítidas. A versão anterior permanece guardada para auditoria.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="font-corpo text-xs font-medium">Nova foto da frente<input type="file" accept="image/jpeg,image/png,image/webp" onChange={escolherFicheiro(documento.id, 'frente')} className="mt-1 block w-full text-xs" /></label>{documento.verso_path && <label className="font-corpo text-xs font-medium">Nova foto do verso<input type="file" accept="image/jpeg,image/png,image/webp" onChange={escolherFicheiro(documento.id, 'verso')} className="mt-1 block w-full text-xs" /></label>}</div><button type="button" disabled={emReenvio} onClick={() => reenviar(documento)} className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2 font-corpo text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">{emReenvio ? <><Loader2 className="mr-2 size-4 animate-spin" />A reenviar...</> : <><RotateCcw className="mr-2 size-4" />Reenviar documento</>}</button></div>}
            {documento.estado === 'aprovado' && <p className="mt-4 flex items-center gap-2 font-corpo text-xs text-primary"><CheckCircle2 className="size-4" />Documento validado e protegido contra alterações.</p>}
          </article>;
        })}</div> : null}
      </section>
    </div>
  );
}
