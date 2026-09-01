import { useCallback, useEffect, useState } from "react";
import { Banknote } from "lucide-react";
import {
  listarFinanceiroAdmin,
  type FinanceiroAdminResumo,
} from "@/services/admin360";
import { EtiquetaEstado, formatarData, formatarKz } from "./admin360Util";

export default function AdminFinanceiro() {
  const [linhas, setLinhas] = useState<FinanceiroAdminResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const carregar = useCallback(async () => {
    try {
      setErro(false);
      setLinhas(await listarFinanceiroAdmin());
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);
  if (carregando)
    return (
      <p className="painel-dashboard-form text-sm text-muted-foreground">
        A carregar informação financeira…
      </p>
    );
  if (erro)
    return (
      <p className="painel-dashboard-form text-sm text-destructive">
        Não foi possível carregar a informação financeira.
      </p>
    );
  return (
    <div className="space-y-6">
      <header className="painel-dashboard-cabecalho flex items-center gap-3">
        <span className="relative z-10 rounded-xl bg-primary-foreground/15 p-3 text-primary-foreground">
          <Banknote className="size-5" />
        </span>
        <div>
          <h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">
            Financeiro
          </h1>
          <p className="relative z-10 text-sm text-primary-foreground/80">
            Snapshots históricos e valores efetivos, calculados pelo servidor.
          </p>
        </div>
      </header>
      {linhas.length === 0 ? (
        <p className="painel-dashboard-form border-dashed py-12 text-center text-sm text-muted-foreground">
          Ainda não existem pagamentos para apresentar.
        </p>
      ) : (
        <div className="grid gap-3">
          {linhas.map((linha) => (
            <article
              key={linha.pagamento_id}
              className="rounded-2xl border-2 border-border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="font-titulo font-bold">
                    {linha.referencia_interna}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {linha.codigo_publico} · {linha.cliente_nome} ·{" "}
                    {linha.vendedor_nome}
                  </p>
                </div>
                <EtiquetaEstado estado={linha.estado_pagamento} />
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Valor rotulo="Subtotal" valor={linha.subtotal_centimos} />
                <Valor rotulo="Desconto" valor={linha.desconto_centimos} />
                <Valor rotulo="Entrega" valor={linha.entrega_centimos} />
                <Valor rotulo="Total" valor={linha.total_centimos} forte />
                <Valor
                  rotulo="Comissão snapshot"
                  valor={linha.comissao_snapshot_centimos}
                />
                <Valor
                  rotulo="Comissão efetiva"
                  valor={linha.comissao_efetiva_centimos}
                />
                <Valor
                  rotulo="Vendedor snapshot"
                  valor={linha.valor_vendedor_snapshot_centimos}
                />
                <Valor
                  rotulo="Vendedor efetivo"
                  valor={linha.valor_vendedor_efetivo_centimos}
                />
              </div>
              <div className="mt-4 flex flex-wrap justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                <span>
                  Método: {linha.metodo || "—"} · Reembolsado:{" "}
                  {formatarKz(linha.total_reembolsado_centimos)}
                </span>
                <span>
                  Repasse: {linha.estado_repasse || "Ainda não iniciado"} ·{" "}
                  {formatarData(linha.criado_em)}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Valor({
  rotulo,
  valor,
  forte = false,
}: {
  rotulo: string;
  valor: number;
  forte?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className={forte ? "font-bold text-primary" : "font-semibold"}>
        {formatarKz(valor)}
      </p>
    </div>
  );
}
