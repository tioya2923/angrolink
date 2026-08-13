/**
 * Vendedor — Dashboard resumo
 * Mostra métricas reais de produtos e serviços.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Package,
  Eye,
  MessageSquare,
  Star,
  UserCircle,
  Wrench,
  BarChart3,
} from 'lucide-react';

import { Link } from "react-router-dom";

import { useAuth } from '@/contextos/AuthContexto';
import { useAtualizacaoTempoReal } from '@/hooks/useAtualizacaoTempoReal';
import { Produto, Servico } from '@/tipos';
import CardResumoAnuncio from '@/componentes/CardResumoAnuncio';
import CardStat from "@/componentes/CardStat";

import {
  fetchProdutosPorVendedor,
  fetchServicosPorVendedor,
} from '@/services/api';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export default function VendedorResumo() {
  const { utilizador } = useAuth();
  const estadoConta = utilizador?.status_aprovacao || 'pendente';
  const vendedorAprovado = estadoConta === 'aprovado';
  const estadoContaTexto =
    estadoConta === 'aprovado'
      ? 'Conta aprovada'
      : estadoConta === 'suspenso'
        ? 'Conta suspensa'
        : estadoConta === 'rejeitado'
          ? 'Conta rejeitada'
          : 'Conta em análise';
  const estadoContaClasse =
    estadoConta === 'aprovado'
      ? 'bg-green-100 text-green-700'
      : estadoConta === 'suspenso' || estadoConta === 'rejeitado'
        ? 'bg-red-100 text-red-700'
        : 'bg-yellow-100 text-yellow-800';

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [versaoTempoReal, setVersaoTempoReal] = useState(0);

  useAtualizacaoTempoReal(
    ['vendedores', 'produtos', 'servicos', 'historico_contactos', 'historico_contactos_servicos'],
    () => setVersaoTempoReal(v => v + 1),
  );

  useEffect(() => {
    async function carregarDados() {
      if (!utilizador?.vendedor_id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const [produtosData, servicosData] = await Promise.all([
          fetchProdutosPorVendedor(utilizador.vendedor_id),
          fetchServicosPorVendedor(utilizador.vendedor_id),
        ]);

        setProdutos(Array.isArray(produtosData) ? produtosData : []);
        setServicos(Array.isArray(servicosData) ? servicosData : []);
      } catch (err) {
        console.error('Erro ao carregar resumo do vendedor:', err);
        setProdutos([]);
        setServicos([]);
      } finally {
        setLoading(false);
      }
    }

    carregarDados();
  }, [utilizador?.vendedor_id, versaoTempoReal]);

  const stats = useMemo(() => {
    const itens = [...produtos, ...servicos];

    const produtosAtivos = produtos.filter(p => p.disponivel !== false).length;
    const servicosAtivos = servicos.filter(s => s.disponivel !== false).length;

    const visualizacoes = itens.reduce(
      (total, item: any) => total + Number(item.visualizacoes || 0),
      0
    );

    const contactos = itens.reduce(
      (total, item: any) => total + Number(item.cliques_whatsapp || 0),
      0
    );

    const destacados =
      produtos.filter(p => p.destaque).length +
      servicos.filter(s => s.destaque).length;

    return {
      produtosAtivos,
      totalProdutos: produtos.length,
      servicosAtivos,
      totalServicos: servicos.length,
      anunciosAtivos: produtosAtivos + servicosAtivos,
      visualizacoes,
      contactos,
      destacados,
    };
  }, [produtos, servicos]);

  const anunciosRecentes = useMemo(() => {
    return [...produtos, ...servicos]
      .sort((a: any, b: any) => {
        return (
          new Date(
            b.atualizado_em ||
            b.created_at ||
            b.criado_em ||
            0
          ).getTime() -
          new Date(
            a.atualizado_em ||
            a.created_at ||
            a.criado_em ||
            0
          ).getTime()
        );
      })
      .slice(0, 5);
  }, [produtos, servicos]);

  const atividades = [
    {
      cor: "bg-green-600",
      titulo:
        stats.anunciosAtivos > 0
          ? `${stats.anunciosAtivos} anúncio${stats.anunciosAtivos > 1 ? "s" : ""} publicado${stats.anunciosAtivos > 1 ? "s" : ""}`
          : "Ainda não existem anúncios publicados",
      descricao:
        stats.anunciosAtivos > 0
          ? "Os seus anúncios estão visíveis para os compradores."
          : 'Clique em "Adicionar Produto" ou "Adicionar Serviço" para começar.',
    },

    {
      cor: "bg-blue-600",
      titulo:
        stats.contactos > 0
          ? `${stats.contactos} contacto${stats.contactos > 1 ? "s" : ""} recebido${stats.contactos > 1 ? "s" : ""}`
          : "Nenhum contacto recebido",
      descricao:
        stats.contactos > 0
          ? "Os compradores já entraram em contacto consigo."
          : "Assim que um comprador entrar em contacto, aparecerá aqui.",
    },

    {
      cor: "bg-purple-600",
      titulo:
        stats.visualizacoes > 0
          ? `${stats.visualizacoes} visualizaç${stats.visualizacoes > 1 ? "ões" : "ão"}`
          : "Sem visualizações",
      descricao:
        stats.visualizacoes > 0
          ? "Os seus anúncios estão a receber visitas."
          : "As visualizações aparecerão quando os anúncios forem visitados.",
    },

    {
      cor: "bg-yellow-500",
      titulo:
        stats.destacados > 0
          ? `${stats.destacados} anúncio${stats.destacados > 1 ? "s" : ""} destacado${stats.destacados > 1 ? "s" : ""}`
          : "Nenhum anúncio destacado",
      descricao:
        stats.destacados > 0
          ? "Os anúncios destacados recebem maior visibilidade."
          : "Pode destacar anúncios futuramente para aumentar a visibilidade.",
    },
  ];

  if (loading) {
    return (
      <p className="font-corpo text-sm text-muted-foreground">
        A carregar dashboard...
      </p>
    );
  }

  if (!utilizador?.vendedor_id) {
    return (
      <p className="font-corpo text-sm text-muted-foreground">
        Esta conta ainda não está ligada a um vendedor.
      </p>
    );
  }

  console.log("ANUNCIOS:", anunciosRecentes);

  return (
    <div className="space-y-6">
      <Card>

        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

            <div>

              <span className="text-sm text-muted-foreground">
                Dashboard do vendedor
              </span>

              <h1 className="mt-2 text-3xl font-bold font-titulo">
                Olá, {utilizador?.nome} 👋
              </h1>

              <p className="mt-2 text-muted-foreground">
                Acompanhe o desempenho dos seus anúncios,
                publique novos produtos e faça crescer o seu negócio.
              </p>

              <div className="flex flex-wrap gap-2 mt-4">

                <span className={`rounded-full px-3 py-1 text-sm font-medium ${estadoContaClasse}`}>
                  {estadoConta === 'aprovado' ? '✓ ' : ''}{estadoContaTexto}
                </span>

                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700 font-medium">
                  Plano {(utilizador?.plano || 'gratuito').replace(/^./, letra => letra.toUpperCase())}
                </span>

              </div>

            </div>

            <div className="grid grid-cols-2 gap-3">

              {vendedorAprovado ? (
                <Link to="/dashboard/produtos/novo" className="rounded-lg bg-green-700 px-4 py-3 text-center text-white transition hover:bg-green-800">+ Produto</Link>
              ) : (
                <span className="cursor-not-allowed rounded-lg bg-muted px-4 py-3 text-center text-muted-foreground">+ Produto indisponível</span>
              )}

              {vendedorAprovado ? (
                <Link to="/dashboard/servicos/novo" className="rounded-lg bg-green-700 px-4 py-3 text-center text-white transition hover:bg-green-800">+ Serviço</Link>
              ) : (
                <span className="cursor-not-allowed rounded-lg bg-muted px-4 py-3 text-center text-muted-foreground">+ Serviço indisponível</span>
              )}

              <button
                className="rounded-lg border px-4 py-3 hover:bg-gray-50 transition"
              >
                <Link to="/dashboard/perfil" className="text-center">
                  Meu Perfil
                </Link>
              </button>

              <button
                className="rounded-lg border px-4 py-3 hover:bg-gray-50 transition"
              >
                <Link to={`/vendedor/${utilizador.vendedor_id}`} className="text-center">
                  Ver Loja
                </Link>
              </button>

            </div>

          </div>
        </CardContent>
      </Card>

      {estadoConta === 'rejeitado' && (
        <section className="rounded-2xl border-2 border-destructive/35 bg-destructive/5 p-5">
          <h2 className="font-titulo text-lg font-bold">Cadastro rejeitado</h2>
          <p className="mt-1 font-corpo text-sm text-muted-foreground">A sua conta continua acessível para corrigir a candidatura, mas as funções comerciais permanecem bloqueadas até nova decisão.</p>
          {utilizador.motivo_rejeicao && <p className="mt-3 font-corpo text-sm"><strong>Motivo:</strong> {utilizador.motivo_rejeicao}</p>}
          <Link to="/dashboard/documentos" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 font-corpo text-sm font-semibold text-primary-foreground">Ver documentos e corrigir</Link>
        </section>
      )}

      {/* Estado da conta / resumo de atividade */}
      <div className={`border-2 p-4 rounded-md ${vendedorAprovado ? 'border-green-700 bg-green-50' : estadoConta === 'suspenso' ? 'border-red-300 bg-red-50' : 'border-yellow-400 bg-yellow-50'}`}>
        <p className={`font-corpo text-sm ${vendedorAprovado ? 'text-green-900' : estadoConta === 'suspenso' ? 'text-red-900' : 'text-yellow-900'}`}>
          <UserCircle size={16} className="inline mr-1" />
          {vendedorAprovado
            ? <>Os teus anúncios já somam <strong>{stats.visualizacoes}</strong> visualizações e <strong>{stats.contactos}</strong> cliques no WhatsApp.</>
            : estadoConta === 'suspenso'
              ? <>A tua conta está suspensa. Podes consultar o painel, mas não podes criar nem editar anúncios. Os anúncios ficam ocultos até à reativação.</>
              : estadoConta === 'rejeitado'
                ? <>A tua conta foi rejeitada. Consulta o teu perfil para atualizar os dados necessários.</>
                : <>A tua conta está em análise. Poderás publicar e editar anúncios após a aprovação da equipa ANGROLINK.</>}
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <CardStat
          icone={Package}
          rotulo="Produtos Ativos"
          valor={stats.produtosAtivos}
        />

        <CardStat
          icone={Wrench}
          rotulo="Serviços Ativos"
          valor={stats.servicosAtivos}
        />

        <CardStat
          icone={BarChart3}
          rotulo="Anúncios Ativos"
          valor={stats.anunciosAtivos}
        />

        <CardStat
          icone={Eye}
          rotulo="Visualizações"
          valor={stats.visualizacoes}
        />

        <CardStat
          icone={MessageSquare}
          rotulo="Contactos"
          valor={stats.contactos}
        />

        <CardStat
          icone={Star}
          rotulo="Destacados"
          valor={stats.destacados}
        />
      </div>

      {/* ===========================
          ATIVIDADE RECENTE
      =========================== */}

      <Card>

        <CardHeader>

          <CardTitle>
            Atividade recente
          </CardTitle>

          <CardDescription>
            Acompanhe tudo o que aconteceu recentemente na sua conta.
          </CardDescription>

        </CardHeader>

        <CardContent>

          <div className="space-y-5">

            {atividades.map((atividade, index) => (

              <div
                key={index}
                className="flex items-start gap-3"
              >

                <div
                  className={`w-3 h-3 rounded-full mt-2 ${atividade.cor}`}
                />

                <div>

                  <p className="font-medium">
                    {atividade.titulo}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {atividade.descricao}
                  </p>

                </div>

              </div>

            ))}

          </div>

        </CardContent>

      </Card>

      {/* ============================
            MEUS ANÚNCIOS
      ============================= */}

      <Card>

        <CardHeader>

          <CardTitle>
            Os meus anúncios
          </CardTitle>

          <CardDescription>
            Os anúncios publicados mais recentemente.
          </CardDescription>

        </CardHeader>

        <CardContent>

          {anunciosRecentes.length === 0 ? (

            <div className="text-center py-10">

              <Package
                size={42}
                className="mx-auto text-green-700 mb-4"
              />

              <h3 className="font-semibold text-lg">

                Ainda não publicou nenhum anúncio

              </h3>

              <p className="text-sm text-muted-foreground mt-2">

                Adicione um produto ou serviço para começar.

              </p>

            </div>

          ) : (

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">

              {anunciosRecentes.map((item: any) => (

                <CardResumoAnuncio
                  key={item.id}

                  id={item.id}

                  titulo={
                    item.nome ||
                    item.titulo ||
                    item.nome_produto ||
                    item.nome_servico ||
                    "Sem título"
                  }

                  imagem={
                    item.imagem_url ||
                    item.imagem ||
                    null
                  }

                  tipo={
                      item.nome_produto
                          ? "produto"
                          : "servico"
                  }

                  preco={
                      item.preco_aproximado ??
                      item.preco ??
                      item.preco_servico ??
                      null
                  }

                  visualizacoes={
                    item.visualizacoes || 0
                  }

                  contactos={
                    item.cliques_whatsapp ||
                    item.contactos ||
                    0
                  }

                  estado={
                      item.status_aprovacao ??
                      item.estado ??
                      "aprovado"
                  }

                  data={
                    item.atualizado_em ||
                    item.created_at ||
                    item.criado_em
                  }

                  linkEditar={
                    item.nome_produto
                      ? `/dashboard/produtos/editar/${item.id}`
                      : `/dashboard/servicos/editar/${item.id}`
                  }

                  linkVisualizar={
                    item.nome_produto
                      ? `/produto/${item.id}`
                      : `/servico/${item.id}`
                  }

                />

              ))}

            </div>

          )}

        </CardContent>

      </Card>
    </div>
  );
}

