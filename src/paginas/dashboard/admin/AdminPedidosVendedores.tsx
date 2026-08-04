/**
 * Admin — Pedidos de Vendedores
 * Página de triagem: aprovar, rejeitar ou reabrir análise.
 * Suspender, bloquear e eliminar devem ficar na Gestão de Vendedores.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle, MapPin, Calendar, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contextos/AuthContexto';
import { obterRotuloCompletoVendedor } from '@/dados/constantes';
import { StatusVendedorAprovacao } from '@/tipos';

import {
  fetchVendedoresAdmin,
  fetchParceirosEntregaAdmin,
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
  motivo_rejeicao?: string | null;
  dados: Record<string, any>;
}

export default function AdminPedidosVendedores() {
  const { toast } = useToast();
  const { utilizador } = useAuth();

  const [pedidos, setPedidos] = useState<PedidoVendedor[]>([]);
  const [pedidosEntregadores, setPedidosEntregadores] = useState(0);
  const [detalheAberto, setDetalheAberto] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] =
    useState<StatusVendedorAprovacao | 'todos'>('pendente');
  const [pedidoParaRejeitar, setPedidoParaRejeitar] =
    useState<PedidoVendedor | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [aRejeitar, setARejeitar] = useState(false);

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
        motivo_rejeicao: v.motivo_rejeicao || null,
        dados: v,
      }));

      setPedidos(normalizados);
    }

    carregar();
    fetchParceirosEntregaAdmin()
      .then(lista => setPedidosEntregadores(lista.filter((parceiro: any) => ['rascunho', 'documentos_pendentes', 'em_analise'].includes(parceiro.estado)).length))
      .catch(() => setPedidosEntregadores(0));
  }, []);

  const alterarEstado = async (
    id: string,
    estado: StatusVendedorAprovacao,
    motivoRejeicao?: string,
  ) => {
    try {
      await atualizarEstadoVendedor(id, estado, utilizador?.id, motivoRejeicao);

      setPedidos(prev =>
        prev.map(p => (p.id === id ? {
          ...p,
          estado,
          motivo_rejeicao: estado === 'rejeitado' ? motivoRejeicao || null : null,
        } : p))
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
    } catch (erro: any) {
      toast({
        title: 'Erro',
        description: erro?.message || 'Não foi possível atualizar o estado',
        variant: 'destructive',
      });
    }
  };

  const confirmarRejeicao = async () => {
    const motivo = motivoRejeicao.trim();
    if (!pedidoParaRejeitar || !motivo) {
      toast({
        title: 'Motivo obrigatório',
        description: 'O pedido não foi rejeitado. Indique um motivo claro para o vendedor.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setARejeitar(true);
      await alterarEstado(pedidoParaRejeitar.id, 'rejeitado', motivo);
      setPedidoParaRejeitar(null);
      setMotivoRejeicao('');
    } finally {
      setARejeitar(false);
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
      <header className="painel-dashboard-cabecalho">
        <h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">Pedidos de Vendedores</h1>

        <p className="relative z-10 mt-1 font-corpo text-sm text-primary-foreground/80">
          Área de triagem para aprovar, rejeitar ou reabrir pedidos. Suspensão,
          bloqueio e eliminação devem ser feitos na gestão de vendedores.
        </p>
      </header>

      <nav className="grid gap-3 sm:grid-cols-2" aria-label="Tipo de pedido de cadastro">
        <Link
          to="/dashboard/pedidos-vendedores"
          className="rounded-xl border-2 border-primary bg-primary/5 p-4 transition-colors"
        >
          <p className="font-titulo text-base font-bold text-primary">Pedidos de vendedores</p>
          <p className="mt-1 font-corpo text-sm text-muted-foreground">{contadores.pendente} pedido{contadores.pendente === 1 ? '' : 's'} pendente{contadores.pendente === 1 ? '' : 's'} de análise.</p>
        </Link>
        <Link
          to="/dashboard/pedidos-entregadores"
          className="rounded-xl border-2 border-border p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <p className="font-titulo text-base font-bold">Pedidos de entregadores</p>
          <p className="mt-1 font-corpo text-sm text-muted-foreground">{pedidosEntregadores} pedido{pedidosEntregadores === 1 ? '' : 's'} pendente{pedidosEntregadores === 1 ? '' : 's'} de análise.</p>
        </Link>
      </nav>

      {/* Contadores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(Object.entries(contadores) as [StatusVendedorAprovacao, number][]).map(([estado, count]) => (
          <button
            key={estado}
            onClick={() => setFiltroEstado(estado)}
            className={`rounded-xl border-2 p-3 text-center transition-colors ${
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
            className={`painel-dashboard-item ${corEstado[p.estado]} p-4 space-y-3`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                {p.dados?.foto_perfil ? (
                  <img
                    src={p.dados.foto_perfil}
                    alt={`Foto de ${p.nome_comercial}`}
                    className="size-12 shrink-0 rounded-full border-2 border-primary/20 object-cover"
                  />
                ) : (
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary font-titulo text-base font-bold text-primary-foreground">
                    {p.nome_comercial.trim().charAt(0).toUpperCase() || '?'}
                  </span>
                )}
                <div className="flex flex-wrap items-center gap-2">
                <span className="font-titulo text-sm font-bold">
                  {p.nome_comercial}
                </span>

                <span className="font-corpo text-xs px-2 py-0.5 border border-border text-muted-foreground rounded">
                  {obterRotuloCompletoVendedor(p.tipo_vendedor)}
                </span>

                <span className={`font-corpo text-xs px-2 py-0.5 border rounded capitalize ${badgeEstado[p.estado]}`}>
                  {p.estado}
                </span>
                </div>
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

                {p.estado === 'rejeitado' && p.motivo_rejeicao && (
                  <p className="font-corpo text-xs text-destructive">
                    <strong>Motivo da rejeição:</strong> {p.motivo_rejeicao}
                  </p>
                )}

                <DadosPedido dados={p.dados} />
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
                    onClick={() => {
                      setPedidoParaRejeitar(p);
                      setMotivoRejeicao('');
                    }}
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

      {pedidoParaRejeitar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-lg rounded-xl border-2 border-destructive bg-card p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <XCircle className="size-5" />
              </span>
              <div>
                <h2 className="font-titulo text-lg font-bold">Rejeitar pedido de vendedor</h2>
                <p className="mt-1 font-corpo text-sm text-muted-foreground">
                  Indique um motivo claro para <strong>{pedidoParaRejeitar.nome_comercial}</strong>. Este motivo será mostrado ao vendedor e o acesso ficará bloqueado até a análise ser reaberta.
                </p>
              </div>
            </div>

            <label className="mt-5 block space-y-2">
              <span className="font-corpo text-sm font-semibold">Motivo da rejeição *</span>
              <textarea
                value={motivoRejeicao}
                onChange={e => setMotivoRejeicao(e.target.value)}
                placeholder="Ex.: Os documentos apresentados não correspondem aos dados do responsável."
                className="min-h-28 w-full rounded-lg border-2 border-border bg-background p-3 font-corpo text-sm focus:border-destructive focus:outline-none focus:ring-2 focus:ring-destructive/15"
                autoFocus
              />
            </label>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPedidoParaRejeitar(null)}
                disabled={aRejeitar}
                className="rounded-lg border-2 border-border px-4 py-2 font-corpo text-sm font-semibold hover:bg-muted disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarRejeicao}
                disabled={aRejeitar || !motivoRejeicao.trim()}
                className="rounded-lg bg-destructive px-4 py-2 font-corpo text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {aRejeitar ? 'A rejeitar...' : 'Confirmar rejeição'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DadosPedido({ dados }: { dados: Record<string, any> }) {
  const campos = [
    ['Nome comercial', dados.nome_comercial],
    ['Responsável', dados.nome_responsavel],
    ['Tipo de vendedor', obterRotuloCompletoVendedor(dados.tipo_vendedor)],
    ['Telefone / WhatsApp', dados.telefone_whatsapp || dados.whatsapp],
    ['E-mail', dados.email],
    ['Província', dados.provincia],
    ['Município', dados.municipio],
    ['Bairro / mercado', dados.mercado_bairro || dados.bairro],
    ['Endereço', dados.endereco_detalhado],
    ['Descrição', dados.descricao],
    ['Atividade iniciada em', dados.data_inicio_atividade],
    ['Horário de atendimento', dados.horario_atendimento],
    ['Entrega disponível', dados.entrega_disponivel == null ? null : dados.entrega_disponivel ? 'Sim' : 'Não'],
    ['Tipo de produção', dados.tipo_producao],
    ['Área cultivada', dados.area_cultivada ? `${dados.area_cultivada} hectares` : null],
    ['Principais culturas', dados.principais_culturas],
    ['Produção mensal', dados.producao_mensal],
    ['Venda por grosso', dados.venda_grosso == null ? null : dados.venda_grosso ? 'Sim' : 'Não'],
    ['Venda a retalho', dados.venda_retalho == null ? null : dados.venda_retalho ? 'Sim' : 'Não'],
    ['Tipos de produtos', dados.tipos_produtos],
    ['Compra a produtores', dados.compra_produtores == null ? null : dados.compra_produtores ? 'Sim' : 'Não'],
    ['Volume mínimo', dados.volume_minimo],
    ['Entrega noutras províncias', dados.entrega_outras_provincias == null ? null : dados.entrega_outras_provincias ? 'Sim' : 'Não'],
    ['Tipo de loja', dados.tipo_loja],
    ['Mercado localizado', dados.mercado_localizado],
    ['Venda presencial', dados.venda_presencial == null ? null : dados.venda_presencial ? 'Sim' : 'Não'],
  ].filter(([, valor]) => valor !== null && valor !== undefined && valor !== '');

  const documentos = dados.documentos && typeof dados.documentos === 'object'
    ? Object.entries(dados.documentos as Record<string, Record<string, string>>)
    : [];

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      <p className="font-corpo text-xs font-semibold text-foreground">Dados submetidos no cadastro</p>
      <dl className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
        {campos.map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt className="font-corpo text-[11px] font-medium text-muted-foreground">{rotulo}</dt>
            <dd className="font-corpo text-xs text-foreground break-words">{String(valor)}</dd>
          </div>
        ))}
      </dl>

      <div className="border-t border-border pt-3">
        <p className="font-corpo text-xs font-semibold">Documentos informados</p>
        {documentos.length > 0 ? (
          <div className="mt-2 space-y-2">
            {documentos.map(([documentoId, valores]) => (
              <div key={documentoId} className="rounded border border-border bg-background p-2">
                <p className="font-corpo text-xs font-medium">{documentoId.replace(/_/g, ' ')}</p>
                {Object.entries(valores).map(([campo, valor]) =>
                  campo === 'foto_frente' || campo === 'foto_verso' ? (
                    <a key={campo} href={String(valor)} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded border border-border bg-muted/30">
                      <img src={String(valor)} alt={`${campo === 'foto_frente' ? 'Frente' : 'Verso'} do documento`} className="h-32 w-full object-contain" />
                      <span className="block px-2 py-1 font-corpo text-[11px] font-medium text-primary">Ver foto: {campo === 'foto_frente' ? 'frente' : 'verso'}</span>
                    </a>
                  ) : (
                    <p key={campo} className="font-corpo text-xs text-muted-foreground">{campo.replace(/_/g, ' ')}: {String(valor)}</p>
                  )
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-1 font-corpo text-xs text-muted-foreground">Não existem documentos guardados para este pedido antigo.</p>
        )}
      </div>
    </div>
  );
}
