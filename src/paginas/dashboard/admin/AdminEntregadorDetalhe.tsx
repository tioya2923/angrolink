import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronUp, FileText, MapPin, Truck } from "lucide-react";
import {
  obterEntregadorAdmin,
  listarVeiculosEntregadorAdmin,
  listarDocumentosEntregadorAdmin,
  listarAreasCoberturaEntregadorAdmin,
  listarHistoricoDocumentalEntregadorAdmin,
  type Area,
  type DetalheEntregador,
  type Documento,
  type DocumentoHistorico,
  type Pagina,
  type Veiculo,
} from "@/services/adminEntregador360";
import {
  BlocoAdmin,
  CampoAdmin,
  EtiquetaEstado,
  formatarData,
  rotuloEstado,
} from "./admin360Util";
import {
  obterDocumentoEntregadorAdmin,
  obterFotoEntregadorAdmin,
  obterFotoVeiculoEntregadorAdmin,
} from "@/services/adminMediaPrivada";
import { calcularEstadoPaginacao } from "@/lib/paginacao";
import { abrirDocumentoPrivado } from "@/lib/abrirDocumentoPrivado";
type Aba =
  | "visao"
  | "veiculos"
  | "documentos"
  | "areas"
  | "entregas"
  | "financeiro"
  | "historico";
