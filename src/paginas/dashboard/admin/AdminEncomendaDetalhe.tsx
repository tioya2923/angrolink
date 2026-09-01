import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ClipboardList, LoaderCircle, MapPin, Truck } from "lucide-react";
import {
  atribuirEntregadorEncomenda,
  criarChaveIdempotenciaAdmin,
  libertarAtribuicaoEntregaAdmin,
  registarIncidenteOperacionalEntregaAdmin,
  resolverIncidenteOperacionalEntregaAdmin,
  obterIncidenteOperacionalEntregaAdmin,
  obterAtribuicaoEntregaEncomendaAdmin,
  listarCompatibilidadeLogisticaEncomendaAdmin,
  mensagemErroLogisticaAdmin,
  obterEncomendaAdmin,
  subscreverAtualizacoesEncomendaAdmin,
  type AtribuicaoEntregaAdmin,
  type CompatibilidadeLogisticaAdmin,
  type EncomendaAdminDetalhe,
  type IncidenteOperacionalEntregaAdmin,
} from "@/services/admin360";
import {
  BlocoAdmin,
  CampoAdmin,
  EtiquetaEstado,
  formatarData,
  formatarKz,
} from "./admin360Util";

const MOTIVOS_COMPATIBILIDADE: Record<string, string> = {
  entregador_nao_elegivel: "Entregador sem elegibilidade operacional",
  veiculo_nao_operacional: "Veículo não está operacional",
  peso_carga_desconhecido: "Peso da carga ainda não está definido",
  capacidade_peso_veiculo_desconhecida: "Capacidade de peso do veículo não definida",
  capacidade_peso_insuficiente: "Capacidade de peso insuficiente",
  volume_carga_desconhecido: "Volume da carga ainda não está definido",
  capacidade_volume_veiculo_desconhecida: "Capacidade de volume do veículo não definida",
  capacidade_volume_insuficiente: "Capacidade de volume insuficiente",
  requisitos_especiais_desconhecidos: "Requisitos especiais da carga não definidos",
  refrigeracao_indisponivel: "A carga exige refrigeração e o veículo não possui",
  caixa_carga_indisponivel: "A carga exige caixa de carga e o veículo não possui",
  paletes_nao_suportadas: "A carga exige paletes e o veículo não suporta",
  destino_ausente: "Destino de entrega ainda não foi indicado",
  destino_territorial_invalido: "Destino territorial ainda não é validável",
  fora_area_cobertura: "Destino fora da área de cobertura",
};

function rotuloMotivoCompatibilidade(codigo: string): string {
  return MOTIVOS_COMPATIBILIDADE[codigo] ?? codigo.split("_").join(" ");
}

function valorJson(registo: Record<string, unknown>, chave: string): string | null {
  const valor = registo[chave];
  return typeof valor === "string" || typeof valor === "number" ? String(valor) : null;
}

function normalizarAtribuicaoLegada(registo: Record<string, unknown>): AtribuicaoEntregaAdmin {
  const estado = valorJson(registo, "estado");
  return estado === "atribuida" || estado === "aceite" || estado === "chegou_origem" || estado === "recolhida" || estado === "chegou_destino" || estado === "recusada" || estado === "cancelada" || estado === "concluida"
    ? { estado, parceiro_nome: valorJson(registo, "parceiro_nome"), matricula: valorJson(registo, "matricula") }
    : { estado: "nao_atribuido" };
}

function RegistoJson({ dados }: { dados: Record<string, unknown> }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {Object.entries(dados).map(([rotulo, valor]) => (
        <CampoAdmin
          key={rotulo}
          rotulo={rotulo.split("_").join(" ")}
          valor={typeof valor === "boolean" ? (valor ? "Sim" : "Não") : typeof valor === "string" || typeof valor === "number" ? String(valor) : null}
        />
      ))}
    </dl>
  );
}

