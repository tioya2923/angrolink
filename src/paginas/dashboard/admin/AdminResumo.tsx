/**
 * Admin — Dashboard com métricas gerais
 * Dados reais vindos do Supabase.
 */

import { useEffect, useMemo, useState } from 'react';
import { useAtualizacaoTempoReal } from '@/hooks/useAtualizacaoTempoReal';
import { Users, Package, Star, ShieldCheck, MapPin } from 'lucide-react';

import {
  fetchVendedoresAdmin,
  fetchProdutosAdmin,
} from '@/services/api';
import { listarDisputasAdmin, listarEncomendasAdmin, type DisputaAdminResumo, type EncomendaAdminResumo } from '@/services/admin360';

import { Vendedor, Produto } from '@/tipos';

export default function AdminResumo() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [encomendas, setEncomendas] = useState<EncomendaAdminResumo[]>([]);
  const [disputas, setDisputas] = useState<DisputaAdminResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [versaoTempoReal, setVersaoTempoReal] = useState(0);

  useAtualizacaoTempoReal(
    ['clientes', 'vendedores', 'produtos', 'servicos', 'parceiros_entrega'],
    () => setVersaoTempoReal(v => v + 1),
  );

  useEffect(() => {
    async function carregarDados() {
      try {
        setLoading(true);
        setErro(null);

        const [vendedoresData, produtosData, encomendasData, disputasData] = await Promise.all([
          fetchVendedoresAdmin(),
          fetchProdutosAdmin(),
          listarEncomendasAdmin(),
          listarDisputasAdmin(),
        ]);

        setVendedores(vendedoresData || []);
        setProdutos(produtosData || []);
        setEncomendas(encomendasData);
        setDisputas(disputasData);
      } catch (err) {
        console.error('Erro ao carregar resumo admin:', err);
        setErro('Erro ao carregar dados do painel.');
      } finally {
        setLoading(false);
      }
    }

    carregarDados();
  }, [versaoTempoReal]);

  const metricas = useMemo(() => {
    const totalVendedores = vendedores.length;
    const totalProdutos = produtos.length;

    const produtosDestaque = produtos.filter(p => p.destaque).length;
    const vendedoresVerificados = vendedores.filter(v => v.verificado).length;

    const vendedoresPendentes = vendedores.filter(
      v => (v as any).status_aprovacao === 'pendente'
    ).length;

    const produtosDisponiveis = produtos.filter(p => p.disponivel).length;
    const disputasAbertas = disputas.filter(d => d.estado === 'aberta').length;
    const disputasEmAnalise = disputas.filter(d => d.estado === 'em_analise').length;
    const pagamentosPendentes = encomendas.filter(e => e.estado_pagamento === 'pendente').length;

    const porMunicipio = produtos.reduce<Record<string, number>>((acc, p) => {
      const municipio = p.municipio || 'Sem município';
      acc[municipio] = (acc[municipio] || 0) + 1;
      return acc;
    }, {});

    return {
      totalVendedores,
      totalProdutos,
      produtosDestaque,
      vendedoresVerificados,
      vendedoresPendentes,
      produtosDisponiveis,
      encomendas: encomendas.length,
      disputasAbertas,
      disputasEmAnalise,
      pagamentosPendentes,
      porMunicipio,
    };
  }, [vendedores, produtos, encomendas, disputas]);

  if (loading) {
    return (
      <p className="font-corpo text-sm text-muted-foreground">
        A carregar painel de administração...
      </p>
    );
  }

  if (erro) {
    return (
      <p className="font-corpo text-sm text-destructive">
        {erro}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header className="painel-dashboard-cabecalho">
        <h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">Painel de Administração</h1>
        <p className="relative z-10 mt-1 font-corpo text-sm text-primary-foreground/80">Visão geral da atividade e saúde do marketplace.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CardMetrica
          icone={Users}
          rotulo="Total Vendedores"
          valor={metricas.totalVendedores}
        />

        <CardMetrica
          icone={Package}
          rotulo="Total Produtos"
          valor={metricas.totalProdutos}
        />

        <CardMetrica
          icone={Star}
          rotulo="Em Destaque"
          valor={metricas.produtosDestaque}
        />

        <CardMetrica
          icone={ShieldCheck}
          rotulo="Verificados"
          valor={metricas.vendedoresVerificados}
        />
        <CardMetrica icone={Package} rotulo="Encomendas" valor={metricas.encomendas} />
        <CardMetrica icone={ShieldCheck} rotulo="Disputas abertas" valor={metricas.disputasAbertas} />
        <CardMetrica icone={ShieldCheck} rotulo="Em análise" valor={metricas.disputasEmAnalise} />
        <CardMetrica icone={Package} rotulo="Pagamentos pendentes" valor={metricas.pagamentosPendentes} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="painel-dashboard-form">
          <h3 className="font-titulo text-sm mb-3">
            Estado da plataforma
          </h3>

          <div className="space-y-2">
            <LinhaResumo
              rotulo="Vendedores pendentes"
              valor={metricas.vendedoresPendentes}
            />

            <LinhaResumo
              rotulo="Produtos disponíveis"
              valor={metricas.produtosDisponiveis}
            />

            <LinhaResumo
              rotulo="Produtos em destaque"
              valor={metricas.produtosDestaque}
            />
          </div>
        </div>

        <div className="painel-dashboard-form">
          <h3 className="font-titulo text-sm mb-3">
            Produtos por Município
          </h3>

          <div className="space-y-2">
            {Object.entries(metricas.porMunicipio).length === 0 ? (
              <p className="font-corpo text-sm text-muted-foreground">
                Ainda não há produtos registados.
              </p>
            ) : (
              Object.entries(metricas.porMunicipio)
                .sort((a, b) => b[1] - a[1])
                .map(([municipio, total]) => (
                  <div
                    key={municipio}
                    className="flex items-center justify-between"
                  >
                    <span className="font-corpo text-sm flex items-center gap-1">
                      <MapPin size={14} className="text-muted-foreground" />
                      {municipio}
                    </span>

                    <span className="font-titulo text-sm">
                      {total}
                    </span>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CardMetrica({
  icone: Icone,
  rotulo,
  valor,
}: {
  icone: React.ComponentType<any>;
  rotulo: string;
  valor: number;
}) {
  return (
    <div className="painel-dashboard-metrica">
      <Icone size={20} className="text-primary mb-2" />
      <p className="font-titulo text-2xl">{valor}</p>
      <p className="font-corpo text-xs text-muted-foreground">{rotulo}</p>
    </div>
  );
}

function LinhaResumo({
  rotulo,
  valor,
}: {
  rotulo: string;
  valor: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-corpo text-sm text-muted-foreground">
        {rotulo}
      </span>

      <span className="font-titulo text-sm">
        {valor}
      </span>
    </div>
  );
}
