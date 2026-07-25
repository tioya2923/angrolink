/**
 * Admin — Pedidos de Vendedores
 * Página de triagem: aprovar, rejeitar ou reabrir análise.
 * Suspender, bloquear e eliminar devem ficar na Gestão de Vendedores.
 */

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, MapPin, Calendar, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { obterRotuloCompletoVendedor } from '@/dados/constantes';
import { StatusVendedorAprovacao } from '@/tipos';

import {
  fetchVendedoresAdmin,
  atualizarEstadoVendedor,
} from '@/services/api';

interface PedidoVendedor {
  id: string;
  nome_comercial: string;
  nome_responsavel: string;
  tipo_vendedor: string;
  provincia: string;
  municipio: string;
  mercado_bairro: string;
  telefone: string;
  email: string;
  descricao: string;
  data_registo: string;
  estado: StatusVendedorAprovacao;
  ano_inicio?: string;
  entrega_disponivel?: boolean;
}

export default function AdminPedidosVendedores() {
  const { toast } = useToast();

  const [pedidos, setPedidos] = useState<PedidoVendedor[]>([]);
  const [detalheAberto, setDetalheAberto] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] =
    useState<StatusVendedorAprovacao | 'todos'>('pendente');

  useEffect(() => {
    async function carregar() {
      const data = await fetchVendedoresAdmin();

      const normalizados: PedidoVendedor[] = (data || []).map((v: any) => ({
        id: v.id,
        nome_comercial: v.nome_comercial,
        nome_responsavel: v.nome_responsavel,
        tipo_vendedor: v.tipo_vendedor,
        provincia: v.provincia,
        municipio: v.municipio,
        mercado_bairro: v.mercado_bairro,
        telefone: v.telefone_whatsapp || v.whatsapp || '',
        email: v.email,
        descricao: v.descricao,
        data_registo: v.criado_em,
        estado: v.status_aprovacao || 'pendente',
        ano_inicio: v.ano_inicio,
        entrega_disponivel: v.entrega_disponivel,
      }));

      setPedidos(normalizados);
    }

    carregar();
  }, []);

  const alterarEstado = async (id: string, estado: StatusVendedorAprovacao) => {
    try {
      await atualizarEstadoVendedor(id, estado);

      setPedidos(prev =>
        prev.map(p => (p.id === id ? { ...p, estado } : p))
      );

      const msgs: Record<StatusVendedorAprovacao, { title: string; desc: string }> = {
        aprovado: {
          title: 'Vendedor aprovado!',
          desc: 'O vendedor pode agora publicar produtos e serviços.',
        },
        rejeitado: {
          title: 'Pedido rejeitado',
          desc: 'O vendedor não poderá publicar enquanto estiver rejeitado.',
        },
        suspenso: {
          title: 'Vendedor suspenso',
          desc: 'A suspensão deve ser gerida na área de vendedores.',
        },
        pendente: {
          title: 'Pedido reaberto',
          desc: 'O pedido voltou para análise.',
        },
      };

      toast({ title: msgs[estado].title, description: msgs[estado].desc });
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o estado',
        variant: 'destructive',
      });
    }
  };

  const pedidosFiltrados =
    filtroEstado === 'todos'
      ? pedidos
      : pedidos.filter(p => p.estado === filtroEstado);

  const contadores = {
    pendente: pedidos.filter(p => p.estado === 'pendente').length,
    aprovado: pedidos.filter(p => p.estado === 'aprovado').length,
    rejeitado: pedidos.filter(p => p.estado === 'rejeitado').length,
    suspenso: pedidos.filter(p => p.estado === 'suspenso').length,
  };

  const corEstado: Record<StatusVendedorAprovacao, string> = {
    pendente: 'border-yellow-500/50 bg-yellow-500/5',
    aprovado: 'border-primary/50 bg-primary/5',
    rejeitado: 'border-destructive/50 bg-destructive/5',
    suspenso: 'border-orange-500/50 bg-orange-500/5',
  };

  const badgeEstado: Record<StatusVendedorAprovacao, string> = {
    pendente: 'border-yellow-500 text-yellow-600',
    aprovado: 'border-primary text-primary',
    rejeitado: 'border-destructive text-destructive',
    suspenso: 'border-orange-500 text-orange-600',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-titulo text-2xl font-bold">
          Pedidos de Vendedores
        </h1>

        <p className="font-corpo text-sm text-muted-foreground mt-1">
          Área de triagem para aprovar, rejeitar ou reabrir pedidos. Suspensão,
          bloqueio e eliminação devem ser feitos na gestão de vendedores.
        </p>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(Object.entries(contadores) as [StatusVendedorAprovacao, number][]).map(([estado, count]) => (
          <button
            key={estado}
            onClick={() => setFiltroEstado(estado)}
            className={`border-2 p-3 rounded-md text-center transition-colors ${
              filtroEstado === estado
                ? corEstado[estado] + ' border-opacity-100'
                : 'border-border hover:border-muted-foreground/30'
            }`}
          >
            <p className="font-titulo text-xl font-bold">{count}</p>
            <p className="font-corpo text-xs text-muted-foreground capitalize">
              {estado}s
            </p>
          </button>
        ))}
      </div>

      {/* Filtro */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFiltroEstado('todos')}
          className={`font-corpo text-xs px-3 py-1.5 border-2 rounded-md transition-colors ${
            filtroEstado === 'todos'
              ? 'border-foreground bg-foreground text-background'
              : 'border-border hover:border-muted-foreground'
          }`}
        >
          Todos ({pedidos.length})
        </button>

        {(Object.entries(contadores) as [StatusVendedorAprovacao, number][]).map(([estado, count]) => (
          <button
            key={estado}
            onClick={() => setFiltroEstado(estado)}
            className={`font-corpo text-xs px-3 py-1.5 border-2 rounded-md transition-colors capitalize ${
              filtroEstado === estado
                ? 'border-foreground bg-foreground text-background'
                : 'border-border hover:border-muted-foreground'
            }`}
          >
            {estado} ({count})
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {pedidosFiltrados.length === 0 && (
          <p className="font-corpo text-sm text-muted-foreground py-8 text-center">
            Nenhum vendedor neste estado.
          </p>
        )}

        {pedidosFiltrados.map(p => (
          <div
            key={p.id}
            className={`border-2 ${corEstado[p.estado]} p-4 rounded-md space-y-3`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-titulo text-sm font-medium">
                  {p.nome_comercial}
                </span>

                <span className="font-corpo text-xs px-2 py-0.5 border border-border text-muted-foreground rounded">
                  {obterRotuloCompletoVendedor(p.tipo_vendedor)}
                </span>

                <span className={`font-corpo text-xs px-2 py-0.5 border rounded capitalize ${badgeEstado[p.estado]}`}>
                  {p.estado}
                </span>
              </div>

              <button
                onClick={() => setDetalheAberto(detalheAberto === p.id ? null : p.id)}
                className="flex items-center gap-1 font-corpo text-xs text-primary hover:underline"
              >
                <Eye size={14} />
                {detalheAberto === p.id ? 'Ocultar' : 'Ver detalhes'}
              </button>
            </div>

            <div className="font-corpo text-xs text-muted-foreground space-y-0.5">
              <p>Responsável: {p.nome_responsavel}</p>

              <p className="flex items-center gap-1">
                <MapPin size={12} />
                {p.municipio}, {p.provincia} · {p.mercado_bairro}
              </p>

              <p className="flex items-center gap-1">
                <Calendar size={12} />
                Registado em {new Date(p.data_registo).toLocaleDateString()}
              </p>
            </div>

            {detalheAberto === p.id && (
              <div className="border-t border-border pt-3 space-y-2">
                <p className="font-corpo text-xs">
                  <strong>Email:</strong> {p.email}
                </p>

                <p className="font-corpo text-xs">
                  <strong>Telefone:</strong> {p.telefone}
                </p>

                <p className="font-corpo text-xs">
                  <strong>Descrição:</strong> {p.descricao}
                </p>

                {p.ano_inicio && (
                  <p className="font-corpo text-xs">
                    <strong>Ativo desde:</strong> {p.ano_inicio}
                  </p>
                )}

                {p.entrega_disponivel !== undefined && (
                  <p className="font-corpo text-xs">
                    <strong>Entrega:</strong>{' '}
                    {p.entrega_disponivel ? 'Sim' : 'Não'}
                  </p>
                )}
              </div>
            )}

            {/* Ações de triagem */}
            <div className="flex gap-2 flex-wrap">
              {p.estado === 'pendente' && (
                <>
                  <button
                    onClick={() => alterarEstado(p.id, 'aprovado')}
                    className="flex items-center gap-1 font-corpo text-xs border-2 border-primary text-primary px-3 py-1.5 rounded hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    <CheckCircle size={14} />
                    Aprovar
                  </button>

                  <button
                    onClick={() => alterarEstado(p.id, 'rejeitado')}
                    className="flex items-center gap-1 font-corpo text-xs border-2 border-destructive text-destructive px-3 py-1.5 rounded hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  >
                    <XCircle size={14} />
                    Rejeitar
                  </button>
                </>
              )}

              {p.estado === 'rejeitado' && (
                <button
                  onClick={() => alterarEstado(p.id, 'pendente')}
                  className="flex items-center gap-1 font-corpo text-xs border-2 border-yellow-500 text-yellow-600 px-3 py-1.5 rounded hover:bg-yellow-500 hover:text-white transition-colors"
                >
                  <Eye size={14} />
                  Reabrir análise
                </button>
              )}

              {p.estado === 'aprovado' && (
                <p className="font-corpo text-xs text-muted-foreground">
                  Vendedor aprovado. Para suspender, bloquear, destacar ou
                  eliminar, use a área <strong>Vendedores</strong>.
                </p>
              )}

              {p.estado === 'suspenso' && (
                <p className="font-corpo text-xs text-muted-foreground">
                  Vendedor suspenso. A gestão deste estado deve ser feita na
                  área <strong>Vendedores</strong>.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}