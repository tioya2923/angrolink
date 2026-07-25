/**
 * Cliente — Recomendações inteligentes
 * Prioridade:
 * 1. Produtos parecidos com os produtos contactados
 * 2. Produtos perto do cliente
 * 3. Produtos recentes disponíveis
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, MessageSquare, Eye } from 'lucide-react';

import { useAuth } from '@/contextos/AuthContexto';
import { supabase } from '@/services/supabase';
import {
  guardarHistoricoContacto,
  incrementarCliqueWhatsappProduto,
} from '@/services/api';
import { Produto } from '@/tipos';

type ProdutoRecomendado = Produto & {
  vendedor?: {
    id: string;
    nome_comercial?: string | null;
    telefone_whatsapp?: string | null;
    whatsapp?: string | null;
    verificado?: boolean | null;
  } | null;
};

function normalizarProdutoRecomendado(p: any): ProdutoRecomendado {
  return {
    ...p,
    vendedor: p.vendedor || null,
    imagem_url: p.imagem_url || null,
    imagem_principal: p.imagem_url || p.imagem_principal || '/placeholder.png',
    disponivel: p.disponivel === true || p.disponivel === 'true',
    destaque: p.destaque === true || p.destaque === 'true',
  } as ProdutoRecomendado;
}

function gerarLinkWhatsApp(numero?: string | null, produto?: string) {
  if (!numero) return '#';

  const numeroLimpo = numero.replace(/\D/g, '');
  const mensagem = encodeURIComponent(
    `Olá! Vi o produto "${produto}" na ANGROLINK e gostaria de saber mais detalhes.`
  );

  return `https://wa.me/${numeroLimpo}?text=${mensagem}`;
}

export default function ClienteRecomendacoes() {
  const { utilizador } = useAuth();

  const [recomendados, setRecomendados] = useState<ProdutoRecomendado[]>([]);
  const [loading, setLoading] = useState(true);
  const [motivo, setMotivo] = useState('Produtos recomendados para si');

  useEffect(() => {
    async function carregarRecomendacoes() {
      try {
        setLoading(true);

        let produtosContactadosIds: string[] = [];
        let categoriasContactadas: string[] = [];
        let subcategoriasContactadas: string[] = [];

        // =============================
        // 1. HISTÓRICO DO CLIENTE
        // =============================
        if (utilizador?.id) {
          const { data: historico, error: erroHistorico } = await supabase
            .from('historico_contactos')
            .select(`
              produto_id,
              produto:produtos!historico_contactos_produto_id_fkey (
                id,
                categoria_id,
                subcategoria
              )
            `)
            .eq('cliente_id', utilizador.id)
            .order('criado_em', { ascending: false })
            .limit(20);

          if (erroHistorico) {
            console.error('Erro ao carregar histórico:', erroHistorico);
          }

          produtosContactadosIds =
            historico?.map((h: any) => h.produto_id).filter(Boolean) || [];

          categoriasContactadas =
            historico
              ?.map((h: any) => h.produto?.categoria_id)
              .filter(Boolean) || [];

          subcategoriasContactadas =
            historico
              ?.map((h: any) => h.produto?.subcategoria)
              .filter(Boolean) || [];
        }

        let produtos: ProdutoRecomendado[] = [];

        // =============================
        // 2. RECOMENDAÇÃO POR INTERESSE
        // =============================
        if (
          categoriasContactadas.length > 0 ||
          subcategoriasContactadas.length > 0
        ) {
          let query = supabase
            .from('produtos')
            .select(`
              *,
              vendedor:vendedores (
                id,
                nome_comercial,
                telefone_whatsapp,
                whatsapp,
                verificado
              )
            `)
            .eq('disponivel', true)
            .order('destaque', { ascending: false })
            .order('criado_em', { ascending: false })
            .limit(12);

          if (categoriasContactadas.length > 0) {
            query = query.in('categoria_id', [...new Set(categoriasContactadas)]);
          }

          const { data, error } = await query;

          if (error) {
            console.error('Erro ao carregar recomendações por interesse:', error);
          }

          produtos = (data || []).map(normalizarProdutoRecomendado);

          produtos = produtos.filter(
            p => !produtosContactadosIds.includes(p.id)
          );

          if (produtos.length > 0) {
            setMotivo('Produtos parecidos com os que contactou');
            setRecomendados(produtos);
            return;
          }
        }

        // =============================
        // 3. RECOMENDAÇÃO POR LOCALIZAÇÃO
        // =============================
        let queryLocal = supabase
          .from('produtos')
          .select(`
            *,
            vendedor:vendedores (
              id,
              nome_comercial,
              telefone_whatsapp,
              whatsapp,
              verificado
            )
          `)
          .eq('disponivel', true)
          .order('destaque', { ascending: false })
          .order('criado_em', { ascending: false })
          .limit(12);

        if (utilizador?.municipio && utilizador?.provincia) {
          queryLocal = queryLocal.or(
            `municipio.eq.${utilizador.municipio},provincia.eq.${utilizador.provincia}`
          );
        } else if (utilizador?.provincia) {
          queryLocal = queryLocal.eq('provincia', utilizador.provincia);
        }

        const { data: locais, error: erroLocal } = await queryLocal;

        if (erroLocal) {
          console.error('Erro ao carregar recomendações locais:', erroLocal);
        }

        produtos = (locais || [])
          .map(normalizarProdutoRecomendado)
          .filter(p => !produtosContactadosIds.includes(p.id));

        if (produtos.length > 0) {
          setMotivo('Produtos perto de si');
          setRecomendados(produtos);
          return;
        }

        // =============================
        // 4. FALLBACK — PRODUTOS RECENTES
        // =============================
        const { data: recentes, error: erroRecentes } = await supabase
          .from('produtos')
          .select(`
            *,
            vendedor:vendedores (
              id,
              nome_comercial,
              telefone_whatsapp,
              whatsapp,
              verificado
            )
          `)
          .eq('disponivel', true)
          .order('criado_em', { ascending: false })
          .limit(12);

        if (erroRecentes) {
          console.error('Erro ao carregar produtos recentes:', erroRecentes);
        }

        setMotivo('Produtos recentes no marketplace');
        setRecomendados((recentes || []).map(normalizarProdutoRecomendado));
      } catch (err) {
        console.error('Erro inesperado ao carregar recomendações:', err);
        setRecomendados([]);
      } finally {
        setLoading(false);
      }
    }

    carregarRecomendacoes();
  }, [utilizador?.id, utilizador?.municipio, utilizador?.provincia]);

  const handleContacto = (produto: ProdutoRecomendado) => {
    if (produto.id?.includes('-')) {
      incrementarCliqueWhatsappProduto(produto.id);
    }

    if (utilizador?.id) {
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
        nome_vendedor: produto.vendedor?.nome_comercial || 'Vendedor',
        telefone:
          produto.vendedor?.telefone_whatsapp ||
          produto.vendedor?.whatsapp ||
          '',
        data: new Date().toISOString(),
      });

      localStorage.setItem('historico', JSON.stringify(historicoLocal));
    }
  };

  if (loading) {
    return (
      <p className="font-corpo text-sm text-muted-foreground">
        A carregar recomendações...
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-titulo text-2xl font-bold">
          Recomendações
        </h1>

        <p className="font-corpo text-sm text-muted-foreground flex items-center gap-1 mt-1">
          <MapPin size={14} />
          {motivo}
          {utilizador?.municipio || utilizador?.provincia ? (
            <>
              {' — '}
              {utilizador?.municipio}
              {utilizador?.municipio && utilizador?.provincia ? ', ' : ''}
              {utilizador?.provincia}
            </>
          ) : (
            ' — complete a sua localização nas definições'
          )}
        </p>
      </div>

      {recomendados.length === 0 ? (
        <div className="border-2 border-dashed border-border p-6 text-center">
          <p className="font-corpo text-sm text-muted-foreground">
            Sem recomendações disponíveis de momento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {recomendados.map(produto => {
            const telefone =
              produto.vendedor?.telefone_whatsapp ||
              produto.vendedor?.whatsapp;

            return (
              <div
                key={produto.id}
                className="border-2 border-border overflow-hidden bg-card hover:border-green-700 transition-colors"
              >
                <Link to={`/produto/${produto.id}`}>
                  <div className="h-32 bg-muted flex items-center justify-center">
                    <img
                      src={
                        produto.imagem_url ||
                        produto.imagem_principal ||
                        '/placeholder.png'
                      }
                      alt={produto.nome_produto}
                      className="h-full w-full object-cover"
                      onError={e => {
                        e.currentTarget.src = '/placeholder.png';
                      }}
                    />
                  </div>
                </Link>

                <div className="p-3 space-y-2">
                  <div>
                    <Link
                      to={`/produto/${produto.id}`}
                      className="font-titulo text-sm hover:text-green-700 transition-colors"
                    >
                      {produto.nome_produto}
                    </Link>

                    <p className="font-corpo text-xs text-muted-foreground mt-1">
                      {Number(produto.preco_aproximado || 0).toLocaleString()} Kz/
                      {produto.unidade || 'unidade'}
                      {' · '}
                      {produto.municipio || 'Sem município'}
                    </p>
                  </div>

                  {produto.vendedor?.nome_comercial && (
                    <p className="font-corpo text-xs text-muted-foreground">
                      Vendedor: {produto.vendedor.nome_comercial}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Link
                      to={`/produto/${produto.id}`}
                      className="flex items-center gap-1 font-corpo text-xs text-muted-foreground hover:text-green-700 transition-colors"
                    >
                      <Eye size={14} />
                      Ver detalhes
                    </Link>

                    {telefone && (
                      <a
                        href={gerarLinkWhatsApp(telefone, produto.nome_produto)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleContacto(produto)}
                        className="flex items-center gap-1 font-corpo text-xs text-green-700 hover:underline"
                      >
                        <MessageSquare size={14} />
                        Contactar
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
