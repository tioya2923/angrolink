import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Scale } from "lucide-react";
import {
  listarDisputasAdmin,
  type DisputaAdminResumo,
} from "@/services/admin360";
import { EtiquetaEstado, formatarData, formatarKz } from "./admin360Util";

export default function AdminDisputas() {
  const [disputas, setDisputas] = useState<DisputaAdminResumo[]>([]);
  const [estado, setEstado] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const carregar = useCallback(async () => {
    try {
      setErro(false);
      setDisputas(await listarDisputasAdmin(estado));
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }, [estado]);
  useEffect(() => {
    void carregar();
  }, [carregar]);
  return (
    <div className="space-y-6">
      <header className="painel-dashboard-cabecalho flex items-center gap-3">
        <span className="relative z-10 rounded-xl bg-primary-foreground/15 p-3 text-primary-foreground">
          <Scale className="size-5" />
        </span>
        <div>
          <h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">
            Disputas
          </h1>
          <p className="relative z-10 text-sm text-primary-foreground/80">
            Acompanha problemas reportados e decisões administrativas.
          </p>
        </div>
      </header>
      <section className="painel-dashboard-form">
        <label className="text-sm font-medium">
          Estado{" "}
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="ml-2 rounded-lg border bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="aberta">Aberta</option>
            <option value="em_analise">Em análise</option>
            <option value="resolvida_sem_reembolso">
              Resolvida sem reembolso
            </option>
            <option value="resolvida_reembolso_parcial">
              Reembolso parcial
            </option>
            <option value="resolvida_reembolso_total">Reembolso total</option>
          </select>
        </label>
      </section>
      {carregando ? (
        <p className="painel-dashboard-form text-sm text-muted-foreground">
          A carregar disputas…
        </p>
      ) : erro ? (
        <p className="painel-dashboard-form text-sm text-destructive">
          Não foi possível carregar as disputas.
        </p>
      ) : disputas.length === 0 ? (
        <p className="painel-dashboard-form border-dashed py-12 text-center text-sm text-muted-foreground">
          Não existem disputas neste estado.
        </p>
      ) : (
        <div className="grid gap-3">
          {disputas.map((disputa) => (
            <article
              key={disputa.disputa_id}
              className="rounded-2xl border-2 border-border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="font-titulo font-bold">
                    {disputa.codigo_publico}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {disputa.cliente_nome} · {disputa.vendedor_nome}
                  </p>
                </div>
                <EtiquetaEstado estado={disputa.estado} />
              </div>
              <p className="mt-3 text-sm">{disputa.descricao_resumida}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <p className="capitalize">
                    {disputa.tipo_problema.split("_").join(" ")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Valor reclamado
                  </p>
                  <p>{formatarKz(disputa.valor_reclamado_centimos)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Responsável</p>
                  <p>{disputa.responsavel_admin_id || "Ainda não atribuído"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p>{formatarData(disputa.criado_em)}</p>
                </div>
              </div>
              <div className="mt-4 border-t pt-3 text-right">
                <Link
                  to={`/dashboard/disputas/${disputa.disputa_id}`}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                >
                  Analisar disputa <ExternalLink className="size-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
