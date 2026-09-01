import { useMemo } from "react";
import {
  MessageCircle,
  MapPin,
  Package,
  Wrench,
  Eye,
  Phone,
  Calendar,
  Star
} from "lucide-react";

import SeloVendedor from "@/componentes/SeloVendedor";
import { gerarLinkWhatsApp } from "@/lib/whatsapp";
import { obterBadgeVendedor } from "@/dados/constantes";

import {
  Produto,
  Servico,
  Vendedor
} from "@/tipos";

interface PerfilVendedorHeroProps {
  vendedor: Vendedor;
  produtos: Produto[];
  servicos: Servico[];
}

const getImagemPerfil = (img?: string | null) =>
  img || "/placeholder.png";

export default function PerfilVendedorHero({

  vendedor,

  produtos,

  servicos,

}: PerfilVendedorHeroProps) {

  const estatisticas = useMemo(() => {

    const visualizacoes =
      [...produtos, ...servicos].reduce(
        (total, item) =>
          total + Number(item.visualizacoes || 0),
        0
      );

    const contactos =
      [...produtos, ...servicos].reduce(
        (total, item) =>
          total + Number(item.cliques_whatsapp || 0),
        0
      );

    return {

      produtos: produtos.length,

      servicos: servicos.length,

      visualizacoes,

      contactos,

    };

  }, [produtos, servicos]);

  const membroDesde =
    vendedor.criado_em
      ? new Date(vendedor.criado_em)
          .toLocaleDateString("pt-PT", {
            month: "long",
            year: "numeric",
          })
      : "";
      

  return (

    <>

      {/* ===========================
              BANNER
      =========================== */}

      <div
        className="
          relative
          h-40
          md:h-48
          rounded-3xl
          overflow-hidden
          shadow-xl
        "
      >

        <img
          src="/imagens/banner-loja.jpg"
          alt="Banner Loja"
          className="
            absolute
            inset-0
            w-full
            h-full
            object-cover
            scale-105
          "
        />

        <div
          className="
            absolute
            inset-0
            bg-gradient-to-r
            from-green-950/70
            via-green-800/55
            to-green-700/40
          "
        />

      </div>

      <div className="-mt-4 px-8 lg:px-10">

        <div className="flex flex-col lg:flex-row gap-8 pt-6">

          {/* FOTO */}

          <div className="flex justify-center lg:block">

            <img
              src={getImagemPerfil(vendedor.foto_perfil)}
              alt={vendedor.nome_comercial}
              className="
              w-52
              h-52
              md:w-56
              md:h-56
              rounded-3xl
              object-cover
              border-[6px]
              border-white
              shadow-2xl
              bg-white
              "
              onError={(e) => {
                e.currentTarget.src = "/placeholder.png";
              }}
            />

          </div>

          {/* INFORMAÇÕES */}

          <div className="flex-1 pt-2 space-y-5">

            <div className="grid lg:grid-cols-[1fr_320px] gap-10">

              <div className="pt-10">

                <div className="flex items-center gap-3 flex-wrap">

                  <h1
                    className="
                      text-4xl
                      md:text-5xl
                      font-extrabold
                      tracking-tight
                    "
                  >

                    {vendedor.nome_comercial}

                  </h1>

                  <SeloVendedor vendedor={vendedor} />

                </div>

                <div className="mt-4">

                  <div className="flex items-center gap-1 text-yellow-500">

                    <Star fill="currentColor" size={18}/>
                    <Star fill="currentColor" size={18}/>
                    <Star fill="currentColor" size={18}/>
                    <Star fill="currentColor" size={18}/>
                    <Star fill="currentColor" size={18}/>

                  </div>

                  <p className="text-sm text-gray-500 mt-1">

                    Ainda sem avaliações

                  </p>

                </div>

              </div>

            </div>

            <div className="flex flex-wrap gap-8 text-gray-600 text-sm">

              <div className="flex items-center gap-2">

                <MapPin size={18} />

                {vendedor.municipio},{" "}
                {vendedor.provincia}

              </div>

              <div className="flex items-center gap-2">

                <Calendar size={18} />

                Membro desde {membroDesde}

              </div>

            </div>

            <div className="flex flex-wrap gap-3 mt-1">

              <span className="
              rounded-full
              bg-green-100
              text-green-800
              font-semibold
              px-5
              py-2
              ">

                {obterBadgeVendedor(vendedor.tipo_vendedor).rotulo}

              </span>

            </div>

            <h2 className="font-semibold text-lg">

            Sobre esta loja

            </h2>

            <p className="text-gray-600 leading-relaxed max-w-3xl">

              {vendedor.descricao || "Sem descrição."}

            </p>

                        {/* BOTÃO */}

            {vendedor.telefone_whatsapp && (

              <div className="pt-2">

                <a
                  href={gerarLinkWhatsApp(
                    vendedor.telefone_whatsapp,
                    `Loja ${vendedor.nome_comercial}`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    inline-flex
                    items-center
                    gap-3
                    rounded-xl
                    bg-green-600
                    hover:bg-green-700
                    text-white
                    px-6
                    py-3
                    w-fit
                    shadow-lg
                    transition
                    font-semibold
                  "
                >

                  <MessageCircle size={24} />

                  Contactar no WhatsApp

                </a>
                

              </div>
              

            )}

          </div>

          

        </div>

      </div>

      {/* ESTATÍSTICAS */}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-10">

        <div className="rounded-xl border bg-white shadow-sm hover:shadow-md transition p-7 text-center">

          <Package
            className="mx-auto mb-3 text-green-700"
            size={30}
          />

          <p className="text-4xl font-bold">

            {estatisticas.produtos}

          </p>

          <p className="text-sm text-gray-500 mt-2">

            Produtos

          </p>

        </div>

        <div className="rounded-xl border bg-white shadow-sm hover:shadow-md transition p-7 text-center">

          <Wrench
            className="mx-auto mb-3 text-green-700"
            size={30}
          />

          <p className="text-4xl font-bold">

            {estatisticas.servicos}

          </p>

          <p className="text-sm text-gray-500 mt-2">

            Serviços

          </p>

        </div>

        <div className="rounded-xl border bg-white shadow-sm hover:shadow-md transition p-7 text-center">

          <Eye
            className="mx-auto mb-3 text-green-700"
            size={30}
          />

          <p className="text-4xl font-bold">

            {estatisticas.visualizacoes}

          </p>

          <p className="text-sm text-gray-500 mt-2">

            Visualizações

          </p>

        </div>

        <div className="rounded-xl border bg-white shadow-sm hover:shadow-md transition p-7 text-center">

          <Phone
            className="mx-auto mb-3 text-green-700"
            size={30}
          />

          <p className="text-3xl font-bold">

            {estatisticas.contactos}

          </p>

          <p className="text-sm text-gray-500 mt-2">

            Contactos

          </p>

        </div>

      </div>

    </>

  );

}