function ProgressoEntregaAdmin({ atribuicao }: { atribuicao: AtribuicaoEntregaAdmin }) {
  const ordem = ["atribuida", "aceite", "chegou_origem", "recolhida"] as const;
  const marcoAtual = ordem.indexOf(atribuicao.estado as (typeof ordem)[number]);
  const concluida = atribuicao.estado === "concluida";
  const marcos = [atribuicao.atribuido_em, atribuicao.aceite_em, atribuicao.chegou_origem_em, atribuicao.recolhida_em];
  return (
    <ol aria-label="Progresso da entrega" className="grid gap-2 sm:grid-cols-4">
      {[
        ["Atribuição criada", atribuicao.atribuido_em],
        ["Tarefa aceite", atribuicao.aceite_em],
        ["Chegada à origem", atribuicao.chegou_origem_em],
        ["Recolha confirmada", atribuicao.recolhida_em],
      ].map(([rotulo, data], indice) => {
        const concluido = concluida || Boolean(marcos[indice]) || (atribuicao.estado === "recolhida" && indice <= 3);
        const atual = !concluida && !concluido && indice === marcoAtual;
        return <li key={rotulo} aria-current={atual ? "step" : undefined} aria-label={`${rotulo}: ${concluido ? "concluído" : atual ? "atual" : "pendente"}`} className={`rounded-lg border p-3 text-sm ${concluido ? "border-green-200 bg-green-50" : atual ? "border-blue-200 bg-blue-50" : "border-muted bg-muted/20"}`}><p className="font-semibold">{rotulo}</p><p className="mt-1 text-xs text-muted-foreground">{concluido ? (typeof data === "string" ? formatarData(data) : "Concluído") : atual ? "Em curso" : "Pendente"}</p></li>;
      })}
    </ol>
  );
}

