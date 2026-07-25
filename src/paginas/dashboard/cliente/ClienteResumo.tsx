/**
 * Cliente — Menu
 * Resumo real baseado em visualizações e contactos.
 */

import { useEffect, useState } from 'react';
import { Eye, Phone, Wrench } from 'lucide-react';

import { useAuth } from '@/contextos/AuthContexto';
import { supabase } from '@/services/supabase';

export default function ClienteResumo() {
  const { utilizador } = useAuth();

  const [stats, setStats] = useState({
    produtosVisualizados: 0,
    servicosVisualizados: 0,
    contactosFeitos: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregarStats() {
      if (!utilizador?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const { data: visualizacoesProdutos, error: erroProdutos } =
          await supabase
            .from('visualizacoes_produtos')
            .select('produto_id')
            .eq('cliente_id', utilizador.id);

        if (erroProdutos) {
          console.error('Erro ao carregar visualizações de produtos:', erroProdutos);
        }

        const { data: visualizacoesServicos, error: erroServicos } =
          await supabase
            .from('visualizacoes_servicos')
            .select('servico_id')
            .eq('cliente_id', utilizador.id);

        if (erroServicos) {
          console.error('Erro ao carregar visualizações de serviços:', erroServicos);
        }

        // =============================
        // CONTACTOS — PRODUTOS
        // =============================
        const { data: contactosProdutos, error: erroContactosProdutos } =
          await supabase
            .from('historico_contactos')
            .select('id')
            .eq('cliente_id', utilizador.id);

        if (erroContactosProdutos) {
          console.error(
            'Erro ao carregar contactos de produtos:',
            erroContactosProdutos
          );
        }

        // =============================
        // CONTACTOS — SERVIÇOS
        // =============================
        const { data: contactosServicos, error: erroContactosServicos } =
          await supabase
            .from('historico_contactos_servicos')
            .select('id')
            .eq('cliente_id', utilizador.id);

        if (erroContactosServicos) {
          console.error(
            'Erro ao carregar contactos de serviços:',
            erroContactosServicos
          );
        }

        const produtosVisualizadosUnicos = new Set(
          (visualizacoesProdutos || []).map(v => v.produto_id).filter(Boolean)
        ).size;

        const servicosVisualizadosUnicos = new Set(
          (visualizacoesServicos || []).map(v => v.servico_id).filter(Boolean)
        ).size;

        setStats({
          produtosVisualizados: produtosVisualizadosUnicos,
          servicosVisualizados: servicosVisualizadosUnicos,
          contactosFeitos:
            (contactosProdutos?.length || 0) +
            (contactosServicos?.length || 0), 
        });
      } catch (err) {
        console.error('Erro inesperado ao carregar menu:', err);
      } finally {
        setLoading(false);
      }
    }

    carregarStats();
  }, [utilizador?.id]);

  if (loading) {
    return (
      <p className="font-corpo text-sm text-muted-foreground">
        A carregar menu...
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-titulo text-2xl font-bold">
          Menu
        </h1>

        <p className="font-corpo text-sm text-muted-foreground mt-1">
          Bem-vindo, {utilizador?.nome || 'cliente'}. Aqui pode acompanhar a sua atividade na ANGROLINK.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <CardStat
          icone={Eye}
          rotulo="Produtos visualizados"
          valor={stats.produtosVisualizados}
        />

        <CardStat
          icone={Wrench}
          rotulo="Serviços visualizados"
          valor={stats.servicosVisualizados}
        />

        <CardStat
          icone={Phone}
          rotulo="Contactos feitos"
          valor={stats.contactosFeitos}
        />
      </div>
    </div>
  );
}

function CardStat({
  icone: Icone,
  rotulo,
  valor,
}: {
  icone: React.ComponentType<any>;
  rotulo: string;
  valor: number;
}) {
  return (
    <div className="border-2 border-border p-4">
      <Icone size={20} className="text-green-700 mb-2" />
      <p className="font-titulo text-2xl">{valor}</p>
      <p className="font-corpo text-xs text-muted-foreground">
        {rotulo}
      </p>
    </div>
  );
}