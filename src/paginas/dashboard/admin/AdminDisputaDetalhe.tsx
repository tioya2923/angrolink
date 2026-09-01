import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Scale } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  assumirDisputaAdmin,
  criarChaveIdempotenciaAdmin,
  obterDisputaAdmin,
  resolverDisputaReembolsoParcialAdmin,
  resolverDisputaReembolsoTotalAdmin,
  resolverDisputaSemReembolsoAdmin,
  type DisputaAdminDetalhe,
} from "@/services/admin360";
import {
  BlocoAdmin,
  CampoAdmin,
  EtiquetaEstado,
  formatarData,
  formatarKz,
} from "./admin360Util";

type Acao = "sem_reembolso" | "parcial" | "total" | null;
const paraCentimos = (valor: string) =>
  Math.round(Number(valor.replace(",", ".")) * 100);

export default function AdminDisputaDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { toast } = useToast();
  const [detalhe, setDetalhe] = useState<DisputaAdminDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [acao, setAcao] = useState<Acao>(null);
  const [aProcessar, setAProcessar] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [produtos, setProdutos] = useState("");
  const [entrega, setEntrega] = useState("");
  const [chave, setChave] = useState("");
  const carregar = useCallback(async () => {
    if (!id) return;
    try {
      setErro(false);
      setDetalhe(await obterDisputaAdmin(id));
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }, [id]);
  useEffect(() => {
    void carregar();
  }, [carregar]);
  const abrirAcao = (novaAcao: Exclude<Acao, null>) => {
    setAcao(novaAcao);
    setObservacao("");
    setProdutos("");
    setEntrega("");
    setChave(criarChaveIdempotenciaAdmin());
  };
  const assumir = async () => {
    if (!id) return;
    try {
      setAProcessar(true);
      await assumirDisputaAdmin(id);
      toast({ title: "Disputa assumida para análise." });
      await carregar();
    } catch {
      toast({
        title: "Não foi possível assumir a disputa.",
        variant: "destructive",
      });
    } finally {
      setAProcessar(false);
    }
  };
  const resolver = async () => {
    if (!id || !acao || !observacao.trim()) return;
    try {
      setAProcessar(true);
      if (acao === "sem_reembolso")
        await resolverDisputaSemReembolsoAdmin(id, observacao);
      if (acao === "parcial")
        await resolverDisputaReembolsoParcialAdmin({
          disputaId: id,
          valorProdutosCentimos: paraCentimos(produtos || "0"),
          valorEntregaCentimos: paraCentimos(entrega || "0"),
          observacao,
          chaveIdempotencia: chave,
        });
      if (acao === "total")
        await resolverDisputaReembolsoTotalAdmin(id, observacao, chave);
      toast({
        title: "Decisão registada.",
        description:
          acao === "sem_reembolso"
            ? "A disputa foi encerrada sem criar reembolso."
            : "Foi registado um reembolso lógico; nenhum dinheiro foi transferido automaticamente.",
      });
      setAcao(null);
      await carregar();
    } catch {
      toast({
        title: "Não foi possível registar a decisão.",
        description: "Verifique os campos e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setAProcessar(false);
    }
  };
  if (carregando)
    return (
      <p className="painel-dashboard-form text-sm text-muted-foreground">
        A carregar disputa…
      </p>
    );
  if (erro || !detalhe)
    return (
      <p className="painel-dashboard-form text-sm text-destructive">
        Não foi possível carregar esta disputa.
      </p>
    );
  const { disputa, encomenda, auditoria } = detalhe;
  const emAnalise = disputa.estado === "em_analise";
  return (
    <div className="space-y-5">
      <button
        onClick={() => navegar("/dashboard/disputas")}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        Voltar às disputas
      </button>
      <header className="painel-dashboard-cabecalho flex flex-wrap justify-between gap-3">
        <div className="relative z-10 flex items-center gap-3">
          <span className="rounded-xl bg-primary-foreground/15 p-3 text-primary-foreground">
            <Scale className="size-5" />
          </span>
          <div>
            <h1 className="font-titulo text-2xl font-bold text-primary-foreground">
              Disputa {encomenda.encomenda.codigo_publico}
            </h1>
            <p className="text-sm text-primary-foreground/80">
              {disputa.tipo.split("_").join(" ")}
            </p>
          </div>
        </div>
        <div className="relative z-10">
          <EtiquetaEstado estado={disputa.estado} />
        </div>
      </header>
      <div className="grid gap-4 xl:grid-cols-2">
        <BlocoAdmin titulo="Problema reportado">
          <p className="text-sm leading-6">{disputa.descricao}</p>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <CampoAdmin
              rotulo="Valor reclamado"
              valor={formatarKz(disputa.valor_reclamado_centimos)}
            />
            <CampoAdmin
              rotulo="Criada em"
              valor={formatarData(disputa.criado_em)}
            />
            <CampoAdmin
              rotulo="Responsável"
              valor={disputa.analisado_por || "Ainda não atribuído"}
            />
            <CampoAdmin
              rotulo="Assumida em"
              valor={formatarData(disputa.analisado_em)}
            />
          </dl>
        </BlocoAdmin>
        <BlocoAdmin titulo="Encomenda">
          <dl className="grid gap-4 sm:grid-cols-2">
            <CampoAdmin rotulo="Cliente" valor={encomenda.cliente.nome} />
            <CampoAdmin
              rotulo="Vendedor"
              valor={encomenda.vendedor.nome_comercial}
            />
            <CampoAdmin
              rotulo="Estado"
              valor={<EtiquetaEstado estado={encomenda.encomenda.estado} />}
            />
            <CampoAdmin
              rotulo="Total"
              valor={formatarKz(
                typeof encomenda.financeiro.total_centimos === "number"
                  ? encomenda.financeiro.total_centimos
                  : 0,
              )}
            />
          </dl>
        </BlocoAdmin>
      </div>
      <BlocoAdmin titulo="Itens da encomenda">
        <div className="space-y-2">
          {encomenda.itens.map((item, indice) => (
            <div
              key={`${item.nome}-${indice}`}
              className="flex justify-between rounded-lg border p-3 text-sm"
            >
              <span>
                {item.nome} · {item.quantidade} {item.unidade || ""}
              </span>
              <strong>{formatarKz(item.subtotal_centimos)}</strong>
            </div>
          ))}
        </div>
      </BlocoAdmin>
      <BlocoAdmin titulo="Auditoria administrativa">
        <ol className="space-y-3 border-l-2 border-primary/20 pl-4">
          {auditoria.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda não existem ações administrativas.
            </p>
          ) : (
            auditoria.map((evento, indice) => (
              <li key={`${evento.acao}-${indice}`}>
                <p className="text-sm font-semibold capitalize">
                  {evento.acao.split("_").join(" ")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {evento.estado_anterior || "—"} → {evento.estado_novo} ·{" "}
                  {formatarData(evento.criado_em)}
                </p>
                {evento.motivo && (
                  <p className="mt-1 text-sm">{evento.motivo}</p>
                )}
              </li>
            ))
          )}
        </ol>
      </BlocoAdmin>
      {disputa.estado === "aberta" && (
        <button
          disabled={aProcessar}
          onClick={() => void assumir()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <CheckCircle2 className="size-4" />
          {aProcessar ? "A assumir…" : "Assumir análise"}
        </button>
      )}
      {emAnalise && (
        <div className="flex flex-wrap gap-3">
          <button
            disabled={aProcessar}
            onClick={() => abrirAcao("sem_reembolso")}
            className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800"
          >
            Resolver sem reembolso
          </button>
          <button
            disabled={aProcessar}
            onClick={() => abrirAcao("parcial")}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Reembolso parcial
          </button>
          <button
            disabled={aProcessar}
            onClick={() => abrirAcao("total")}
            className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary"
          >
            Reembolso total
          </button>
        </div>
      )}
      <Dialog
        open={acao !== null}
        onOpenChange={(aberto) => {
          if (!aberto && !aProcessar) setAcao(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {acao === "sem_reembolso"
                ? "Resolver sem reembolso"
                : acao === "parcial"
                  ? "Aprovar reembolso parcial"
                  : "Aprovar reembolso total"}
            </DialogTitle>
            <DialogDescription>
              {acao === "sem_reembolso"
                ? "Esta decisão encerra a disputa sem criar reembolso."
                : acao === "parcial"
                  ? "Regista um reembolso lógico. O dinheiro não é transferido automaticamente."
                  : "O servidor calcula produtos e entrega elegíveis. A taxa do processador não está incluída na V1."}
            </DialogDescription>
          </DialogHeader>
          {acao === "parcial" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Produtos (Kz)
                <input
                  value={produtos}
                  onChange={(e) => setProdutos(e.target.value)}
                  inputMode="decimal"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
              <label className="text-sm font-medium">
                Entrega (Kz)
                <input
                  value={entrega}
                  onChange={(e) => setEntrega(e.target.value)}
                  inputMode="decimal"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
            </div>
          )}
          <label className="block text-sm font-medium">
            Observação
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="mt-1 min-h-24 w-full rounded-lg border p-3"
              placeholder="Explique a decisão"
            />
          </label>
          <DialogFooter>
            <button
              disabled={aProcessar}
              onClick={() => setAcao(null)}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Voltar
            </button>
            <button
              disabled={
                aProcessar ||
                observacao.trim().length < 3 ||
                (acao === "parcial" &&
                  paraCentimos(produtos || "0") +
                    paraCentimos(entrega || "0") <=
                    0)
              }
              onClick={() => void resolver()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {aProcessar ? "A registar…" : "Confirmar decisão"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