export default function AdminEncomendaDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const [detalhe, setDetalhe] = useState<EncomendaAdminDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [compatibilidade, setCompatibilidade] = useState<CompatibilidadeLogisticaAdmin[] | null>(null);
  const [carregandoCompatibilidade, setCarregandoCompatibilidade] = useState(false);
  const [erroCompatibilidade, setErroCompatibilidade] = useState(false);
  const [atribuicao, setAtribuicao] = useState<AtribuicaoEntregaAdmin | null>(null);
  const [atribuindoVeiculoId, setAtribuindoVeiculoId] = useState<string | null>(null);
  const [erroAtribuicao, setErroAtribuicao] = useState<string | null>(null);
  const [erroAtualizacao, setErroAtualizacao] = useState<string | null>(null);
  const [incidente, setIncidente] = useState<IncidenteOperacionalEntregaAdmin | null>(null);
  const [intervencao, setIntervencao] = useState<"libertar" | "incidente" | "resolver" | null>(null);
  const [motivoIntervencao, setMotivoIntervencao] = useState("");
  const [tipoIncidente, setTipoIncidente] = useState("outro");
  const [processandoIntervencao, setProcessandoIntervencao] = useState(false);
  const [erroIntervencao, setErroIntervencao] = useState<string | null>(null);
  const chaveIntervencao = useRef<{ assinatura: string; chave: string } | null>(null);
  const idAtual = useRef(id);
  const detalheAtual = useRef<EncomendaAdminDetalhe | null>(null);
  const montado = useRef(true);
  const geracaoRota = useRef(0);
  const consultaAtiva = useRef<Promise<void> | null>(null);
  const drenagemFila = useRef<Promise<void> | null>(null);
  const refreshPendente = useRef(false);
  const geracaoCompatibilidade = useRef(0);
  const processamentoAtribuicao = useRef<{ encomendaId: string; geracao: number } | null>(null);
  if (idAtual.current !== id) {
    idAtual.current = id;
    geracaoRota.current += 1;
    detalheAtual.current = null;
  }
  const carregar = useCallback(async () => {
    if (consultaAtiva.current) {
      refreshPendente.current = true;
      await drenagemFila.current;
      return;
    }
    const drenar = async () => {
      do {
        refreshPendente.current = false;
        const encomendaId = idAtual.current;
        const geracao = geracaoRota.current;
        if (!encomendaId) {
          if (montado.current && geracao === geracaoRota.current) {
            setDetalhe(null); setAtribuicao(null); setErro(true); setCarregando(false);
          }
          continue;
        }
        if (montado.current && !detalheAtual.current) setCarregando(true);
        const consulta = (async () => {
          try {
            const [encomenda, atribuicaoAtual, incidenteAtual] = await Promise.all([
              obterEncomendaAdmin(encomendaId),
              obterAtribuicaoEntregaEncomendaAdmin(encomendaId),
              obterIncidenteOperacionalEntregaAdmin(encomendaId),
            ]);
            if (!montado.current || geracao !== geracaoRota.current || idAtual.current !== encomendaId) return;
            detalheAtual.current = encomenda;
            setDetalhe(encomenda); setAtribuicao(atribuicaoAtual); setIncidente(incidenteAtual); setErro(false); setErroAtualizacao(null);
          } catch {
            if (!montado.current || geracao !== geracaoRota.current || idAtual.current !== encomendaId) return;
            if (!detalheAtual.current) setErro(true);
            else setErroAtualizacao("Não foi possível atualizar esta encomenda agora.");
          } finally {
            if (montado.current && geracao === geracaoRota.current && idAtual.current === encomendaId) setCarregando(false);
          }
        })();
        consultaAtiva.current = consulta;
        await consulta;
        consultaAtiva.current = null;
      } while (refreshPendente.current && montado.current);
    };
    const fila = drenar().finally(() => { drenagemFila.current = null; });
    drenagemFila.current = fila;
    await fila;
  }, []);
  useEffect(() => {
    montado.current = true;
    idAtual.current = id;
    detalheAtual.current = null;
    setDetalhe(null);
    setAtribuicao(null);
    setIncidente(null);
    setCarregando(true);
    setErro(false);
    setErroAtualizacao(null);
    setCompatibilidade(null);
    geracaoCompatibilidade.current += 1;
    setCarregandoCompatibilidade(false);
    setErroCompatibilidade(false);
    setErroAtribuicao(null);
    setIntervencao(null); setMotivoIntervencao(""); setErroIntervencao(null); setProcessandoIntervencao(false); chaveIntervencao.current = null;
    setAtribuindoVeiculoId(null);
    processamentoAtribuicao.current = null;
    void carregar();
    if (!id) return;
    return subscreverAtualizacoesEncomendaAdmin(id, () => {
      geracaoCompatibilidade.current += 1;
      setCompatibilidade(null);
      setCarregandoCompatibilidade(false);
      void carregar();
    });
  }, [carregar, id]);
  useEffect(() => () => {
    montado.current = false;
    idAtual.current = undefined;
  }, []);
  const carregarCompatibilidade = useCallback(async () => {
    if (!id || compatibilidade !== null) return;
    const encomendaId = id;
    const geracao = geracaoRota.current;
    const geracaoMatching = ++geracaoCompatibilidade.current;
    try {
      setCarregandoCompatibilidade(true);
      setErroCompatibilidade(false);
      const avaliacao = await listarCompatibilidadeLogisticaEncomendaAdmin(encomendaId);
      if (montado.current && geracao === geracaoRota.current && idAtual.current === encomendaId && geracaoMatching === geracaoCompatibilidade.current) setCompatibilidade(avaliacao);
    } catch {
      if (montado.current && geracao === geracaoRota.current && idAtual.current === encomendaId && geracaoMatching === geracaoCompatibilidade.current) setErroCompatibilidade(true);
    } finally {
      if (montado.current && geracao === geracaoRota.current && idAtual.current === encomendaId && geracaoMatching === geracaoCompatibilidade.current) setCarregandoCompatibilidade(false);
    }
  }, [compatibilidade, id]);
  const atribuir = useCallback(async (veiculo: CompatibilidadeLogisticaAdmin) => {
    if (!id || veiculo.estado !== "compativel") return;
    const encomendaId = id;
    const geracao = geracaoRota.current;
    if (processamentoAtribuicao.current) return;
    const confirmar = window.confirm(
      `Confirmar atribuição de ${veiculo.parceiro_nome} com o veículo ${veiculo.tipo_veiculo} (${veiculo.matricula})?\n\nEsta ação cria uma responsabilidade operacional.`,
    );
    if (!confirmar) return;
    processamentoAtribuicao.current = { encomendaId, geracao };
    try {
      setErroAtribuicao(null);
      setAtribuindoVeiculoId(veiculo.veiculo_id);
      await atribuirEntregadorEncomenda(encomendaId, veiculo.parceiro_id, veiculo.veiculo_id);
      const [atribuicaoAtual, avaliacaoAtual] = await Promise.all([
        obterAtribuicaoEntregaEncomendaAdmin(encomendaId),
        listarCompatibilidadeLogisticaEncomendaAdmin(encomendaId),
      ]);
      if (montado.current && geracao === geracaoRota.current && idAtual.current === encomendaId) {
        setAtribuicao(atribuicaoAtual);
        setCompatibilidade(avaliacaoAtual);
        await carregar();
      }
    } catch (causa) {
      if (montado.current && geracao === geracaoRota.current && idAtual.current === encomendaId) {
        setErroAtribuicao(mensagemErroLogisticaAdmin(causa, "atribuicao"));
        setCompatibilidade(null);
      }
    } finally {
      if (processamentoAtribuicao.current?.encomendaId === encomendaId && processamentoAtribuicao.current.geracao === geracao) processamentoAtribuicao.current = null;
      if (montado.current && geracao === geracaoRota.current && idAtual.current === encomendaId) setAtribuindoVeiculoId(null);
    }
  }, [carregar, id]);
  const executarIntervencao = useCallback(async () => {
    if (!intervencao || !atribuicao?.id || processandoIntervencao) return;
    const texto = motivoIntervencao.trim();
    if (texto.length < 3) { setErroIntervencao("Indique um motivo com pelo menos 3 caracteres."); return; }
    const entidade = intervencao === "resolver" ? incidente?.id : atribuicao.id;
    if (!entidade) return;
    const assinatura = `${intervencao}:${entidade}:${tipoIncidente}:${texto}`;
    if (!chaveIntervencao.current || chaveIntervencao.current.assinatura !== assinatura) chaveIntervencao.current = { assinatura, chave: criarChaveIdempotenciaAdmin() };
    const chave = chaveIntervencao.current.chave;
    setProcessandoIntervencao(true); setErroIntervencao(null);
    try {
      if (intervencao === "libertar") await libertarAtribuicaoEntregaAdmin(atribuicao.id, texto, chave);
      else if (intervencao === "incidente") await registarIncidenteOperacionalEntregaAdmin(atribuicao.id, tipoIncidente, texto, chave);
      else if (incidente) await resolverIncidenteOperacionalEntregaAdmin(incidente.id, texto, chave);
      chaveIntervencao.current = null; setIntervencao(null); setMotivoIntervencao(""); await carregar();
    } catch (causa) { setErroIntervencao(mensagemErroLogisticaAdmin(causa, intervencao === "libertar" ? "libertacao" : "incidente")); }
    finally { setProcessandoIntervencao(false); }
  }, [atribuicao?.id, carregar, incidente, intervencao, motivoIntervencao, processandoIntervencao, tipoIncidente]);
  const detalheDaRota = id && detalhe?.encomenda.id === id ? detalhe : null;
  if (carregando || (!erro && !detalheDaRota))
    return (
      <p className="painel-dashboard-form text-sm text-muted-foreground">
        A carregar encomenda…
      </p>
    );
  if (erro || !detalheDaRota)
    return (
      <div className="painel-dashboard-form space-y-3 text-sm text-destructive">
        <p>Não foi possível carregar esta encomenda.</p>
        <button type="button" onClick={() => void carregar()} className="rounded-lg border border-destructive px-3 py-2 font-semibold hover:bg-destructive/10">Tentar novamente</button>
      </div>
    );
  const { encomenda, cliente, vendedor, itens, eventos, financeiro, disputa, origem, destino, requisitos_logisticos, pagamento, levantamento, atribuicao_entrega } =
    detalheDaRota;
  const origemSegura = origem as unknown as Record<string, unknown>;
  const destinoSeguro = destino as unknown as Record<string, unknown>;
  const requisitosSeguros = requisitos_logisticos as unknown as Record<string, unknown>;
  const pagamentoSeguro = pagamento as unknown as Record<string, unknown>;
  const levantamentoSeguro = levantamento as unknown as Record<string, unknown>;
  const atribuicaoSegura = atribuicao_entrega as unknown as Record<string, unknown>;
  const atribuicaoAtual = atribuicao ?? normalizarAtribuicaoLegada(atribuicaoSegura);
  const entregaProntaParaRecolha = encomenda.modalidade === "entrega" && encomenda.estado === "pronta_para_levantamento";
  const podeAtribuir = entregaProntaParaRecolha && ["nao_atribuido", "recusada", "cancelada"].includes(atribuicaoAtual.estado);
  return (
    <div className="space-y-5">
      <button
        onClick={() => navegar("/dashboard/encomendas")}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        Voltar às encomendas
      </button>
      <header className="painel-dashboard-cabecalho flex flex-wrap items-center justify-between gap-3">
        <div className="relative z-10 flex items-center gap-3">
          <span className="rounded-xl bg-primary-foreground/15 p-3 text-primary-foreground">
            <ClipboardList className="size-5" />
          </span>
          <div>
            <h1 className="font-titulo text-2xl font-bold text-primary-foreground">
              {encomenda.codigo_publico}
            </h1>
            <p className="text-sm text-primary-foreground/80">
              Criada em {formatarData(encomenda.criado_em)}
            </p>
          </div>
        </div>
        <div className="relative z-10">
          <EtiquetaEstado estado={encomenda.estado} />
        </div>
      </header>
      {erroAtualizacao && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{erroAtualizacao}</p>}
      <div className="grid gap-4 xl:grid-cols-2">
        <BlocoAdmin titulo="Encomenda">
          <dl className="grid gap-4 sm:grid-cols-2">
            <CampoAdmin rotulo="Modalidade" valor={encomenda.modalidade} />
            <CampoAdmin
              rotulo="Estado"
              valor={<EtiquetaEstado estado={encomenda.estado} />}
            />
            <CampoAdmin
              rotulo="Atualizada em"
              valor={formatarData(encomenda.atualizado_em)}
            />
            <CampoAdmin
              rotulo="Observações"
              valor={encomenda.observacoes_cliente}
            />
          </dl>
        </BlocoAdmin>
        <BlocoAdmin titulo="Cliente">
          <dl className="grid gap-4 sm:grid-cols-2">
            <CampoAdmin rotulo="Nome" valor={cliente.nome} />
            <CampoAdmin rotulo="E-mail" valor={cliente.email} />
            <CampoAdmin rotulo="Telefone" valor={cliente.telefone} />
            <CampoAdmin rotulo="Tipo" valor={cliente.tipo_comprador} />
            <CampoAdmin rotulo="Localização" valor={[cliente.municipio, cliente.provincia].filter(Boolean).join(", ")} />
          </dl>
        </BlocoAdmin>
        <BlocoAdmin titulo="Vendedor">
          <dl className="grid gap-4 sm:grid-cols-2">
            <CampoAdmin rotulo="Negócio" valor={vendedor.nome_comercial} />
            <CampoAdmin rotulo="Telefone" valor={vendedor.telefone} />
            <CampoAdmin
              rotulo="Estado"
              valor={<EtiquetaEstado estado={vendedor.estado} />}
            />
            <CampoAdmin rotulo="Responsável" valor={vendedor.nome_responsavel} />
            <CampoAdmin rotulo="Origem comercial" valor={[vendedor.bairro, vendedor.municipio, vendedor.provincia].filter(Boolean).join(", ")} />
          </dl>
        </BlocoAdmin>
        <BlocoAdmin titulo="Financeiro">
          <dl className="grid gap-4 sm:grid-cols-2">
            <CampoAdmin
              rotulo="Pagamento"
              valor={
                <EtiquetaEstado
                  estado={
                    typeof financeiro.estado === "string"
                      ? financeiro.estado
                      : null
                  }
                />
              }
            />
            <CampoAdmin
              rotulo="Total"
              valor={formatarKz(
                typeof financeiro.total_centimos === "number"
                  ? financeiro.total_centimos
                  : 0,
              )}
            />
            <CampoAdmin
              rotulo="Comissão efetiva"
              valor={formatarKz(
                typeof financeiro.comissao_efetiva_centimos === "number"
                  ? financeiro.comissao_efetiva_centimos
                  : 0,
              )}
            />
            <CampoAdmin
              rotulo="Reembolsos"
              valor={
                Array.isArray(financeiro.reembolsos)
                  ? financeiro.reembolsos.length
                  : 0
              }
            />
          </dl>
        </BlocoAdmin>
      </div>
      <BlocoAdmin titulo="Origem e cumprimento">
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 flex items-center gap-2 font-semibold"><MapPin className="size-4 text-primary" /> Origem / levantamento</h3>
            <RegistoJson dados={origemSegura} />
          </div>
          {encomenda.modalidade === "entrega" ? (
            <div>
              <h3 className="mb-3 flex items-center gap-2 font-semibold"><Truck className="size-4 text-primary" /> Destino de entrega</h3>
              <RegistoJson dados={destinoSeguro} />
            </div>
          ) : (
            <div>
              <h3 className="mb-3 font-semibold">Levantamento</h3>
              <RegistoJson dados={levantamentoSeguro} />
            </div>
          )}
        </div>
      </BlocoAdmin>
      <BlocoAdmin titulo="Itens">
        <div className="space-y-3">
          {itens.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem itens.</p>
          ) : (
            itens.map((item, indice) => (
              <div
                key={`${item.nome}-${indice}`}
                className="flex flex-wrap justify-between gap-2 rounded-xl border bg-muted/20 p-3 text-sm"
              >
                <div>
                  <p className="font-semibold">{item.nome}</p>
                  {item.descricao && <p className="mt-1 text-xs text-muted-foreground">{item.descricao}</p>}
                  <p className="text-muted-foreground">
                    {item.quantidade} {item.unidade || ""} ·{" "}
                    {item.tipo_preco || "Preço normal"}
                  </p>
                </div>
                <p className="font-semibold text-primary">
                  {formatarKz(item.subtotal_centimos)}
                </p>
              </div>
            ))
          )}
        </div>
      </BlocoAdmin>
      <BlocoAdmin titulo="Pagamento">
        <div className="grid gap-5 lg:grid-cols-2">
          <RegistoJson dados={{
            estado: valorJson(pagamentoSeguro, "estado"),
            referencia_interna: valorJson(pagamentoSeguro, "referencia_interna"),
            criado_em: valorJson(pagamentoSeguro, "criado_em"),
            confirmado_em: valorJson(pagamentoSeguro, "confirmado_em"),
          }} />
          <div>
            <h3 className="mb-2 font-semibold">Tentativas</h3>
            {Array.isArray(pagamentoSeguro.tentativas) && pagamentoSeguro.tentativas.length > 0 ? (
              <div className="space-y-2">
                {pagamentoSeguro.tentativas.map((tentativa, indice) => {
                  const linha = tentativa as Record<string, unknown>;
                  return <div key={indice} className="rounded-lg border bg-muted/20 p-3 text-sm"><strong>{valorJson(linha, "metodo") || "Método"}</strong> · {valorJson(linha, "estado") || "Sem estado"}<p className="mt-1 text-xs text-muted-foreground">{valorJson(linha, "referencia_interna") || "Sem referência"}</p>{valorJson(linha, "mensagem_erro") && <p className="mt-1 text-xs text-destructive">{valorJson(linha, "mensagem_erro")}</p>}</div>;
                })}
              </div>
            ) : <p className="text-sm text-muted-foreground">Ainda não existem tentativas de pagamento.</p>}
          </div>
        </div>
      </BlocoAdmin>
      {encomenda.modalidade === "entrega" && (
        <BlocoAdmin titulo="Logística e matching">
          {atribuicaoAtual.estado !== "nao_atribuido" && <div className="mb-5"><ProgressoEntregaAdmin atribuicao={atribuicaoAtual} /></div>}
          <div className="mb-5 grid gap-4 md:grid-cols-2">
            <div><h3 className="font-semibold">Requisitos da carga</h3><div className="mt-3"><RegistoJson dados={requisitosSeguros} /></div></div>
            <div><h3 className="font-semibold">Entregador atribuído</h3>{atribuicaoAtual.estado === "nao_atribuido" ? <p className="mt-3 text-sm text-muted-foreground">Não atribuído</p> : <dl className="mt-3 grid gap-2 text-sm"><CampoAdmin rotulo="Parceiro" valor={atribuicaoAtual.parceiro_nome} /><CampoAdmin rotulo="Veículo" valor={[atribuicaoAtual.veiculo_tipo, atribuicaoAtual.matricula].filter(Boolean).join(" · ")} /><CampoAdmin rotulo="Estado" valor={<EtiquetaEstado estado={atribuicaoAtual.estado} />} /><CampoAdmin rotulo="Atribuído em" valor={formatarData(atribuicaoAtual.atribuido_em)} /><CampoAdmin rotulo="Aceite em" valor={formatarData(atribuicaoAtual.aceite_em)} /><CampoAdmin rotulo="Chegou à origem em" valor={formatarData(atribuicaoAtual.chegou_origem_em)} /><CampoAdmin rotulo="Recolhida em" valor={formatarData(atribuicaoAtual.recolhida_em)} /><CampoAdmin rotulo="Recusado em" valor={formatarData(atribuicaoAtual.recusado_em)} /><CampoAdmin rotulo="Cancelado em" valor={formatarData(atribuicaoAtual.cancelado_em)} /><CampoAdmin rotulo="Concluído em" valor={formatarData(atribuicaoAtual.concluido_em)} /><CampoAdmin rotulo="Motivo da recusa" valor={atribuicaoAtual.motivo_recusa} /><CampoAdmin rotulo="Motivo do cancelamento" valor={atribuicaoAtual.motivo_cancelamento} /><CampoAdmin rotulo="Responsável" valor={atribuicaoAtual.admin_nome} /></dl>}</div>
          </div>
          {!entregaProntaParaRecolha && atribuicaoAtual.estado === "nao_atribuido" && !["recolhida", "recusada", "cancelada", "concluida"].includes(encomenda.estado) && <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">A encomenda precisa estar pronta para recolha antes de atribuir um entregador.</p>}
          {atribuicaoAtual.estado === "recusada" && <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><p className="font-semibold">Entregador recusou esta tarefa.</p>{atribuicaoAtual.motivo_recusa && <p className="mt-1">Motivo: {atribuicaoAtual.motivo_recusa}</p>}{podeAtribuir && <p className="mt-2">Escolha outro entregador compatível abaixo.</p>}</div>}
          {atribuicaoAtual.estado === "cancelada" && <p className="mb-4 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">Esta atribuição foi cancelada e permanece apenas para histórico.</p>}
          {atribuicaoAtual.estado === "concluida" && <p className="mb-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">Esta entrega foi concluída.</p>}
          {atribuicaoAtual.estado === "recolhida" && <p className="mb-4 rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">A custódia foi transferida para o entregador.</p>}
          <section className="mb-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <h3 className="font-semibold text-amber-950">Intervenção operacional</h3>
            {incidente && <div className="mt-2 space-y-2 text-sm text-amber-950"><p><strong>Último incidente {incidente.estado === "aberto" ? "aberto" : "resolvido"}:</strong> {incidente.tipo.split("_").join(" ")}</p><p>{incidente.motivo}</p>{incidente.observacao_resolucao && <p><strong>Resolução:</strong> {incidente.observacao_resolucao}</p>}{incidente.estado === "aberto" && <button type="button" onClick={() => setIntervencao("resolver")} disabled={processandoIntervencao} className="rounded-lg border border-amber-700 px-3 py-2 font-semibold hover:bg-amber-100">Resolver incidente</button>}</div>}
            {!incidente && ["atribuida", "aceite", "chegou_origem"].includes(atribuicaoAtual.estado) && <div className="mt-2 text-sm text-amber-950"><p>A mercadoria ainda não foi recolhida. Esta ação retira a tarefa atual e permite nova atribuição.</p><button type="button" onClick={() => setIntervencao("libertar")} disabled={processandoIntervencao} className="mt-3 rounded-lg border border-amber-700 px-3 py-2 font-semibold hover:bg-amber-100">Libertar atribuição</button></div>}
            {["recolhida", "chegou_destino"].includes(atribuicaoAtual.estado) && incidente?.estado !== "aberto" && <div className="mt-2 text-sm text-amber-950"><p>A mercadoria está sob custódia do entregador. Não é possível reatribuir esta tarefa.</p><button type="button" onClick={() => setIntervencao("incidente")} disabled={processandoIntervencao} className="mt-3 rounded-lg border border-amber-700 px-3 py-2 font-semibold hover:bg-amber-100">Registar incidente</button></div>}
            {!incidente && !["atribuida", "aceite", "chegou_origem", "recolhida", "chegou_destino"].includes(atribuicaoAtual.estado) && <p className="mt-2 text-sm text-muted-foreground">Não existe intervenção aplicável neste estado.</p>}
            {intervencao && <div role="dialog" aria-modal="true" aria-label="Confirmar intervenção operacional" className="mt-4 space-y-3 rounded-lg border border-amber-300 bg-background p-3"><p className="font-medium">{intervencao === "libertar" ? "Libertar atribuição" : intervencao === "incidente" ? "Registar incidente" : "Resolver incidente"}</p>{intervencao === "incidente" && <label className="block text-sm">Tipo<select value={tipoIncidente} onChange={(e) => { chaveIntervencao.current = null; setTipoIncidente(e.target.value); }} className="mt-1 block w-full rounded-md border p-2"><option value="entregador_indisponivel">Entregador indisponível</option><option value="vendedor_indisponivel">Vendedor indisponível</option><option value="cliente_indisponivel">Cliente indisponível</option><option value="problema_veiculo">Problema de veículo</option><option value="problema_pagamento">Problema de pagamento</option><option value="problema_otp">Problema de OTP</option><option value="outro">Outro</option></select></label>}<label className="block text-sm">{intervencao === "resolver" ? "Observação de resolução" : "Motivo"}<textarea value={motivoIntervencao} onChange={(e) => { chaveIntervencao.current = null; setMotivoIntervencao(e.target.value); }} maxLength={500} className="mt-1 block min-h-20 w-full rounded-md border p-2" /></label>{erroIntervencao && <p role="alert" className="text-sm text-destructive">{erroIntervencao}</p>}<div className="flex gap-2"><button type="button" onClick={() => { chaveIntervencao.current = null; setIntervencao(null); setMotivoIntervencao(""); }} disabled={processandoIntervencao} className="rounded-lg border px-3 py-2 font-semibold">Cancelar</button><button type="button" onClick={() => void executarIntervencao()} disabled={processandoIntervencao} className="rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground disabled:opacity-60">{processandoIntervencao ? "A guardar…" : "Confirmar"}</button></div></div>}
          </section>
          {compatibilidade === null ? <button onClick={() => void carregarCompatibilidade()} disabled={carregandoCompatibilidade} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{carregandoCompatibilidade && <LoaderCircle className="size-4 animate-spin" />}{carregandoCompatibilidade ? "A avaliar veículos…" : "Ver veículos avaliados"}</button> : (
            <div className="space-y-5">
              {["compativel", "dados_incompletos", "incompativel"].map((estado) => {
                const veiculos = compatibilidade.filter((veiculo) => veiculo.estado === estado);
                if (veiculos.length === 0) return null;
                return <div key={estado}><h3 className="mb-3 font-semibold">{estado === "compativel" ? "Veículos compatíveis" : estado === "dados_incompletos" ? "Dados incompletos" : "Outros veículos avaliados"}</h3><div className="grid gap-3">{veiculos.map((veiculo) => <article key={veiculo.veiculo_id} className="rounded-xl border bg-muted/20 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{veiculo.parceiro_nome} · {veiculo.tipo_veiculo}</p><EtiquetaEstado estado={veiculo.estado} /></div><p className="mt-1 text-muted-foreground">{veiculo.matricula} · {veiculo.capacidade_kg} kg{veiculo.capacidade_volume_m3 !== null ? ` · ${veiculo.capacidade_volume_m3} m³` : ""}</p><div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground"><span>Refrigeração: {veiculo.possui_refrigeracao ? "Sim" : "Não"}</span><span>Caixa: {veiculo.possui_caixa_carga ? "Sim" : "Não"}</span><span>Paletes: {veiculo.aceita_paletes ? "Sim" : "Não"}</span></div><p className="mt-2 text-xs text-muted-foreground">Cobertura: {Array.isArray(veiculo.areas_cobertura) && veiculo.areas_cobertura.length ? `${veiculo.areas_cobertura.length} área(s) ativa(s)` : "Sem áreas ativas"}</p>{veiculo.motivos.length > 0 && <ul className="mt-2 list-disc pl-5 text-muted-foreground">{veiculo.motivos.map((motivo) => <li key={motivo}>{rotuloMotivoCompatibilidade(motivo)}</li>)}</ul>}{veiculo.estado === "compativel" && podeAtribuir && <button onClick={() => void atribuir(veiculo)} disabled={atribuindoVeiculoId !== null} className="mt-3 rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground disabled:opacity-60">{atribuindoVeiculoId === veiculo.veiculo_id ? "A atribuir…" : atribuicaoAtual.estado === "recusada" ? "Escolher outro entregador" : "Atribuir"}</button>}</article>)}</div></div>;
              })}
            </div>
          )}
          {erroCompatibilidade && <button onClick={() => { setCompatibilidade(null); void carregarCompatibilidade(); }} className="mt-3 text-sm font-semibold text-destructive hover:underline">Não foi possível avaliar os veículos. Tentar novamente.</button>}
          {erroAtribuicao && <p role="alert" className="mt-3 text-sm text-destructive">{erroAtribuicao} Atualiza a avaliação antes de tentar novamente.</p>}
        </BlocoAdmin>
      )}
      <BlocoAdmin titulo="Histórico">
        <ol className="space-y-3 border-l-2 border-primary/20 pl-4">
          {eventos.map((evento, indice) => (
            <li key={`${evento.tipo}-${indice}`}>
              <p className="text-sm font-semibold capitalize">
                {evento.tipo.split("_").join(" ")}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatarData(evento.criado_em)} · {evento.ator}
              </p>
            </li>
          ))}
        </ol>
      </BlocoAdmin>
      <BlocoAdmin titulo="Disputa">
        <dl className="grid gap-4 sm:grid-cols-3">
          <CampoAdmin
            rotulo="Estado"
            valor={
              <EtiquetaEstado
                estado={
                  typeof disputa.estado === "string" ? disputa.estado : null
                }
              />
            }
          />
          <CampoAdmin
            rotulo="Tipo"
            valor={
              typeof disputa.tipo === "string"
                ? disputa.tipo.split("_").join(" ")
                : null
            }
          />
          <CampoAdmin
            rotulo="Decisão"
            valor={typeof disputa.decisao === "string" ? disputa.decisao : null}
          />
        </dl>
      </BlocoAdmin>
    </div>
  );
}