const abas: [Aba, string][] = [
  ["visao", "Visão geral"],
  ["veiculos", "Veículos"],
  ["documentos", "Documentos"],
  ["areas", "Áreas"],
  ["entregas", "Entregas"],
  ["financeiro", "Financeiro"],
  ["historico", "Histórico"],
];
const docs: Record<string, string> = {
  bi: "Bilhete de Identidade",
  carta_conducao: "Carta de condução",
  livrete_veiculo: "Livrete do veículo",
  seguro_automovel: "Seguro automóvel",
  inspecao_tecnica: "Inspeção técnica",
  licenca_transporte_mercadorias: "Licença de transporte de mercadorias",
  nif: "NIF",
  certidao_comercial: "Certidão comercial",
  alvara_comercial: "Alvará comercial",
};
const veiculos: Record<string, string> = {
  mota: "Mota",
  carro: "Carro",
  carrinha: "Carrinha",
  camiao: "Camião",
};
export default function AdminEntregadorDetalhe() {
  const { id } = useParams(),
    nav = useNavigate();
  const [d, setD] = useState<DetalheEntregador | null>(null),
    [aba, setAba] = useState<Aba>("visao"),
    [load, setLoad] = useState(true),
    [erro, setErro] = useState(false),
    [v, setV] = useState<Pagina<Veiculo> | null>(null),
    [doc, setDoc] = useState<Pagina<Documento> | null>(null),
    [areas, setAreas] = useState<Pagina<Area> | null>(null),
    [historico, setHistorico] = useState<Pagina<DocumentoHistorico> | null>(null),
    [tabLoad, setTabLoad] = useState(false),
    [tabErro, setTabErro] = useState<string | null>(null);
  const carregar = useCallback(async () => {
    if (!id) {
      setErro(true);
      return;
    }
    try {
      setD(await obterEntregadorAdmin(id));
    } catch {
      setErro(true);
    } finally {
      setLoad(false);
    }
  }, [id]);
  useEffect(() => {
    void carregar();
  }, [carregar]);
  const carregarTab = async (a: Aba, o = 0) => {
    if (!id || !["veiculos", "documentos", "areas", "historico"].includes(a)) return;
    setTabLoad(true);
    setTabErro(null);
    try {
      if (a === "veiculos")
        setV(await listarVeiculosEntregadorAdmin(id, 20, o));
      if (a === "documentos")
        setDoc(await listarDocumentosEntregadorAdmin(id, 20, o));
      if (a === "areas")
        setAreas(await listarAreasCoberturaEntregadorAdmin(id, 20, o));
      if (a === "historico")
        setHistorico(await listarHistoricoDocumentalEntregadorAdmin(id, 20, o));
    } catch {
      setTabErro("Não foi possível carregar esta secção. Tente novamente.");
    } finally {
      setTabLoad(false);
    }
  };
  const trocar = (a: Aba) => {
    setAba(a);
    void carregarTab(a);
  };
  if (load)
    return (
      <p className="painel-dashboard-form text-sm text-muted-foreground">
        A carregar entregador…
      </p>
    );
  if (erro || !d)
    return (
      <div className="painel-dashboard-form text-destructive">
        Entregador não encontrado ou indisponível.
      </div>
    );
  const p = d.parceiro;
  return (
    <div className="space-y-5">
      <button
        onClick={() => nav("/dashboard/entregadores")}
        className="inline-flex gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" />
        Voltar aos entregadores
      </button>
      <header className="painel-dashboard-cabecalho">
        <div className="relative z-10 flex gap-4">
          <AvatarEntregador id={p.parceiroId} nome={p.nome} disponivel={p.fotoDisponivel} />
          <div>
            <h1 className="font-titulo text-2xl font-bold text-primary-foreground">
              {p.nome}
            </h1>
            <p className="mt-1 text-sm text-primary-foreground/85">
              {p.email || "Sem e-mail"} · {p.telefone}
            </p>
            <p className="mt-1 text-sm text-primary-foreground/80">
              {[p.bairro, p.municipio, p.provincia].filter(Boolean).join(", ")}{" "}
              · Zona base: {p.zonaBase || "—"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <EtiquetaEstado estado={p.estado} />
              <EtiquetaEstado
                estado={p.disponibilidade ? "disponível" : "indisponível"}
              />
            </div>
          </div>
        </div>
      </header>
      {p.motivoRejeicao && (
        <Aviso texto={`Motivo da rejeição: ${p.motivoRejeicao}`} />
      )}{" "}
      {p.motivoSuspensao && (
        <Aviso texto={`Motivo da suspensão: ${p.motivoSuspensao}`} />
      )}
      <nav className="flex gap-2 overflow-x-auto border-b pb-2">
        {abas.map(([a, t]) => (
          <button
            key={a}
            onClick={() => trocar(a)}
            className={`shrink-0 rounded px-3 py-2 text-sm font-semibold ${aba === a ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </nav>
      {aba === "visao" && <Visao d={d} />}{" "}
      {aba === "veiculos" && (
        <Colecao
          pagina={v}
          loading={tabLoad}
          erro={tabErro}
          vazio="Sem veículos."
          mudar={(o) => void carregarTab("veiculos", o)}
        >
          {(itens) => (
            <div className="grid gap-3 sm:grid-cols-2">
              {itens.map((x) => (
                <div key={x.veiculoId} className="contents">
                <article
                  className="rounded-lg border p-3 text-sm"
                >
                  <strong>
                    {veiculos[x.tipo] || x.tipo} · {x.marca} {x.modelo}
                  </strong>
                  <p>
                    {x.matricula} · {x.cor} · {x.ano || "Ano não indicado"}
                  </p>
                  <p className="mt-2 font-medium">Capacidade logística</p>
                  <p>
                    {x.capacidadeKg} kg · {x.volumeM3 ?? "—"} m³ · Caixa:{" "}
                    {x.caixa ? "Sim" : "Não"} · Paletes:{" "}
                    {x.paletes ? "Sim" : "Não"} · Refrigeração:{" "}
                    {x.refrigeracao ? "Sim" : "Não"}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <EtiquetaEstado estado={x.estado} />
                    {x.fotoDisponivel && (
                      <span className="text-xs text-muted-foreground">
                        Foto disponível
                      </span>
                    )}
                  </div>
                  {x.motivo && (
                    <p className="mt-2 text-destructive">{x.motivo}</p>
                  )}
                </article>
                <FotoVeiculoEntregador
                  id={x.veiculoId}
                  disponivel={x.fotoDisponivel}
                  descricao={`${veiculos[x.tipo] || x.tipo} ${x.marca} ${x.modelo}`}
                />
                </div>
              ))}
            </div>
          )}
        </Colecao>
      )}
      {aba === "documentos" && (
        <Colecao
          pagina={doc}
          loading={tabLoad}
          erro={tabErro}
          vazio="Sem documentos."
          mudar={(o) => void carregarTab("documentos", o)}
        >
          {(itens) => (
            <div className="space-y-2">
              {itens.map((x) => (
                <article
                  key={x.documentoId}
                  className="rounded-lg border p-3 text-sm"
                >
                  <strong>{docs[x.tipo] || x.tipo}</strong>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <EtiquetaEstado estado={x.estado} />
                    <span>N.º {x.numero || "—"}</span>
                    <span>Validade: {formatarData(x.validade)}</span>
                    <span>Veículo: {x.matricula || "Não associado"}</span>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    Frente: {x.frenteDisponivel ? "Disponível" : "Não enviada"}{" "}
                    · Verso: {x.versoDisponivel ? "Disponível" : "Não enviado"}{" "}
                    · Enviado: {formatarData(x.criadoEm)} · Analisado:{" "}
                    {formatarData(x.analisadoEm)}
                  </p>
                  {x.motivo && (
                    <p className="mt-1 text-destructive">Motivo: {x.motivo}</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </Colecao>
      )}
      {aba === "areas" && (
        <Colecao
          pagina={areas}
          loading={tabLoad}
          erro={tabErro}
          vazio="Sem áreas de cobertura."
          mudar={(o) => void carregarTab("areas", o)}
        >
          {(itens) => (
            <div className="grid gap-3 sm:grid-cols-2">
              {itens.map((x) => (
                <article
                  key={x.areaId}
                  className="rounded-lg border p-3 text-sm"
                >
                  <MapPin className="inline size-4 text-primary" />{" "}
                  {[x.bairro, x.municipio, x.provincia]
                    .filter(Boolean)
                    .join(", ")}
                  <p className="mt-1 text-muted-foreground">
                    {x.ativa ? "Área ativa" : "Área inativa"} ·{" "}
                    {formatarData(x.criadoEm)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </Colecao>
      )}
      {aba === "entregas" && (
        <Indisponivel texto="Gestão de entregas será disponibilizada quando o motor logístico estiver ativo." />
      )}
      {aba === "financeiro" && (
        <Indisponivel texto="Financeiro logístico ainda não disponível." />
      )}
      {aba === "historico" && (
        <Colecao
          pagina={historico}
          loading={tabLoad}
          erro={tabErro}
          vazio="Ainda não há histórico documental para este entregador."
          mudar={(o) => void carregarTab("historico", o)}
        >
          {(itens) => <HistoricoDocumental itens={itens} />}
        </Colecao>
      )}
    </div>
  );
}
function AvatarEntregador({
  id,
  nome,
  disponivel,
}: {
  id: string;
  nome: string;
  disponivel: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null),
    [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let ativo = true;
    setUrl(null);
    setFalhou(false);
    if (disponivel)
      void obterFotoEntregadorAdmin(id)
        .then((foto) => {
          if (ativo) setUrl(foto);
        })
        .catch(() => {
          if (ativo) setFalhou(true);
        });
    return () => {
      ativo = false;
    };
  }, [id, disponivel]);
  if (url && !falhou)
    return (
      <img
        src={url}
        alt={`Foto de ${nome}`}
        onError={() => setFalhou(true)}
        className="size-16 rounded-full object-cover ring-2 ring-white/40"
      />
    );
  return (
    <span className="flex size-16 items-center justify-center rounded-full bg-white/15 text-2xl font-bold text-primary-foreground">
      {nome[0]}
    </span>
  );
}
function FotoVeiculoEntregador({
  id,
  disponivel,
  descricao,
}: {
  id: string;
  disponivel: boolean;
  descricao: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let ativo = true;
    setUrl(null);
    setFalhou(false);

    if (disponivel)
      void obterFotoVeiculoEntregadorAdmin(id)
        .then((foto) => {
          if (ativo) setUrl(foto);
        })
        .catch(() => {
          if (ativo) setFalhou(true);
        });

    return () => {
      ativo = false;
    };
  }, [id, disponivel]);

  if (!disponivel) return null;
  if (falhou)
    return (
      <span className="flex min-h-52 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center text-xs text-destructive">
        Não foi possível carregar a fotografia.
      </span>
    );
  if (!url)
    return (
      <span className="min-h-52 animate-pulse rounded-lg bg-muted" aria-label="A carregar fotografia do veículo" />
    );
  return (
    <img
      src={url}
      alt={`Fotografia do veículo: ${descricao}`}
      onError={() => setFalhou(true)}
      className="min-h-52 h-full w-full rounded-lg border object-cover"
    />
  );
}

function Visao({ d }: { d: DetalheEntregador }) {
  const p = d.parceiro,
    r = d.resumo;
  return (
    <>
      <BlocoAdmin titulo="Elegibilidade operacional">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${d.elegibilidadeLogistica.podeReceberEntregas ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
            {d.elegibilidadeLogistica.podeReceberEntregas ? "Apto para receber entregas" : "Não apto para receber entregas"}
          </span>
          <span className="text-xs text-muted-foreground">Validação calculada no servidor.</span>
        </div>
        {!d.elegibilidadeLogistica.podeReceberEntregas && (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {d.elegibilidadeLogistica.motivos.map((motivo) => <li key={motivo}>{rotuloMotivoLogistico(motivo)}</li>)}
          </ul>
        )}
        {d.elegibilidadeLogistica.veiculos.length > 0 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {d.elegibilidadeLogistica.veiculos.map((veiculo) => (
              <div key={veiculo.veiculoId} className="rounded-lg border bg-background p-3 text-sm">
                <p className="font-semibold">Veículo {veiculo.operacional ? "operacional" : "não operacional"}</p>
                {!veiculo.operacional && <p className="mt-1 text-xs text-muted-foreground">{veiculo.motivos.map(rotuloMotivoLogistico).join(" · ")}</p>}
              </div>
            ))}
          </div>
        )}
      </BlocoAdmin>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Total de veículos", r.totalVeiculos],
          ["Veículos aprovados", r.veiculosAprovados],
          ["Total de documentos", r.totalDocumentos],
          ["Documentos pendentes", r.documentosPendentes],
          ["Documentos expirados", r.documentosExpirados],
          ["Áreas ativas", r.areasAtivas],
        ].map(([a, b]) => (
          <div key={String(a)} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{a}</p>
            <p className="text-2xl font-bold text-primary">{b}</p>
          </div>
        ))}
      </section>
      <BlocoAdmin titulo="Perfil">
        <dl className="grid gap-4 sm:grid-cols-2">
          <CampoAdmin rotulo="Criado em" valor={formatarData(p.criadoEm)} />
          <CampoAdmin
            rotulo="Atualizado em"
            valor={formatarData(p.atualizadoEm)}
          />
          <CampoAdmin rotulo="Aprovado em" valor={formatarData(p.aprovadoEm)} />
          <CampoAdmin rotulo="Estado" valor={rotuloEstado(p.estado)} />
        </dl>
      </BlocoAdmin>
      <BlocoAdmin titulo="Outros papéis">
        <div className="flex flex-wrap gap-2">
          {d.outrosPapeis.cliente && (
            <Link
              to={`/dashboard/compradores/${p.userId}`}
              className="rounded border border-primary px-3 py-2 text-sm text-primary"
            >
              Abrir Comprador 360
            </Link>
          )}
          {d.outrosPapeis.vendedor && (
            <span className="rounded border px-3 py-2 text-sm">
              Também possui perfil vendedor
            </span>
          )}
          {d.outrosPapeis.admin && (
            <span className="rounded border px-3 py-2 text-sm">
              Administrador
            </span>
          )}
          {!d.outrosPapeis.cliente &&
            !d.outrosPapeis.vendedor &&
            !d.outrosPapeis.admin && (
              <p className="text-sm text-muted-foreground">
                Sem outros papéis.
              </p>
            )}
        </div>
      </BlocoAdmin>
    </>
  );
}
function rotuloMotivoLogistico(codigo: string) {
  const [tipo, documento] = codigo.split(":");
  const nomeDocumento = documento ? docs[documento] || documento.replace(/_/g, " ") : null;
  const rotulos: Record<string, string> = {
    parceiro_inexistente: "Parceiro inexistente.",
    elegibilidade_indisponivel: "A elegibilidade logística estará disponível após a aplicação da migração correspondente.",
    parceiro_nao_aprovado: "A conta do parceiro ainda não está aprovada.",
    indisponivel: "O parceiro está indisponível.",
    sem_area_ativa: "Não existe uma área de cobertura ativa.",
    sem_veiculo: "Não existe veículo registado.",
    sem_veiculo_aprovado: "Não existe veículo aprovado.",
    veiculo_rejeitado: "O veículo registado foi rejeitado.",
    sem_veiculo_operacional: "Nenhum veículo aprovado reúne os requisitos operacionais.",
    veiculo_pendente: "O veículo está pendente de análise.",
    veiculo_expirado: "A aprovação do veículo expirou.",
    veiculo_inexistente: "O veículo já não existe.",
  };
  if (nomeDocumento && tipo === "documento_em_falta") return `Falta o documento: ${nomeDocumento}.`;
  if (nomeDocumento && tipo === "documento_pendente") return `Documento pendente de análise: ${nomeDocumento}.`;
  if (nomeDocumento && tipo === "documento_rejeitado") return `Documento rejeitado: ${nomeDocumento}.`;
  if (nomeDocumento && tipo === "documento_expirado") return `Documento expirado: ${nomeDocumento}.`;
  if (nomeDocumento && tipo === "validade_em_falta") return `Validade obrigatória em falta: ${nomeDocumento}.`;
  return rotulos[codigo] || codigo.replace(/_/g, " ");
}
function HistoricoDocumental({ itens }: { itens: DocumentoHistorico[] }) {
  return (
    <div className="space-y-4">
      {itens.map((documento) => (
        <DocumentoHistoricoCard key={documento.documentoId} documento={documento} />
      ))}
    </div>
  );
}
function DocumentoHistoricoCard({ documento }: { documento: DocumentoHistorico }) {
  const [aberto, setAberto] = useState(false);
  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-titulo text-base font-bold">{docs[documento.tipo] || documento.tipo}</h3>
            <EtiquetaEstado estado={documento.estadoAtual} />
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">Versão atual {documento.versaoAtual ?? "—"}</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {documento.matricula ? `Veículo: ${documento.matricula}` : "Documento sem veículo associado"}
            {" · "}Validade: {formatarData(documento.validadeAtual)}
            {" · "}Atualizado: {formatarData(documento.atualizadoEm)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAberto((valor) => !valor)}
          className="inline-flex items-center justify-center gap-1 rounded-md border border-primary px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
          aria-expanded={aberto}
        >
          {aberto ? "Ocultar versões" : `Ver versões (${documento.totalVersoes})`}
          {aberto ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      </div>
      {aberto && (
        <div className="mt-4 space-y-5 border-t pt-4">
          <section>
            <h4 className="font-semibold">Versões</h4>
            <div className="mt-3 space-y-3">
              {documento.versoes.map((versao) => {
                const atual = versao.versaoId === documento.versaoAtualId;
                return (
                  <article key={versao.versaoId} className={`rounded-lg border p-3 text-sm ${atual ? "border-primary/40 bg-primary/5" : "bg-background"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>Versão {versao.numeroVersao}</strong>
                      {atual && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">Versão atual</span>}
                      <EtiquetaEstado estado={versao.estado} />
                    </div>
                    <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <CampoAdmin rotulo="N.º documental" valor={versao.numero || "—"} />
                      <CampoAdmin rotulo="Validade" valor={formatarData(versao.validade)} />
                      <CampoAdmin rotulo="Criado em" valor={formatarData(versao.criadoEm)} />
                      <CampoAdmin rotulo="Analisado por" valor={versao.analisadoPor || "Ainda não analisado"} />
                      <CampoAdmin rotulo="Analisado em" valor={formatarData(versao.analisadoEm)} />
                      <CampoAdmin rotulo="Substituído em" valor={formatarData(versao.substituidoEm)} />
                    </dl>
                    {versao.motivo && <p className="mt-3 rounded bg-destructive/5 p-2 text-destructive">Motivo da rejeição: {versao.motivo}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {versao.frenteDisponivel && <AbrirDocumento versaoId={versao.versaoId} recurso="documento_entregador_frente" rotulo="Ver frente" />}
                      {versao.versoDisponivel && <AbrirDocumento versaoId={versao.versaoId} recurso="documento_entregador_verso" rotulo="Ver verso" />}
                      {!versao.frenteDisponivel && !versao.versoDisponivel && <span className="text-xs text-muted-foreground">Imagens indisponíveis.</span>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
          <section>
            <h4 className="font-semibold">Linha do tempo</h4>
            {documento.eventos.length ? (
              <ol className="mt-3 space-y-3 border-l-2 border-primary/20 pl-4">
                {documento.eventos.map((evento) => (
                  <li key={evento.eventoId} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary" />
                    <p className="font-medium">{rotuloEstado(evento.evento)}</p>
                    <p className="text-xs text-muted-foreground">{formatarData(evento.criadoEm)} · {rotuloEstado(evento.atorTipo)}</p>
                    {evento.motivo && <p className="mt-1 text-destructive">Motivo: {evento.motivo}</p>}
                  </li>
                ))}
              </ol>
            ) : <p className="mt-2 text-sm text-muted-foreground">Sem eventos documentais registados.</p>}
          </section>
        </div>
      )}
    </article>
  );
}
function AbrirDocumento({ versaoId, recurso, rotulo }: { versaoId: string; recurso: "documento_entregador_frente" | "documento_entregador_verso"; rotulo: string }) {
  const [aAbrir, setAAbrir] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const abrir = async () => {
    setAAbrir(true);
    setErro(null);
    const resultado = await abrirDocumentoPrivado(() => obterDocumentoEntregadorAdmin(versaoId, recurso));
    if (resultado === "documento_indisponivel") setErro("Não foi possível abrir o documento. Tente novamente.");
    setAAbrir(false);
  };
  return <div className="space-y-1"><button type="button" onClick={() => void abrir()} disabled={aAbrir} className="rounded border border-primary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-60">{aAbrir ? "A abrir…" : rotulo}</button>{erro && <p className="text-xs text-destructive">{erro}</p>}</div>;
}
function Colecao<T>({
  pagina,
  loading,
  erro,
  vazio,
  mudar,
  children,
}: {
  pagina: Pagina<T> | null;
  loading: boolean;
  erro: string | null;
  vazio: string;
  mudar: (o: number) => void;
  children: (x: T[]) => ReactNode;
}) {
  if (loading) return <p className="painel-dashboard-form">A carregar…</p>;
  if (erro)
    return <p className="painel-dashboard-form text-destructive">{erro}</p>;
  if (!pagina) return null;
  const p = pagina.paginacao;
  const estado = calcularEstadoPaginacao(p.offset, p.limite, p.totalResultados, pagina.itens.length);
  return (
    <BlocoAdmin titulo="">
      {pagina.itens.length ? (
        children(pagina.itens)
      ) : (
        <p className="text-muted-foreground">{vazio}</p>
      )}
      <div className="mt-4 flex justify-between text-sm">
        <span>
          {estado.inicio}-{estado.fim} de {p.totalResultados}
        </span>
        <span className="flex gap-2">
          <button
            type="button"
            disabled={!estado.podeAnterior}
            onClick={() => estado.podeAnterior && mudar(Math.max(0, p.offset - p.limite))}
            className="rounded px-2 py-1 font-semibold text-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={!estado.podeProxima}
            onClick={() => estado.podeProxima && mudar(p.offset + p.limite)}
            className="rounded px-2 py-1 font-semibold text-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            Próxima
          </button>
        </span>
      </div>
    </BlocoAdmin>
  );
}
function Aviso({ texto }: { texto: string }) {
  return (
    <p className="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      {texto}
    </p>
  );
}
function Indisponivel({ texto }: { texto: string }) {
  return (
    <BlocoAdmin titulo="Ainda não disponível">
      <p className="text-sm text-muted-foreground">{texto}</p>
    </BlocoAdmin>
  );
}
