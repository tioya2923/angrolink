import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";

import { useAuth } from "@/contextos/AuthContexto";
import {
  fetchHistoricoContactosVendedor,
  fetchHistoricoContactosServicosVendedor,
} from "@/services/api";

export default function VendedorContactos() {
  const { utilizador } = useAuth();

  const [carregando, setCarregando] = useState(true);

  const [historicoProdutos, setHistoricoProdutos] = useState<any[]>([]);

  const [historicoServicos, setHistoricoServicos] = useState<any[]>([]);

  const historico = [
    ...historicoProdutos.map((item) => ({
        ...item,
        tipo: "produto",
        data: item.atualizado_em || item.criado_em,
    })),

    ...historicoServicos.map((item) => ({
        ...item,
        tipo: "servico",
        data: item.atualizado_em || item.criado_em,
    })),
    ].sort(
    (a, b) =>
        new Date(b.data).getTime() -
        new Date(a.data).getTime()
    );

  useEffect(() => {
    async function carregarHistorico() {

        if (!utilizador?.vendedor_id) {
        setCarregando(false);
        return;
        }

        const [produtos, servicos] = await Promise.all([
        fetchHistoricoContactosVendedor(utilizador.vendedor_id),
        fetchHistoricoContactosServicosVendedor(utilizador.vendedor_id),
        ]);

        setHistoricoProdutos(produtos);
        setHistoricoServicos(servicos);

        console.log("Vendedor ID:", utilizador?.vendedor_id);
        console.log("Produtos:", produtos);
        console.log("Serviços:", servicos);

        setCarregando(false);
    }

    carregarHistorico();

    }, [utilizador?.vendedor_id]);

    if (carregando) {
    return (
        <div className="rounded-2xl border bg-card shadow-sm p-8 text-center">
        <p>A carregar contactos...</p>
        </div>
    );
    }
    
  return (
    <div className="space-y-8">

      {/* Cabeçalho */}
      <div>
        <h1 className="font-titulo text-4xl font-bold text-slate-800">
          Contactos
        </h1>

        <p className="mt-2 text-muted-foreground">
          Veja todos os clientes que demonstraram interesse nos seus produtos e serviços.
        </p>
      </div>

      {/* Timeline */}
      {historico.length === 0 ? (

        <div className="flex flex-col items-center justify-center py-12 text-center">

            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">

            <MessageSquare
                className="text-green-700"
                size={30}
            />

            </div>

            <h2 className="font-titulo text-xl font-semibold">
            Ainda não existem contactos
            </h2>

            <p className="mt-2 max-w-md text-muted-foreground">
            Quando um cliente contactar um dos seus anúncios,
            o histórico aparecerá aqui.
            </p>

        </div>

        ) : (

        <div className="space-y-4">

            {historico.map((item) => (

            <div
                key={`${item.tipo}-${item.id}`}
                className="rounded-xl border p-5 hover:bg-muted/30 transition"
            >

                <div className="flex justify-between items-start">

                <div>

                    <p className="font-semibold">

                    {item.clientes?.nome || "Cliente"}

                    </p>

                    <p className="text-sm text-muted-foreground mt-1">

                    {item.tipo === "produto"
                        ? item.produtos?.nome_produto
                        : item.servicos?.nome_servico}

                    </p>

                </div>

                <span className="text-xs text-muted-foreground">

                    {new Date(item.data).toLocaleString("pt-PT")}

                </span>

                </div>

            </div>

            ))}

        </div>

      )}

    </div>
  );
}