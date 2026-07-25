import { Link } from "react-router-dom";
import {
  Eye,
  MapPin,
  MessageCircle,
  Wrench,
} from "lucide-react";

import { Servico } from "@/tipos";
import { gerarLinkWhatsApp } from "@/lib/whatsapp";

interface Props {
  servico: Servico;
  vendedor?: any;
}

export default function CardServicoLoja({
  servico,  vendedor,
}: Props) {

  const imagem =
    servico.imagem_url || "/placeholder.png";

  const telefone =
    vendedor?.telefone_whatsapp ||
    vendedor?.whatsapp ||
    servico.telefone_whatsapp;

  const linkWhatsapp = telefone
    ? gerarLinkWhatsApp(
        telefone,
        servico.nome_servico
      )
    : "#";

  return (

    <div
      className="
      bg-white
      rounded-2xl
      border
      shadow-sm
      hover:shadow-lg
      transition-all
      overflow-hidden
      "
    >

      <Link
        to={`/servico/${servico.id}`}
      >

        <div className="aspect-square overflow-hidden">

          <img
            src={imagem}
            alt={servico.nome_servico}
            className="
              w-full
              h-full
              object-cover
              hover:scale-105
              transition
              duration-300
            "
          />

        </div>

      </Link>

      <div className="p-4">

        <div className="flex items-center gap-2">

          <Wrench
            size={18}
            className="text-green-700"
          />

          <h3 className="font-bold text-lg">

            {servico.nome_servico}

          </h3>

        </div>

        <p className="text-2xl font-bold text-green-700 mt-2">

          {servico.preco_estimado
            ? `${Number(
                servico.preco_estimado
              ).toLocaleString()} Kz`
            : "Preço sob consulta"}

        </p>

        <div className="flex items-center gap-2 mt-3 text-gray-500">

          <MapPin size={16} />

          <span>

            {servico.municipio},{" "}
            {servico.provincia}

          </span>

        </div>

        <div
          className="
            flex
            justify-between
            mt-5
            text-sm
            text-gray-500
          "
        >

          <div className="flex items-center gap-2">

            <Eye size={16} />

            {servico.visualizacoes || 0}

          </div>

          <div className="flex items-center gap-2">

            <MessageCircle size={16} />

            {servico.cliques_whatsapp || 0}

          </div>

        </div>

        <div className="grid gap-2 mt-6">

          <Link
            to={`/servico/${servico.id}`}
            className="
              border
              rounded-xl
              py-3
              text-center
              hover:bg-gray-100
              transition
            "
          >

            Ver detalhes

          </Link>

          {telefone && (

            <a
              href={linkWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="
                bg-green-600
                hover:bg-green-700
                text-white
                rounded-xl
                py-3
                text-center
                font-semibold
                transition
              "
            >

              WhatsApp

            </a>

          )}

        </div>

      </div>

    </div>

  );

}