import { Link } from "react-router-dom";
import { Eye, MapPin, MessageCircle } from "lucide-react";

import { Produto } from "@/tipos";
import { gerarLinkWhatsApp } from "@/lib/whatsapp";
import { obterPromocao } from '@/lib/precos';
import { AcoesCompraProduto } from '@/componentes/carrinho/AcoesCompraProduto';

interface Props {
  produto: Produto;
  vendedor?: any;
}

export default function CardProdutoLoja({ produto, vendedor }: Props) {
  const imagem =
    produto.imagem_url || "/placeholder.png";

  const telefone =
    vendedor?.telefone_whatsapp ||
    vendedor?.whatsapp;

  const linkWhatsapp = telefone
    ? gerarLinkWhatsApp(
        telefone,
        produto.nome_produto
      )
    : "#";
  const promocao = obterPromocao(produto.preco_aproximado, produto.preco_promocional);

  return (
    <div
      className="
        bg-white
        rounded-2xl
        shadow-sm
        hover:shadow-lg
        transition
        overflow-hidden
        border
      "
    >
      <Link to={`/produto/${produto.id}`}>
        <div className="aspect-square overflow-hidden relative">
          <img
            src={imagem}
            alt={produto.nome_produto}
            className="
              w-full
              h-full
              object-cover
              hover:scale-105
              transition
              duration-300
            "
          />
          {promocao && (
            <span className="absolute left-3 top-3 rounded-full bg-destructive px-2 py-1 text-xs font-bold text-destructive-foreground">
              -{promocao.percentagem}%
            </span>
          )}
        </div>
      </Link>

      <div className="p-4">
        <h3 className="font-bold text-lg">
          {produto.nome_produto}
        </h3>

        {promocao ? (
          <div className="mt-2">
            <p className="text-2xl font-bold text-destructive">{promocao.precoPromocional.toLocaleString()} Kz</p>
            <p className="text-sm text-muted-foreground line-through">{promocao.precoOriginal.toLocaleString()} Kz</p>
          </div>
        ) : (
          <p className="text-2xl font-bold text-green-700 mt-2">{Number(produto.preco_aproximado || 0).toLocaleString()} Kz</p>
        )}

        <div
          className="
            flex
            items-center
            gap-2
            mt-3
            text-gray-500
          "
        >
          <MapPin size={16} />

          <span>
            {produto.municipio},{" "}
            {produto.provincia}
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

            {produto.visualizacoes || 0}
          </div>

          <div className="flex items-center gap-2">
            <MessageCircle size={16} />

            {produto.cliques_whatsapp || 0}
          </div>
        </div>

        <div className="grid gap-2 mt-6">
          <Link
            to={`/produto/${produto.id}`}
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
          <AcoesCompraProduto produto={produto} vendedorNome={vendedor?.nome_comercial} modo="card" />
        </div>
      </div>
    </div>
  );
}
