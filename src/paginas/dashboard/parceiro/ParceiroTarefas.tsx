import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import { useNotificacoesSessao } from "@/contextos/NotificacoesContexto";
import {
  listarTarefasEntregador,
  type EstadoTarefaEntrega,
  type TarefaEntregaResumo,
} from "@/services/tarefasEntregador";

const rotulo: Record<EstadoTarefaEntrega, string> = {
  atribuida: "Nova",
  aceite: "Aceite",
  chegou_origem: "Chegou à origem",
  recolhida: "Recolhida",
  chegou_destino: "No destino",
  recusada: "Recusada",
  cancelada: "Cancelada",
  concluida: "Concluída",
};

export default function ParceiroTarefas() {
  const [tarefas, setTarefas] = useState<TarefaEntregaResumo[]>([]);
  const [erro, setErro] = useState(false);
  const [aCarregar, setACarregar] = useState(true);
  const { ultimaRealtime } = useNotificacoesSessao();

  const carregar = useCallback(async () => {
    try {
      setErro(false);
      setTarefas(await listarTarefasEntregador());
    } catch {
      setErro(true);
    } finally {
      setACarregar(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (
      ultimaRealtime?.contexto === "entrega" &&
      ultimaRealtime.tipo === "nova_tarefa"
    ) {
      void carregar();
    }
  }, [carregar, ultimaRealtime]);

  if (aCarregar) {
    return <p className="painel-dashboard-form text-sm text-muted-foreground">A carregar tarefas…</p>;
  }

  if (erro) {
    return (
      <div className="painel-dashboard-form text-sm text-destructive">
        Não foi possível carregar as tarefas.{" "}
        <button type="button" onClick={() => void carregar()} className="underline">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="painel-dashboard-cabecalho flex items-center gap-3">
        <span className="relative z-10 rounded-xl bg-primary-foreground/15 p-3 text-primary-foreground">
          <ClipboardList className="size-5" />
        </span>
        <div>
          <h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">Tarefas de entrega</h1>
          <p className="relative z-10 text-sm text-primary-foreground/80">Consulta e responde às entregas que lhe foram atribuídas.</p>
        </div>
      </header>

      {tarefas.length === 0 ? (
        <div className="painel-dashboard-form border-dashed py-12 text-center text-sm text-muted-foreground">Ainda não tem tarefas atribuídas.</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {tarefas.map(tarefa => (
            <article key={tarefa.id} className="painel-dashboard-form space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-titulo font-bold">{tarefa.codigo_publico}</h2>
                  <p className="text-sm text-muted-foreground">{tarefa.tipo_veiculo} · {tarefa.matricula}</p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{rotulo[tarefa.estado]}</span>
              </div>
              <p className="text-sm"><strong>Origem:</strong> {String((tarefa.origem as Record<string, string>).municipio ?? "—")}, {String((tarefa.origem as Record<string, string>).provincia ?? "")}</p>
              <p className="text-sm"><strong>Destino:</strong> {String((tarefa.destino as Record<string, string>).municipio ?? "—")}, {String((tarefa.destino as Record<string, string>).provincia ?? "")}</p>
              <p className="text-sm text-muted-foreground">{tarefa.quantidade_itens} item(ns) · Atribuída em {new Date(tarefa.atribuido_em).toLocaleString("pt-PT")}</p>
              <Link to={`/dashboard/tarefas/${tarefa.id}`} className="inline-flex rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white">Ver tarefa</Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
