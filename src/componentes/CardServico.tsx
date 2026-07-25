/**
 * ========================================
 * CARD DE SERVIÇO
 * ========================================
 * Mostra serviços reais vindos do Supabase.
 */

import { Link } from 'react-router-dom';
import {
  MessageCircle,
  Heart,
  Eye,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import SeloVendedor from '@/componentes/SeloVendedor';
import { Servico } from '@/tipos';
import { gerarLinkWhatsApp } from '@/lib/whatsapp';
import { useAuth } from '@/contextos/AuthContexto';
import { formatarTempoRelativo }
  from '@/lib/datas';

import {
  incrementarCliqueWhatsappServico,
  guardarHistoricoContactoServico,
  adicionarFavoritoServico,
  removerFavoritoServico,
  servicoFavoritado,
} from '@/services/api';

interface CardServicoProps {
  servico: Servico;
  onFavoritoRemovido?: (id: string) => void;

  mostrarDataContacto?: boolean;
}

function formatarPreco(valor?: number | null): string {
  if (typeof valor !== 'number') {
    return 'Preço sob consulta';
  }

  return `${new Intl.NumberFormat('pt-AO', {
    style: 'decimal',
    minimumFractionDigits: 0,
  }).format(valor)} Kz`;
}

export default function CardServico({
  servico,
  onFavoritoRemovido,
  mostrarDataContacto = false,
}: CardServicoProps) {
  const { utilizador } = useAuth();

  const [favoritado, setFavoritado] =
    useState(false);

  const [aCarregarFavorito, setACarregarFavorito] =
    useState(false);

  const vendedor =
  (servico as any).vendedor || null;

  const vendedorDono =
    utilizador?.papel === 'vendedor' &&
    utilizador?.vendedor_id === servico.vendedor_id;

  const admin =
    utilizador?.papel === 'admin';

  const podeFavoritar =
    utilizador?.papel === 'cliente' ||
    (
      utilizador?.papel === 'vendedor' &&
      !vendedorDono
    );

  // =============================
  // FAVORITO
  // =============================

  useEffect(() => {
    async function verificarFavorito() {
      if (
        !servico?.id ||
        !utilizador?.id ||
        !podeFavoritar
      ) {
        return;
      }

      const existe =
        await servicoFavoritado(
          utilizador.id,
          servico.id
        );

      setFavoritado(existe);
    }

    verificarFavorito();
  }, [
    utilizador?.id,
    utilizador?.papel,
    servico?.id,
  ]);

  if (!servico) return null;

  // =============================
  // DADOS
  // =============================

  const nomeServico =
    servico.nome_servico || 'Serviço';

  const imagem =
    servico.imagem_url?.startsWith('http')
      ? servico.imagem_url
      : '/placeholder.png';

  const telefone =
    servico.telefone_whatsapp ||
    vendedor?.telefone_whatsapp ||
    vendedor?.whatsapp ||
    null;

  const nomePrestador =
    servico.nome_prestador ||
    vendedor?.nome_comercial ||
    'Prestador de serviço';

  const linkWhatsApp = telefone
    ? gerarLinkWhatsApp(
        telefone,
        nomeServico
      )
    : '#';

  // =============================
  // WHATSAPP
  // =============================

  const handleCliqueWhatsapp =
    async () => {
      if (vendedorDono) return;

      if (admin) return;

      if (servico.id?.includes('-')) {
        await incrementarCliqueWhatsappServico(
          servico.id
        );
      }

      if (
        utilizador?.id &&
        utilizador?.papel === 'cliente'
      ) {
        await guardarHistoricoContactoServico({
          cliente_id: utilizador.id,
          servico,
        });

        return;
      }

      const historicoLocal = JSON.parse(
        localStorage.getItem(
          'historico_servicos'
        ) || '[]'
      );

      historicoLocal.push({
        servico_id: servico.id,
        nome_servico: nomeServico,
        nome_prestador: nomePrestador,
        telefone,
        data: new Date().toISOString(),
        utilizador_id:
          utilizador?.id || null,
      });

      localStorage.setItem(
        'historico_servicos',
        JSON.stringify(historicoLocal)
      );
    };

  // =============================
  // FAVORITO
  // =============================

  async function alternarFavorito(
    e: React.MouseEvent
  ) {
    e.preventDefault();
    e.stopPropagation();

    if (!utilizador?.id) {
      return;
    }

    if (!utilizador?.id || !podeFavoritar) {
      return;
    }

    try {
      setACarregarFavorito(true);

      if (favoritado) {
        await removerFavoritoServico(
          utilizador.id,
          servico.id
        );

        setFavoritado(false);

        onFavoritoRemovido?.(
          servico.id
        );
      } else {
        await adicionarFavoritoServico(
          utilizador.id,
          servico.id
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
    <div className="card-produto overflow-hidden">
      <Link
        to={`/servico/${servico.id}`}
        className="block"
      >
        <div className="aspect-square overflow-hidden relative">
          <img
            src={imagem}
            alt={nomeServico}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src =
                '/placeholder.png';
            }}
          />

          <div className="absolute top-2 right-2 flex flex-col gap-2 items-end">
            <span className="px-2 py-0.5 bg-green-700 text-white text-[10px] rounded-sm">
              Serviço
            </span>

            {podeFavoritar && (
              <button
                type="button"
                disabled={
                  aCarregarFavorito
                }
                onClick={
                  alternarFavorito
                }
                className="bg-white/90 hover:bg-white p-1.5 rounded-full shadow-sm"
              >
                <Heart
                  size={18}
                  fill={
                    favoritado
                      ? 'currentColor'
                      : 'none'
                  }
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
            (servico as any).data_contacto && (
              <span className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/70 text-white text-[10px]">
                {formatarTempoRelativo(
                  (servico as any).data_contacto
                )}
              </span>
          )}
        </div>

        <div className="p-3">
          <h3 className="font-titulo text-sm font-semibold leading-tight">
            {nomeServico}
          </h3>

          <p className="mt-1 font-bold text-primary">
            {formatarPreco(
              servico.preco_estimado
            )}
          </p>

          <p className="text-xs text-muted-foreground mt-1">
            {servico.tipo_servico ||
              'Serviço geral'}
          </p>

          <p className="text-xs text-muted-foreground mt-1">
            {servico.municipio || ''}
            {servico.municipio &&
            servico.provincia
              ? ', '
              : ''}
            {servico.provincia || ''}
          </p>

          <div className="flex items-center justify-between mt-3 text-xs text-gray-500">

            <div className="flex items-center gap-1">

              <Eye size={14} />

              {servico.visualizacoes || 0}

            </div>

            <div className="flex items-center gap-1">

              <MessageCircle size={14} />

              {servico.cliques_whatsapp || 0}

            </div>

          </div>
        </div>
      </Link>

      <div className="px-3 pb-3 space-y-2">
        {vendedor ? (
          <Link
            to={`/vendedor/${vendedor.id}`}
            className="text-xs hover:text-primary flex items-center gap-1 min-w-0"
          >
            <span className="truncate">
              {nomePrestador}
            </span>

            <SeloVendedor
              vendedor={vendedor}
              compacto
            />
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground truncate block">
            {nomePrestador}
          </span>
        )}

        {telefone && (
          <a
            href={linkWhatsApp}
            target="_blank"
            rel="noopener noreferrer"
            onClick={
              handleCliqueWhatsapp
            }
            className="btn-whatsapp w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs"
          >
            Contactar
            <MessageCircle size={15} />
          </a>
        )}
      </div>
    </div>
  );
}