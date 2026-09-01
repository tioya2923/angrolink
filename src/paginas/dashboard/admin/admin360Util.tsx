import type { ReactNode } from "react";

export function formatarKz(valorCentimos: number | null | undefined): string {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
  }).format((valorCentimos ?? 0) / 100);
}

export function formatarData(valor: string | null | undefined): string {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("pt-AO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(valor));
}

export function rotuloEstado(valor: string | null | undefined): string {
  if (!valor) return "Sem informação";
  const rotulos: Record<string, string> = {
    nao_atribuido: "Não atribuído",
    compativel: "Compatível",
    incompativel: "Incompatível",
    dados_incompletos: "Dados incompletos",
    chegou_origem: "Chegou à origem",
    recolhida: "Recolhida",
    concluida: "Concluída",
    cancelada: "Cancelada",
    pronta_para_levantamento: "Pronta para levantamento",
    em_preparacao: "Em preparação",
    atribuida: "Atribuída",
    aceite: "Aceite",
    recusada: "Recusada",
    aguardando_confirmacao: "Aguardando confirmação",
    confirmada: "Confirmada",
  };
  return rotulos[valor] ?? valor.split("_").join(" ");
}

export function EtiquetaEstado({
  estado,
}: {
  estado: string | null | undefined;
}) {
  const valor = estado || "desconhecido";
  const classe = /cancel|recus|falh|suspens|incompativel/i.test(valor)
    ? "border-red-200 bg-red-50 text-red-700"
    : /dados_incompletos|aberta|analise|pendente|aguardando|preparacao|atribuida/i.test(valor)
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : /aceite|chegou_origem/i.test(valor)
        ? "border-blue-200 bg-blue-50 text-blue-800"
        : /recolhida|concluida|compativel/i.test(valor)
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${classe}`}
    >
      {rotuloEstado(valor)}
    </span>
  );
}

export function BlocoAdmin({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section className="painel-dashboard-form">
      <h2 className="font-titulo text-lg font-bold text-foreground">
        {titulo}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function CampoAdmin({
  rotulo,
  valor,
}: {
  rotulo: string;
  valor: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{rotulo}</dt>
      <dd className="mt-1 break-words text-sm text-foreground">
        {valor ?? "—"}
      </dd>
    </div>
  );
}
