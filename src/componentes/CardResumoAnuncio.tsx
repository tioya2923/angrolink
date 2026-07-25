import { Eye, MessageCircle, Pencil, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface CardResumoAnuncioProps {
  id: string;
  titulo: string;
  imagem?: string | null;
  tipo: "produto" | "servico";

  visualizacoes?: number;
  contactos?: number;
  preco?: number | null;

  estado?: string;

  data?: string;

  linkEditar: string;
  linkVisualizar: string;
}

export default function CardResumoAnuncio({
  titulo,
  imagem,
  tipo,
  preco,
  visualizacoes = 0,
  contactos = 0,
  estado = "Ativo",
  data,
  linkEditar,
  linkVisualizar,
}: CardResumoAnuncioProps) {

  return (
    <div className="bg-white rounded-xl border shadow-sm hover:shadow-md transition overflow-hidden">

      <img
        src={imagem || "/placeholder.png"}
        alt={titulo}
        className="w-full h-44 object-cover"
      />

      <div className="p-4">

        <div className="flex justify-between items-start">

          <div>

            <h3 className="font-semibold text-lg">
              {titulo}
            </h3>

            <span className="text-sm text-gray-500">
              {tipo === "produto"
                ? "Produto"
                : "Serviço"}
            </span>

            {preco != null && (

                <p className="mt-3 text-xl font-bold text-green-700">

                    {new Intl.NumberFormat("pt-AO").format(preco)} Kz

                </p>

            )}

          </div>

            <span
            className={`px-2 py-1 rounded-full text-xs font-medium
                ${
                estado === "aprovado"
                    ? "bg-green-100 text-green-700"
                    : estado === "pendente"
                    ? "bg-yellow-100 text-yellow-700"
                    : estado === "rejeitado"
                    ? "bg-red-100 text-red-700"
                    : estado === "suspenso"
                    ? "bg-gray-200 text-gray-700"
                    : "bg-blue-100 text-blue-700"
                }
            `}
            >
            {estado === "aprovado"
                ? "Aprovado"
                : estado === "pendente"
                ? "Pendente"
                : estado === "rejeitado"
                ? "Rejeitado"
                : estado === "suspenso"
                ? "Suspenso"
                : "Ativo"}
            </span>

        </div>

        <div className="grid grid-cols-3 gap-3 mt-5">

            <div className="rounded-lg bg-gray-50 border p-3 text-center">

                <Eye
                size={18}
                className="mx-auto text-green-700 mb-2"
                />

                <p className="text-lg font-bold">
                {visualizacoes}
                </p>

                <span className="text-xs text-gray-500">
                Visualizações
                </span>

            </div>

            <div className="rounded-lg bg-gray-50 border p-3 text-center">

                <MessageCircle
                size={18}
                className="mx-auto text-blue-700 mb-2"
                />

                <p className="text-lg font-bold">
                {contactos}
                </p>

                <span className="text-xs text-gray-500">
                Contactos
                </span>

            </div>

            <div className="rounded-lg bg-gray-50 border p-3 text-center">

                <span className="text-lg">
                📅
                </span>

                <p className="text-sm font-semibold mt-2">
                {data
                    ? new Date(data).toLocaleDateString("pt-PT")
                    : "--"}
                </p>

                <span className="text-xs text-gray-500">
                Atualizado
                </span>

            </div>

        </div>

        <div className="flex gap-2 mt-5">

          <Link
            to={linkEditar}
            className="
              flex-1
              flex
              items-center
              justify-center
              gap-2
              border
              rounded-lg
              py-2
              hover:bg-gray-50
            "
          >
            <Pencil size={16} />

            Editar
          </Link>

          <Link
            to={linkVisualizar}
            className="
              flex-1
              flex
              items-center
              justify-center
              gap-2
              bg-green-700
              text-white
              rounded-lg
              py-2
              hover:bg-green-800
            "
          >
            <ExternalLink size={16} />

            Ver
          </Link>

        </div>

      </div>

    </div>
  );
}