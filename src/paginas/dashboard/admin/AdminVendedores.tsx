/**
 * Admin — Gestão de vendedores
 * Verificar, alterar plano, suspender e reativar.
 */

import { useEffect, useState } from 'react';
import { CalendarDays, Mail, MapPin, Phone, ShieldCheck, CheckCircle, Store, XCircle } from 'lucide-react';

import { Vendedor, PlanoVendedor, TipoVendedor } from '@/tipos';
import { useToast } from '@/hooks/use-toast';
import { useAtualizacaoTempoReal } from '@/hooks/useAtualizacaoTempoReal';
import { CATALOGO_DOCUMENTOS, obterRequisitosDocumentos } from '@/dados/documentosVendedor';

import {
  fetchVendedoresAdmin,
  updateVendedorAdmin,
  atualizarEstadoVendedor,
  atualizarVerificacaoVendedor,
} from '@/services/api';

export default function AdminVendedores() {
  const { toast } = useToast();

  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [atualizandoId, setAtualizandoId] = useState<string | null>(null);

  async function carregarVendedores() {
    try {
      setLoading(true);

      const data = await fetchVendedoresAdmin();
      setVendedores(data || []);
    } catch (err) {
      console.error(err);

      toast({
        title: 'Erro ao carregar vendedores',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarVendedores();
  }, []);

  useAtualizacaoTempoReal(['vendedores', 'produtos', 'servicos'], carregarVendedores);

  const atualizarVendedorLocal = (vendedorAtualizado: Vendedor) => {
    setVendedores(prev =>
      prev.map(v =>
        v.id === vendedorAtualizado.id ? vendedorAtualizado : v
      )
    );
  };

  const alterarStatus = async (
    id: string,
    status: 'aprovado' | 'suspenso' | 'pendente' | 'rejeitado'
  ) => {
    try {
      setAtualizandoId(id);

      const atualizado = await atualizarEstadoVendedor(id, status);

      atualizarVendedorLocal(atualizado);

      toast({
        title:
          status === 'aprovado'
            ? 'Vendedor aprovado'
            : status === 'suspenso'
              ? 'Vendedor suspenso'
              : status === 'pendente'
                ? 'Vendedor voltou para análise'
                : 'Vendedor rejeitado',
      });
    } catch (err) {
      console.error(err);

      toast({
        title: 'Erro ao alterar estado',
        variant: 'destructive',
      });
    } finally {
      setAtualizandoId(null);
    }
  };

  const alterarVerificacao = async (vendedor: Vendedor) => {
    if ((vendedor as any).status_aprovacao !== 'aprovado') {
      toast({
        title: 'Apenas vendedores aprovados podem ser verificados',
        variant: 'destructive',
      });

      return;
    }

    try {
      setAtualizandoId(vendedor.id);

      const atualizado = await atualizarVerificacaoVendedor(
        vendedor.id,
        !vendedor.verificado
      );

      atualizarVendedorLocal(atualizado);

      toast({
        title: !vendedor.verificado
          ? 'Vendedor verificado!'
          : 'Verificação removida',
      });
    } catch (err) {
      console.error(err);

      toast({
        title: 'Erro ao alterar verificação',
        variant: 'destructive',
      });
    } finally {
      setAtualizandoId(null);
    }
  };

  const alterarPlano = async (id: string, plano: PlanoVendedor) => {
    try {
      setAtualizandoId(id);

      const atualizado = await updateVendedorAdmin(id, {
        plano,
        pode_destacar: plano === 'destaque' || plano === 'premium',
      });

      atualizarVendedorLocal(atualizado);

      toast({
        title: `Plano alterado para ${plano}`,
      });
    } catch (err) {
      console.error(err);

      toast({
        title: 'Erro ao alterar plano',
        variant: 'destructive',
      });
    } finally {
      setAtualizandoId(null);
    }
  };

  const estadoVisual = (status?: string | null) => {
    if (status === 'aprovado') {
      return {
        texto: 'ativo',
        classe: 'border-primary text-primary',
      };
    }

    if (status === 'pendente') {
      return {
        texto: 'pendente',
        classe: 'border-secondary text-secondary-foreground',
      };
    }

    if (status === 'suspenso') {
      return {
        texto: 'suspenso',
        classe: 'border-destructive text-destructive',
      };
    }

    if (status === 'rejeitado') {
      return {
        texto: 'rejeitado',
        classe: 'border-destructive text-destructive',
      };
    }

    return {
      texto: 'pendente',
      classe: 'border-secondary text-secondary-foreground',
    };
  };

  if (loading) {
    return (
      <p className="font-corpo text-sm text-muted-foreground">
        A carregar vendedores...
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header className="painel-dashboard-cabecalho">
        <h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">Gestão de Vendedores</h1>
        <p className="relative z-10 mt-1 font-corpo text-sm text-primary-foreground/80">Aprova, suspende, verifica e gere os planos dos vendedores.</p>
      </header>

      {vendedores.length === 0 ? (
        <p className="font-corpo text-sm text-muted-foreground py-8 text-center">
          Nenhum vendedor encontrado.
        </p>
      ) : (
        <div className="space-y-3">
          {vendedores.map(v => {
            const estado = estadoVisual((v as any).status_aprovacao);

            return (
              <div key={v.id} className="painel-dashboard-item p-4 space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  {v.foto_perfil ? (
                    <img src={v.foto_perfil} alt={`Foto de ${v.nome_comercial}`} className="size-16 shrink-0 rounded-full border-2 border-primary/20 object-cover" />
                  ) : (
                    <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-titulo font-bold text-primary-foreground">
                      {v.nome_comercial.trim().charAt(0).toUpperCase() || '?'}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                {/* Info */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-titulo text-sm">
                    {v.nome_comercial}
                  </span>

                  {v.verificado && (
                    <span className="selo-verificado">
                      <ShieldCheck size={10} />
                    </span>
                  )}

                  <span className={`font-corpo text-xs px-2 py-0.5 border ${estado.classe}`}>
                    {estado.texto}
                  </span>

                  <span className="font-corpo text-xs px-2 py-0.5 border border-border text-muted-foreground">
                    {v.plano || 'gratuito'}
                  </span>

                  {(v as any).pode_destacar && (
                    <span className="font-corpo text-xs px-2 py-0.5 border border-primary text-primary">
                      Pode destacar
                    </span>
                  )}
                </div>

                <p className="font-corpo text-xs text-muted-foreground">
                  {v.municipio || 'Sem município'} ·{' '}
                  {v.tipo_vendedor || 'Sem tipo'} ·{' '}
                  {v.nome_responsavel || 'Sem responsável'}
                </p>

                <p className="font-corpo text-xs text-muted-foreground">
                  {v.email || 'Sem email'} ·{' '}
                  {v.telefone_whatsapp || v.whatsapp || 'Sem telefone'}
                </p>

                {(() => {
                  const requisitos = obterRequisitosDocumentos(
                    v.tipo_vendedor as TipoVendedor
                  );

                  if (!requisitos) return null;

                  return (
                    <p className="font-corpo text-xs text-muted-foreground">
                      Documentos obrigatórios ({requisitos.rotuloNivel}):{' '}
                      {requisitos.obrigatorios
                        .map(id => CATALOGO_DOCUMENTOS[id]?.nome)
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  );
                })()}

                    <div className="mt-3 grid gap-x-5 gap-y-2 border-t border-border pt-3 font-corpo text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                      <span className="flex items-center gap-1.5"><Mail size={13} className="text-primary" />{v.email || 'Sem e-mail'}</span>
                      <span className="flex items-center gap-1.5"><Phone size={13} className="text-primary" />{v.telefone_whatsapp || v.whatsapp || 'Sem telefone'}</span>
                      <span className="flex items-center gap-1.5"><MapPin size={13} className="text-primary" />{[v.municipio, v.provincia].filter(Boolean).join(', ') || 'Localização não indicada'}</span>
                      <span className="flex items-center gap-1.5"><Store size={13} className="text-primary" />{v.tipo_vendedor || 'Tipo não indicado'}</span>
                      <span>Responsável: {v.nome_responsavel || 'Não indicado'}</span>
                      <span>Plano: {(v.plano || 'gratuito').replace(/^./, letra => letra.toUpperCase())}</span>
                      {v.mercado_bairro && <span>Zona: {v.mercado_bairro}</span>}
                      {v.horario_atendimento && <span>Horário: {v.horario_atendimento}</span>}
                      {v.criado_em && <span className="flex items-center gap-1.5"><CalendarDays size={13} className="text-primary" />Registado em {new Date(v.criado_em).toLocaleDateString('pt-AO')}</span>}
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex flex-wrap gap-2">
                  {(v as any).status_aprovacao === 'pendente' && (
                    <BotaoAcao
                      onClick={() => alterarStatus(v.id, 'aprovado')}
                      cor="primary"
                      disabled={atualizandoId === v.id}
                    >
                      <CheckCircle size={14} />
                      Aprovar
                    </BotaoAcao>
                  )}

                  {(v as any).status_aprovacao === 'aprovado' && (
                    <BotaoAcao
                      onClick={() => alterarStatus(v.id, 'suspenso')}
                      cor="destructive"
                      disabled={atualizandoId === v.id}
                    >
                      <XCircle size={14} />
                      Suspender
                    </BotaoAcao>
                  )}

                  {(v as any).status_aprovacao === 'suspenso' && (
                    <BotaoAcao
                      onClick={() => alterarStatus(v.id, 'aprovado')}
                      cor="primary"
                      disabled={atualizandoId === v.id}
                    >
                      <CheckCircle size={14} />
                      Reativar
                    </BotaoAcao>
                  )}

                  {(v as any).status_aprovacao === 'rejeitado' && (
                    <BotaoAcao
                      onClick={() => alterarStatus(v.id, 'pendente')}
                      cor="primary"
                      disabled={atualizandoId === v.id}
                    >
                      <CheckCircle size={14} />
                      Reabrir análise
                    </BotaoAcao>
                  )}

                  <BotaoAcao
                    onClick={() => alterarVerificacao(v)}
                    cor="primary"
                    disabled={atualizandoId === v.id}
                  >
                    <ShieldCheck size={14} />
                    {v.verificado ? 'Remover verificação' : 'Verificar'}
                  </BotaoAcao>

                  {/* Alterar plano */}
                  <select
                    value={(v.plano || 'gratuito') as PlanoVendedor}
                    onChange={e =>
                      alterarPlano(v.id, e.target.value as PlanoVendedor)
                    }
                    disabled={atualizandoId === v.id}
                    className="rounded-md border-2 border-border bg-background px-2 py-1.5 font-corpo text-xs focus:border-primary focus:outline-none disabled:opacity-50"
                  >
                    <option value="gratuito">Gratuito</option>
                    <option value="destaque">Destaque</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BotaoAcao({
  children,
  onClick,
  cor,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  cor: 'primary' | 'destructive';
  disabled?: boolean;
}) {
  const classeCor =
    cor === 'primary'
      ? 'hover:border-primary hover:text-primary'
      : 'hover:border-destructive hover:text-destructive';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1 font-corpo text-xs border-2 border-border px-3 py-1.5 transition-colors disabled:opacity-50 ${classeCor}`}
    >
      {children}
    </button>
  );
}

