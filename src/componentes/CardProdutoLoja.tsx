import { Link } from "react-router-dom";
import { Eye, MapPin } from "lucide-react";

import { Produto } from "@/tipos";
import { ChatPreCompraProduto } from '@/componentes/ChatPreCompraProduto';
import { obterPromocao } from '@/lib/precos';
import { AcoesCompraProduto } from '@/componentes/carrinho/AcoesCompraProduto';
import SeloVendedor from '@/componentes/SeloVendedor';

interface Props {
  produto: Produto;
  vendedor?: any;
}

export default function CardProdutoLoja({ produto, vendedor }: Props) {
  const imagem =
    produto.imagem_url || "/placeholder.png";

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
        {vendedor?.nome_comercial && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><span className="truncate">{vendedor.nome_comercial}</span><SeloVendedor vendedor={vendedor} compacto /></p>}

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

          {produto.vendedor_id && <ChatPreCompraProduto produto={produto} produtoId={produto.id} produtoNome={produto.nome_produto} vendedorId={produto.vendedor_id} className="w-full py-3" />}
          <AcoesCompraProduto produto={produto} vendedorNome={vendedor?.nome_comercial} modo="card" />
        </div>
      </div>
    </div>
  );
}
