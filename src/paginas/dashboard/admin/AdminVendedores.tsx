/**
 * Admin — Gestão de vendedores
 * Verificar, alterar plano, suspender e reativar.
 */

import { useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle, XCircle } from 'lucide-react';

import { Vendedor, PlanoVendedor } from '@/tipos';
import { useToast } from '@/hooks/use-toast';

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
    <div className="space-y-4">
      <h1 className="font-titulo text-2xl font-bold">
        Gestão de Vendedores
      </h1>

      {vendedores.length === 0 ? (
        <p className="font-corpo text-sm text-muted-foreground py-8 text-center">
          Nenhum vendedor encontrado.
        </p>
      ) : (
        <div className="space-y-3">
          {vendedores.map(v => {
            const estado = estadoVisual((v as any).status_aprovacao);

            return (
              <div key={v.id} className="border-2 border-border p-4 space-y-3">
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
                    className="font-corpo text-xs border-2 border-border bg-background px-2 py-1.5 focus:outline-none focus:border-primary disabled:opacity-50"
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

