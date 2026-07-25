/**
 * ========================================
 * CARD DE PRODUTO
 * ========================================
 */

import { Link } from 'react-router-dom';
import {
  MessageCircle,
  Heart,
  Eye,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Produto, TipoVendedor } from '@/tipos';
import SeloVendedor from '@/componentes/SeloVendedor';
import { gerarLinkWhatsApp } from '@/lib/whatsapp';
import { obterBadgeVendedor } from '@/dados/constantes';
import { useAuth } from '@/contextos/AuthContexto';
import { formatarTempoRelativo }
  from '@/lib/datas';
import {
  guardarHistoricoContacto,
  incrementarCliqueWhatsappProduto,
  adicionarFavoritoProduto,
  removerFavoritoProduto,
  produtoFavoritado,
} from '@/services/api';

interface CardProdutoProps {
  produto: Produto;
  onRemoverFavorito?: (
    produtoId: string
  ) => void;

  mostrarDataContacto?: boolean;
  mostrarWhatsapp?: boolean;
  mostrarVendedor?: boolean;
}

function formatarPreco(valor?: number | null): string {
  if (typeof valor !== 'number') return '—';

  return new Intl.NumberFormat('pt-AO', {
    style: 'decimal',
    minimumFractionDigits: 0,
  }).format(valor);
}

