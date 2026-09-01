import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, ExternalLink, Filter } from "lucide-react";
import {
  listarEncomendasAdmin,
  type EncomendaAdminResumo,
} from "@/services/admin360";
import { EtiquetaEstado, formatarData, formatarKz } from "./admin360Util";

export default function AdminEncomendas() {
  const [encomendas, setEncomendas] = useState<EncomendaAdminResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [estado, setEstado] = useState("");
  const [pagamento, setPagamento] = useState("");
  const [disputa, setDisputa] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(false);
      setEncomendas(
        await listarEncomendasAdmin({
          estado,
          estadoPagamento: pagamento,
          comDisputa: disputa === "" ? undefined : disputa === "sim",
          de: de ? new Date(`${de}T00:00:00`).toISOString() : undefined,
          ate: ate ? new Date(`${ate}T23:59:59`).toISOString() : undefined,
        }),
      );
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }, [ate, de, disputa, estado, pagamento]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="space-y-6">
      <header className="painel-dashboard-cabecalho flex items-center gap-3">
        <span className="relative z-10 rounded-xl bg-primary-foreground/15 p-3 text-primary-foreground">
          <ClipboardList className="size-5" />
        </span>
        <div>
          <h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">
            Encomendas
          </h1>
          <p className="relative z-10 text-sm text-primary-foreground/80">
            Consulta operacional de encomendas, pagamentos e disputas.
          </p>
        </div>
      </header>
      <section className="painel-dashboard-form">
        <div className="flex items-center gap-2 font-titulo text-sm font-bold">
          <Filter className="size-4 text-primary" />
          Filtros
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="rounded-lg border bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos os estados</option>
            <option value="aguardando_confirmacao">
              Aguardando confirmação
            </option>
            <option value="confirmada">Confirmada</option>
            <option value="em_preparacao">Em preparação</option>
            <option value="pronta_para_levantamento">Pronta</option>
            <option value="levantada">Levantada</option>
            <option value="concluida">Concluída</option>
          </select>
          <select
            value={pagamento}
            onChange={(e) => setPagamento(e.target.value)}
            className="rounded-lg border bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos os pagamentos</option>
            <option value="pendente">Pendente</option>
            <option value="confirmado">Confirmado</option>
            <option value="reembolsado">Reembolsado</option>
          </select>
          <select
            value={disputa}
            onChange={(e) => setDisputa(e.target.value)}
            className="rounded-lg border bg-background px-3 py-2 text-sm"
          >
            <option value="">Com ou sem disputa</option>
            <option value="sim">Com disputa</option>
            <option value="nao">Sem disputa</option>
          </select>
          <input
            type="date"
            value={de}
            onChange={(e) => setDe(e.target.value)}
            aria-label="Data inicial"
            className="rounded-lg border bg-background px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
            aria-label="Data final"
            className="rounded-lg border bg-background px-3 py-2 text-sm"
          />
        </div>
      </section>
      {carregando ? (
        <p className="painel-dashboard-form text-sm text-muted-foreground">
          A carregar encomendas…
        </p>
      ) : erro ? (
        <p className="painel-dashboard-form text-sm text-destructive">
          Não foi possível carregar as encomendas.
        </p>
      ) : encomendas.length === 0 ? (
        <p className="painel-dashboard-form border-dashed py-12 text-center text-sm text-muted-foreground">
          Não existem encomendas com estes filtros.
        </p>
      ) : (
        <div className="grid gap-3">
          {encomendas.map((encomenda) => (
            <article
              key={encomenda.encomenda_id}
              className="rounded-2xl border-2 border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-titulo font-bold">
                    {encomenda.codigo_publico}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {encomenda.cliente_nome} · {encomenda.vendedor_nome}
                  </p>
                </div>
                <EtiquetaEstado estado={encomenda.estado} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-semibold text-primary">
                    {formatarKz(encomenda.total_centimos)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pagamento</p>
                  <EtiquetaEstado estado={encomenda.estado_pagamento} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Disputa</p>
                  <p>
                    {encomenda.tem_disputa
                      ? "Em acompanhamento"
                      : "Sem disputa"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p>{formatarData(encomenda.criado_em)}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm">
                <span>
                  {encomenda.quantidade_itens} item(ns) · {encomenda.modalidade}
                </span>
                <Link
                  to={`/dashboard/encomendas/${encomenda.encomenda_id}`}
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                >
                  Ver detalhe <ExternalLink className="size-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
