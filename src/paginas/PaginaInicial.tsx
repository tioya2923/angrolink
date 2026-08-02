/**
 * ========================================
 * PÁGINA INICIAL
 * ========================================
 * - Busca TODOS os produtos (sem filtro)
 * - Destaques globais
 * - Filtros só aplicados quando utilizador escolhe
 */

import { Link } from "react-router-dom";
import { MessageCircle, Megaphone, Star, Wrench } from "lucide-react";

import Cabecalho from "@/componentes/Cabecalho";
import Rodape from "@/componentes/Rodape";
import BarraPesquisa from "@/componentes/BarraPesquisa";
import ListaProdutos from "@/componentes/ListaProdutos";

import { useAuth } from "@/contextos/AuthContexto";
import { useMunicipio } from "@/contextos/MunicipioContexto";
import { useProdutosQuery, useServicosQuery } from "@/hooks/useCatalogoQuery";
import ListaDestaques from "@/componentes/ListaDestaques";
import CarrosselProdutos from "@/componentes/CarrosselProdutos";
import FaixaConfianca from "@/componentes/FaixaConfianca";

export default function PaginaInicial() {
  const { municipioId, municipioNome } = useMunicipio();
  const { utilizador } = useAuth();

  const produtosQuery = useProdutosQuery();
  const servicosQuery = useServicosQuery();
  const produtos = produtosQuery.data ?? [];
  const servicos = servicosQuery.data ?? [];
  const loading = produtosQuery.isLoading || servicosQuery.isLoading;
  const erro = produtosQuery.isError || servicosQuery.isError
    ? 'Erro ao carregar o catálogo.'
    : null;

  /**
   * ===============================
   * FETCH (SEM FILTRO 🔥)
   * ===============================
   */


  /**
   * ===============================
   * FILTRO POR MUNICÍPIO
   * ===============================
   */

  const produtosFiltrados = municipioId
    ? produtos.filter(
        (p) =>
          p.municipio?.toLowerCase().trim() ===
          municipioNome?.toLowerCase().trim()
      )
    : produtos;

  /**
   * ===============================
   * DESTAQUES
   * ===============================
   */

  const porDataDesc = (a: { criado_em?: string }, b: { criado_em?: string }) =>
    new Date(b.criado_em ?? 0).getTime() - new Date(a.criado_em ?? 0).getTime();

  const produtosDestaque = produtos
    .filter((p) => {
      const destaqueValido =
        !(p as any).destaque_ate ||
        new Date((p as any).destaque_ate).getTime() > Date.now();

      return p.destaque && p.disponivel && destaqueValido;
    })
    .sort(porDataDesc)
    .slice(0, 30);

  const servicosDestaque = servicos
    .filter((s) => {
      const destaqueValido =
        !(s as any).destaque_ate ||
        new Date((s as any).destaque_ate).getTime() > Date.now();

      return s.destaque && s.disponivel && destaqueValido;
    })
    .sort(porDataDesc)
    .slice(0, 12);

  // Mistura produtos e serviços num único carrossel, dos mais recentes aos mais antigos.
  const destaquesAngrolink = [
    ...produtosDestaque.map((produto) => ({
      tipo: "produto" as const,
      item: produto,
    })),

    ...servicosDestaque.map((servico) => ({
      tipo: "servico" as const,
      item: servico,
    })),
  ]
    .sort((a, b) => porDataDesc(a.item, b.item))
    .slice(0, 20);

  /**
   * ===============================
   * RECENTES
   * ===============================
   */

  const baseRecentes = municipioId ? produtosFiltrados : produtos;

  const produtosRecentes = [...baseRecentes]
    .sort(
      (a, b) =>
        new Date(b.criado_em).getTime() -
        new Date(a.criado_em).getTime()
    )
    .slice(0, 8);

  /**
   * ===============================
   * SECÇÕES
   * ===============================
   */

  const idsProdutosDestaque = new Set(produtosDestaque.map(p => p.id));

  /**
   * ===============================
   * DESCONTOS
   * ===============================
   */

  const produtosDesconto = produtosFiltrados
    .filter(
      (p) =>
        !idsProdutosDestaque.has(p.id) &&
        p.disponivel &&
        typeof p.preco_promocional === "number" &&
        typeof p.preco_aproximado === "number" &&
        p.preco_promocional > 0 &&
        p.preco_promocional < p.preco_aproximado
    )
    .slice(0, 8);

  // Esta secção é sempre visível: apresenta oportunidades de compra em grosso
  // mesmo quando o visitante está a navegar como comprador para casa.
  const produtosBaseGrosso = municipioId ? produtos.filter(
    produto => produto.municipio?.toLowerCase().trim() === municipioNome?.toLowerCase().trim(),
  ) : produtos;

  const produtosGrosso = produtosBaseGrosso
    .filter(
      produto =>
        !idsProdutosDestaque.has(produto.id) &&
        produto.disponivel &&
        (produto.tipo_venda === "grosso" || produto.tipo_venda === "ambos"),
    )
    .sort(porDataDesc)
    .slice(0, 8);

  const produtosRetalho = produtosFiltrados
    .filter(
      produto =>
        !idsProdutosDestaque.has(produto.id) &&
        produto.disponivel &&
        (produto.tipo_venda === "retalho" || produto.tipo_venda === "ambos"),
    )
    .slice(0, 4);

  return (
    <div className="min-h-screen flex flex-col">
      <Cabecalho />

      <main className="flex-1">

        {/* HERO — barra de separadores + pesquisa grande, ao estilo Alibaba */}
        <section className="border-b-2 border-border bg-green-700 py-4 md:py-5">
          <div className="container space-y-2.5 md:space-y-3">

            {/* PESQUISA GRANDE */}
            <BarraPesquisa grande />

            {/* BEM-VINDO + LIGAÇÕES RÁPIDAS */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1.5 border-t border-white/20">
              <p className="font-titulo text-xs md:text-sm text-white">
                Bem-vindo à ANGROLINK
              </p>

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-corpo text-xs text-white/90">
                {!utilizador && (
                  <>
                    <Link to="/anunciar" className="flex items-center gap-1 hover:text-secondary transition-colors">
                      <Megaphone size={13} /> Anuncie grátis
                    </Link>
                    <span className="text-white/30">|</span>
                  </>
                )}
                <a href="#destaques" className="flex items-center gap-1 hover:text-secondary transition-colors">
                  <Star size={13} /> Produtos em destaque
                </a>
                <span className="text-white/30">|</span>
                <Link to="/servicos" className="flex items-center gap-1 hover:text-secondary transition-colors">
                  <Wrench size={13} /> Serviços disponíveis
                </Link>
              </div>
            </div>

            {/* SELOS DE CONFIANÇA */}
            <FaixaConfianca />

          </div>
        </section>

        {/* LOADING / ERRO */}
        {loading && (
          <div className="container py-6">
            <p>A carregar produtos...</p>
          </div>
        )}

        {erro && (
          <div className="container py-6">
            <p>{erro}</p>
          </div>
        )}

        {!loading && !erro && (
          <>
            {/* DESTAQUES */}
            {destaquesAngrolink.length > 0 && (
              <section id="destaques" className="secao-destaque py-6 md:py-8 border-y-2 border-border scroll-mt-16">
                <div className="container">
                  <ListaDestaques destaques={destaquesAngrolink} />
                </div>
              </section>
            )}

            {/* DESCONTOS */}
            {produtosDesconto.length > 0 && (
              <section className="py-6 md:py-8 border-b-2 border-border">
                <div className="container">
                  <CarrosselProdutos
                    produtos={produtosDesconto}
                    titulo="🔥 Produtos com Desconto"
                  />
                </div>
              </section>
            )}

            {/* RETALHO */}
            {produtosRetalho.length > 0 && (
              <section className="py-6 md:py-8 border-b-2 border-border">
                <div className="container">
                  <h2 className="font-titulo text-lg md:text-xl mb-1">
                    🛒 Comprar por Retalho
                  </h2>
                  <ListaProdutos produtos={produtosRetalho} />
                </div>
              </section>
            )}

            {/* COMPRAR POR GROSSO */}
            {produtosGrosso.length > 0 && (
              <section className="py-6 md:py-8 border-b-2 border-border">
                <div className="container">
                  <ListaProdutos
                    produtos={produtosGrosso}
                    titulo="📦 Comprar por Grosso"
                  />
                </div>
              </section>
            )}

            {/* RECENTES */}
            <section className="py-6 md:py-8">
              <div className="container">
                <ListaProdutos
                  produtos={produtosRecentes}
                  titulo="Novos Produtos"
                />
              </div>
            </section>
          </>
        )}

      </main>

      {/* BOTÃO */}
      {!utilizador && (
        <Link
          to="/anunciar"
          className="fixed bottom-4 right-4 z-40 btn-whatsapp flex items-center gap-2 font-titulo text-sm px-5 py-3 border-2 border-foreground"
        >
          <MessageCircle size={18} />
          Quero Anunciar
        </Link>
      )}

      <Rodape />
    </div>
  );
}
