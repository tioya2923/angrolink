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
import { useEffect, useState } from "react";

import Cabecalho from "@/componentes/Cabecalho";
import Rodape from "@/componentes/Rodape";
import BarraPesquisa from "@/componentes/BarraPesquisa";
import ListaProdutos from "@/componentes/ListaProdutos";

import { useAuth } from "@/contextos/AuthContexto";
import { useMunicipio } from "@/contextos/MunicipioContexto";
import { fetchProdutos, fetchServicos } from "@/services/api";
import { Produto, Servico } from "@/tipos";
import ListaDestaques from "@/componentes/ListaDestaques";
import CarrosselProdutos from "@/componentes/CarrosselProdutos";
import FaixaConfianca from "@/componentes/FaixaConfianca";

export default function PaginaInicial() {
  const { municipioId, municipioNome } = useMunicipio();
  const { tipoComprador, utilizador  } = useAuth();

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [servicos, setServicos] = useState<Servico[]>([]);

  /**
   * ===============================
   * FETCH (SEM FILTRO 🔥)
   * ===============================
   */

  useEffect(() => {
    async function carregar() {
      try {
        setLoading(true);
        setErro(null);

        const [produtosData, servicosData] = await Promise.all([
          fetchProdutos(),
          fetchServicos()
        ]);
        console.log("PRODUTOS RECEBIDOS NA HOME:", produtosData);
        console.log("SERVICOS RECEBIDOS NA HOME:", servicosData);

        setProdutos(Array.isArray(produtosData) ? produtosData : []);
        setServicos(Array.isArray(servicosData) ? servicosData : []);
      } catch {
        setErro("Erro ao carregar produtos");
        setProdutos([]);
      } finally {
        setLoading(false);
      }
    }

    carregar();
  }, []);

  /**
   * ===============================
   * FILTRAR POR TIPO
   * ===============================
   */

  const produtosVisiveis = produtos.filter((p) => {
    if (tipoComprador === "casa") {
      return p.tipo_venda === "retalho" || p.tipo_venda === "ambos";
    }

    if (tipoComprador === "negocio") {
      return p.tipo_venda === "grosso" || p.tipo_venda === "ambos";
    }

    return true;
  });

  /**
   * ===============================
   * FILTRO POR MUNICÍPIO
   * ===============================
   */

  const produtosFiltrados = municipioId
    ? produtosVisiveis.filter(
        (p) =>
          p.municipio?.toLowerCase().trim() ===
          municipioNome?.toLowerCase().trim()
      )
    : produtosVisiveis;

  /**
   * ===============================
   * DESTAQUES
   * ===============================
   */

  const porDataDesc = (a: { criado_em?: string }, b: { criado_em?: string }) =>
    new Date(b.criado_em ?? 0).getTime() - new Date(a.criado_em ?? 0).getTime();

  const produtosDestaque = produtosVisiveis
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

  const baseRecentes = municipioId ? produtosFiltrados : produtosVisiveis;

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

  const produtosGrosso =
    tipoComprador === "casa"
      ? []
      : produtosFiltrados
          .filter(
            (p) =>
              !idsProdutosDestaque.has(p.id) &&
              p.disponivel &&
              (p.tipo_venda === "grosso" || p.tipo_venda === "ambos")
          )
          .slice(0, 4);

  const produtosRetalho =
    tipoComprador === "negocio"
      ? []
      : produtosFiltrados
          .filter(
            (p) =>
              !idsProdutosDestaque.has(p.id) &&
              p.disponivel &&
              (p.tipo_venda === "retalho" || p.tipo_venda === "ambos")
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

            {/* GROSSO */}
            {produtosGrosso.length > 0 && (
              <section className="py-6 md:py-8 border-b-2 border-border">
                <div className="container">
                  <h2 className="font-titulo text-lg md:text-xl mb-1">
                    📦 Comprar por Grosso
                  </h2>
                  <ListaProdutos produtos={produtosGrosso} />
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