export default function CardProduto({
  produto,
  onRemoverFavorito,
  mostrarDataContacto = false,
  mostrarWhatsapp = true,
  mostrarVendedor = true,
}: CardProdutoProps) {
  const { tipoComprador, utilizador } = useAuth();
  const [favoritado, setFavoritado] = useState(false);
  const [aCarregarFavorito, setACarregarFavorito] = useState(false);


  // =============================
  // VENDEDOR
  // =============================
  const vendedor = produto?.vendedor || null;

  // =============================
  // 🔥 PROTEÇÃO: VENDEDOR DONO
  // =============================
  const vendedorDono =
    utilizador?.papel === 'vendedor' &&
    utilizador?.vendedor_id === produto.vendedor_id;

  const podeFavoritar =
  utilizador?.papel === 'cliente' ||
  (
    utilizador?.papel === 'vendedor' &&
    !vendedorDono
  );

  // =============================
  // IMAGEM
  // =============================
  const imagem =
    produto?.imagem_url?.startsWith('http')
      ? produto.imagem_url
      : '/placeholder.png';

  // =============================
  // BADGE
  // =============================
  const badgeVendedor = vendedor?.tipo_vendedor
    ? obterBadgeVendedor(vendedor.tipo_vendedor as TipoVendedor)
    : null;

  // =============================
  // TIPO DE VENDA
  // =============================
  const tipoVendaLabel =
    produto?.tipo_venda === 'grosso'
      ? 'Grosso'
      : produto?.tipo_venda === 'retalho'
      ? 'Retalho'
      : 'Grosso & Retalho';

  const mostrarDuploPreco =
    produto?.tipo_venda === 'ambos' && produto?.preco_grosso;

  // =============================
  // DESCONTO
  // =============================
  const emDesconto =
    typeof produto?.preco_promocional === 'number' &&
    typeof produto?.preco_aproximado === 'number' &&
    produto.preco_promocional > 0 &&
    produto.preco_promocional < produto.preco_aproximado;

  const percentagemDesconto = emDesconto
    ? Math.round(
        (1 - produto.preco_promocional! / produto.preco_aproximado!) * 100
      )
    : 0;

  // =============================
  // LINK WHATSAPP
  // =============================
  const linkWhatsApp = vendedor
    ? gerarLinkWhatsApp(
        vendedor.telefone_whatsapp,
        produto?.nome_produto || ''
      )
    : '#';

  useEffect(() => {
    async function verificarFavorito() {
      if (
        !podeFavoritar ||
        !utilizador?.id ||
        !produto?.id
      ) {
        return;
      }

      const existe = await produtoFavoritado(
        utilizador.id,
        produto.id
      );

      setFavoritado(existe);
    }

    verificarFavorito();
  }, [
    utilizador?.id,
    produto?.id,
    podeFavoritar,
  ]);

  async function alternarFavorito(
    e: React.MouseEvent
  ) {
    e.preventDefault();
    e.stopPropagation();

    if (
      !utilizador?.id ||
      !podeFavoritar
    ) {
      return;
    }
    

    try {
      setACarregarFavorito(true);

      if (favoritado) {
        await removerFavoritoProduto(
          utilizador.id,
          produto.id
        );

        setFavoritado(false);

        onRemoverFavorito?.(produto.id);
      } else {
        await adicionarFavoritoProduto(
          utilizador.id,
          produto.id
        );

        setFavoritado(true);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setACarregarFavorito(false);
    }
  }

  return (
    <div className="card-produto overflow-hidden h-full flex flex-col">
      {/* LINK PRINCIPAL */}
      <Link to={`/produto/${produto?.id}`} className="block flex-1">
        <div className="aspect-square overflow-hidden relative">
          <img
            src={imagem}
            alt={produto?.nome_produto || 'Produto'}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = '/placeholder.png';
            }}
          />

          {emDesconto && (
            <span className="absolute top-2 left-2 px-2 py-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-sm">
              -{percentagemDesconto}%
            </span>
          )}

          {badgeVendedor && (
            <span
              className={`absolute left-2 px-2 py-0.5 bg-foreground/80 text-background text-[10px] rounded-sm ${
                emDesconto ? 'top-7' : 'top-2'
              }`}
            >
              {badgeVendedor.rotulo}
            </span>
          )}

          <div className="absolute top-2 right-2 flex flex-col gap-2 items-end">
            <span className="px-2 py-0.5 bg-green-700/90 text-white text-[10px] rounded-sm">
              {tipoVendaLabel}
            </span>

            {podeFavoritar && (
              <button
                type="button"
                disabled={aCarregarFavorito}
                onClick={alternarFavorito}
                className="bg-white/90 hover:bg-white p-1.5 rounded-full shadow-sm"
              >
                <Heart
                  size={18}
                  fill={favoritado ? 'currentColor' : 'none'}
                  className={
                    favoritado
                      ? 'text-red-500'
                      : 'text-gray-700'
                  }
                />
              </button>
              
            )}
          </div>

          {mostrarDataContacto &&
            (produto as any).data_contacto && (
              <span className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/70 text-white text-[10px]">
                {formatarTempoRelativo(
                  produto.data_contacto
                )}
              </span>
          )}
        </div>

        <div className="p-3">
          <h3 className="font-titulo text-sm font-semibold leading-tight">
            {produto?.nome_produto || 'Produto'}
          </h3>

          {emDesconto ? (
            <div className="mt-1.5">
              <p className="font-bold text-destructive">
                {formatarPreco(produto?.preco_promocional)} Kz
                <span className="text-xs text-muted-foreground ml-1">
                  / {produto?.unidade || '-'}
                </span>
              </p>
              <p className="text-xs text-muted-foreground line-through">
                {formatarPreco(produto?.preco_aproximado)} Kz
              </p>
            </div>
          ) : mostrarDuploPreco ? (
            <div className="mt-1.5">
              <p className="font-bold text-green-700">
                {tipoComprador === 'negocio'
                  ? formatarPreco(produto?.preco_grosso)
                  : formatarPreco(produto?.preco_aproximado)}{' '}
                Kz
                <span className="text-xs text-muted-foreground ml-1">
                  / {produto?.unidade || '-'}
                </span>
              </p>
            </div>
          ) : (
            <p className="mt-1 font-bold text-green-700">
              {formatarPreco(produto?.preco_aproximado)} Kz
              <span className="text-xs text-muted-foreground ml-1">
                / {produto?.unidade || '-'}
              </span>
            </p>
          )}

          <p className="text-xs text-muted-foreground mt-1">
            {produto?.municipio || ''}
          </p>
          <div className="flex items-center justify-between mt-3 text-xs text-gray-500">

            <div className="flex items-center gap-1">

              <Eye size={14} />

              {produto.visualizacoes || 0}

            </div>

            <div className="flex items-center gap-1">

              <MessageCircle size={14} />

              {produto.cliques_whatsapp || 0}

            </div>

          </div>
        </div>
      </Link>

      {/* FOOTER */}
      <div className="px-3 pb-3 space-y-2 mt-auto">
        {mostrarVendedor && vendedor && (
          <Link
            to={`/vendedor/${vendedor.id}`}
            className="text-xs hover:text-primary flex items-center gap-1 min-w-0"
          >
            <span className="truncate">
              {vendedor.nome_comercial}
            </span>

            <SeloVendedor vendedor={vendedor} compacto />
          </Link>
        )}

        {mostrarWhatsapp && vendedor && (
          <a
            href={linkWhatsApp}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              const admin = utilizador?.papel === 'admin';

              if (vendedorDono || admin) return;

              if (produto.id?.includes('-')) {
                incrementarCliqueWhatsappProduto(produto.id);
              }

              if (utilizador?.id && utilizador?.papel === 'cliente') {
                guardarHistoricoContacto({
                  cliente_id: utilizador.id,
                  produto,
                });
              } else {
                const historicoLocal = JSON.parse(
                  localStorage.getItem('historico') || '[]'
                );

                historicoLocal.push({
                  produto_id: produto.id,
                  nome_produto: produto.nome_produto,
                  nome_vendedor: vendedor.nome_comercial,
                  telefone: vendedor.telefone_whatsapp,
                  data: new Date().toISOString(),
                });

                localStorage.setItem(
                  'historico',
                  JSON.stringify(historicoLocal)
                );
              }
            }}
            className="btn-whatsapp w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs"
          >
            Contactar  <MessageCircle size={15} />
          </a>
        )}
      </div>
    </div>
  );
}