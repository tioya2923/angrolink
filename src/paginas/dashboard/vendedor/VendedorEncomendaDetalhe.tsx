import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, KeyRound } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EncomendaDetalheConteudo } from '@/componentes/encomendas/EncomendaDetalheConteudo';
import { ResumoFinanceiroVendedorEncomenda } from '@/componentes/encomendas/ResumoFinanceiroVendedorEncomenda';
import { useAuth } from '@/contextos/AuthContexto';
import { useEncomendasTempoReal } from '@/hooks/useEncomendasTempoReal';
import { useToast } from '@/hooks/use-toast';
import {
  confirmarRecolhaEncomendaVendedor,
  fetchDetalheEncomenda,
  fetchDisputaEncomenda,
  transicionarEncomendaLevantamento,
  validarCodigoLevantamento,
  type DetalheEncomenda,
  type DisputaEncomenda,
} from '@/services/encomendas';
import {
  obterResumoFinanceiroEncomendaVendedor,
  type ResumoFinanceiroEncomendaVendedor,
} from '@/services/pagamentos';

function formatarDataHora(valor?: string | null): string | null {
  if (!valor) return null;

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return null;

  return data.toLocaleString('pt-AO');
}

function descreverVeiculo(
  entrega: DetalheEncomenda['entrega_participante'],
): string | null {
  const veiculo = entrega?.veiculo;
  if (!veiculo) return null;

  const marcaModelo = [veiculo.marca, veiculo.modelo]
    .filter(Boolean)
    .join(' ');

  const partes = [
    veiculo.tipo_veiculo,
    marcaModelo || null,
    veiculo.matricula ? `Matrícula ${veiculo.matricula}` : null,
  ].filter((parte): parte is string => Boolean(parte));

  return partes.length > 0 ? partes.join(' · ') : null;
}

export default function VendedorEncomendaDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { toast } = useToast();
  const { utilizador } = useAuth();

  const [encomenda, setEncomenda] = useState<DetalheEncomenda | null>(null);
  const [disputa, setDisputa] = useState<DisputaEncomenda | null>(null);
  const [resumo, setResumo] = useState<ResumoFinanceiroEncomendaVendedor | null>(null);
  const [loading, setLoading] = useState(true);
  const [resumoCarregando, setResumoCarregando] = useState(false);
  const [resumoErro, setResumoErro] = useState(false);
  const [recusar, setRecusar] = useState(false);
  const [confirmarRecolha, setConfirmarRecolha] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [acao, setAcao] = useState(false);

  const carregar = useCallback(async () => {
    if (!id) return;

    try {
      const detalhe = await fetchDetalheEncomenda(id);
      setEncomenda(detalhe);
      setDisputa(detalhe ? await fetchDisputaEncomenda(detalhe.id) : null);

      if (detalhe) {
        try {
          setResumoCarregando(true);
          setResumoErro(false);
          setResumo(await obterResumoFinanceiroEncomendaVendedor(detalhe.id));
        } catch {
          setResumo(null);
          setResumoErro(true);
        } finally {
          setResumoCarregando(false);
        }
      } else {
        setResumo(null);
        setResumoErro(false);
      }
    } catch {
      toast({
        title: 'Não foi possível carregar a encomenda.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEncomendasTempoReal(
    {
      ativo: utilizador?.papel === 'vendedor',
      encomendaId: id,
    },
    carregar,
  );

  const mudar = async (estado: string, motivoAcao?: string) => {
    if (!encomenda) return;

    try {
      setAcao(true);
      await transicionarEncomendaLevantamento(
        encomenda.id,
        estado,
        motivoAcao,
      );
      toast({ title: 'Encomenda atualizada.' });
      setRecusar(false);
      setMotivo('');
      await carregar();
    } catch {
      toast({
        title: 'Não foi possível atualizar a encomenda.',
        variant: 'destructive',
      });
    } finally {
      setAcao(false);
    }
  };

  const confirmarEntregaAoEntregador = async () => {
    const entrega = encomenda?.entrega_participante;

    if (
      !encomenda
      || encomenda.modalidade_recebimento !== 'entrega'
      || encomenda.estado !== 'pronta_para_levantamento'
      || entrega?.estado !== 'chegou_origem'
      || !entrega.atribuicao_id
    ) {
      return;
    }

    try {
      setAcao(true);
      await confirmarRecolhaEncomendaVendedor(entrega.atribuicao_id);
      setConfirmarRecolha(false);
      toast({ title: 'Entrega ao entregador confirmada.' });
      await carregar();
    } catch {
      toast({
        title: 'Não foi possível confirmar a entrega ao entregador.',
        variant: 'destructive',
      });
    } finally {
      setAcao(false);
    }
  };

  const validar = async () => {
    if (!encomenda) return;

    try {
      setAcao(true);
      const resultado = await validarCodigoLevantamento(encomenda.id, codigo);

      if (resultado.validado) {
        setCodigo('');
        toast({ title: 'Levantamento confirmado.' });
        await carregar();
        return;
      }

      toast({
        title: resultado.motivo || 'Código incorreto.',
        description: resultado.bloqueado
          ? 'O cliente deve gerar um novo código.'
          : `Tentativas restantes: ${resultado.tentativas_restantes}`,
        variant: 'destructive',
      });
    } catch {
      toast({
        title: 'Não foi possível validar o código.',
        variant: 'destructive',
      });
    } finally {
      setAcao(false);
    }
  };

  if (loading) {
    return (
      <p className="painel-dashboard-form text-sm text-muted-foreground">
        A carregar encomenda…
      </p>
    );
  }

  if (!encomenda) {
    return (
      <p className="painel-dashboard-form text-sm text-muted-foreground">
        Encomenda não encontrada.
      </p>
    );
  }

  const eEntrega = encomenda.modalidade_recebimento === 'entrega';
  const entrega = encomenda.entrega_participante;
  const descricaoVeiculo = descreverVeiculo(entrega);
  const podeConfirmarRecolha = Boolean(
    eEntrega
    && encomenda.estado === 'pronta_para_levantamento'
    && entrega?.estado === 'chegou_origem'
    && entrega.atribuicao_id,
  );

  const mostrarIdentidadeEntregador = Boolean(
    entrega
    && ['aceite', 'chegou_origem', 'recolhida', 'chegou_destino', 'concluida'].includes(
      entrega.estado,
    ),
  );

  const aceiteEm = formatarDataHora(entrega?.aceite_em);
  const chegouOrigemEm = formatarDataHora(entrega?.chegou_origem_em);
  const recolhidaEm = formatarDataHora(entrega?.recolhida_em);
  const chegouDestinoEm = formatarDataHora(entrega?.chegou_destino_em);

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => navegar('/dashboard/encomendas')}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-green-800"
      >
        <ArrowLeft className="size-4" />
        Voltar às encomendas
      </button>

      <EncomendaDetalheConteudo
        encomenda={encomenda}
        contexto="vendedor"
        disputa={disputa}
      />

      <ResumoFinanceiroVendedorEncomenda
        resumo={resumo}
        carregando={resumoCarregando}
        erro={resumoErro}
      />

      {eEntrega && (
        <section className="painel-dashboard-form space-y-3">
          <h2 className="font-titulo text-lg font-bold">
            Recolha pelo entregador
          </h2>

          {(!entrega || entrega.estado === 'nao_atribuido') && (
            <p className="text-sm text-muted-foreground">
              A aguardar atribuição de um entregador.
            </p>
          )}

          {entrega?.estado === 'nao_aplicavel' && (
            <p className="text-sm text-muted-foreground">
              A entrega ainda não possui uma atribuição aplicável.
            </p>
          )}

          {entrega?.estado === 'atribuida' && (
            <div>
              <p className="font-semibold">Entregador atribuído</p>
              <p className="text-sm text-muted-foreground">
                A aguardar confirmação do entregador.
              </p>
            </div>
          )}

          {mostrarIdentidadeEntregador && (
            <div className="rounded-xl border bg-muted/30 p-4 text-sm">
              {entrega?.nome_entregador && (
                <p className="font-semibold">{entrega.nome_entregador}</p>
              )}
              {descricaoVeiculo && <p>{descricaoVeiculo}</p>}
            </div>
          )}

          {entrega?.estado === 'aceite' && (
            <div>
              <p className="font-semibold">Entregador confirmado</p>
              {aceiteEm && (
                <p className="text-sm text-muted-foreground">
                  Aceite: {aceiteEm}
                </p>
              )}
            </div>
          )}

          {entrega?.estado === 'chegou_origem' && (
            <div>
              <p className="font-semibold">
                Entregador chegou para recolha
              </p>
              {chegouOrigemEm && (
                <p className="text-sm text-muted-foreground">
                  Chegada: {chegouOrigemEm}
                </p>
              )}
            </div>
          )}

          {entrega?.estado === 'recolhida' && (
            <div>
              <p className="font-semibold">Recolha confirmada</p>
              <p className="text-sm text-muted-foreground">
                A encomenda está agora com o entregador.
              </p>
              {recolhidaEm && (
                <p className="text-sm text-muted-foreground">
                  Recolha: {recolhidaEm}
                </p>
              )}
            </div>
          )}

          {entrega?.estado === 'chegou_destino' && (
            <div>
              <p className="font-semibold">Entregador chegou ao destino</p>
              <p className="text-sm text-muted-foreground">Aguarda a confirmação presencial da entrega pelo comprador.</p>
              {chegouDestinoEm && <p className="text-sm text-muted-foreground">Chegada: {chegouDestinoEm}</p>}
            </div>
          )}

          {entrega?.estado === 'recusada' && (
            <div>
              <p className="font-semibold">Atribuição recusada</p>
              {entrega.motivo_recusa && (
                <p className="text-sm text-muted-foreground">
                  {entrega.motivo_recusa}
                </p>
              )}
            </div>
          )}

          {entrega?.estado === 'cancelada' && (
            <p className="font-semibold">Atribuição cancelada</p>
          )}

          {entrega?.estado === 'concluida' && (
            <p className="font-semibold">Entrega concluída</p>
          )}

          {podeConfirmarRecolha && (
            <button
              type="button"
              disabled={acao}
              onClick={() => setConfirmarRecolha(true)}
              className="rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Confirmar entrega ao entregador
            </button>
          )}
        </section>
      )}

      {encomenda.estado === 'aguardando_confirmacao' && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={acao}
            onClick={() => void mudar('confirmada')}
            className="rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Confirmar encomenda
          </button>
          <button
            type="button"
            disabled={acao}
            onClick={() => setRecusar(true)}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
          >
            Recusar
          </button>
        </div>
      )}

      {encomenda.estado === 'confirmada' && (
        <button
          type="button"
          disabled={acao}
          onClick={() => void mudar('em_preparacao')}
          className="rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Iniciar preparação
        </button>
      )}

      {encomenda.estado === 'em_preparacao' && (
        <button
          type="button"
          disabled={acao}
          onClick={() => void mudar('pronta_para_levantamento')}
          className="rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {eEntrega
            ? 'Marcar como pronta para recolha'
            : 'Marcar como pronta para levantamento'}
        </button>
      )}

      {!eEntrega && encomenda.estado === 'pronta_para_levantamento' && (
        <section className="rounded-2xl border-2 border-green-200 bg-green-50 p-5">
          <h2 className="flex items-center gap-2 font-titulo text-lg font-bold text-green-900">
            <KeyRound className="size-5" />
            Validar levantamento
          </h2>
          <p className="mt-1 text-sm text-green-800">
            Introduza o código apresentado pelo cliente.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              inputMode="numeric"
              maxLength={6}
              value={codigo}
              onChange={evento => {
                setCodigo(
                  evento.target.value.replace(/\D/g, '').slice(0, 6),
                );
              }}
              placeholder="000000"
              className="rounded-lg border bg-white px-3 py-2 font-mono text-lg tracking-widest"
            />
            <button
              type="button"
              disabled={acao || codigo.length !== 6}
              onClick={() => void validar()}
              className="rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {acao ? 'A validar…' : 'Validar código'}
            </button>
          </div>
        </section>
      )}

      <Dialog
        open={confirmarRecolha}
        onOpenChange={aberto => {
          if (!acao) setConfirmarRecolha(aberto);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar entrega ao entregador</DialogTitle>
            <DialogDescription>
              Confirma que entregaste fisicamente a encomenda{' '}
              {encomenda.codigo_publico} ao entregador{' '}
              {entrega?.nome_entregador || 'indicado'}.
              {descricaoVeiculo
                ? ` O veículo associado é ${descricaoVeiculo}.`
                : ''}{' '}
              Esta ação transfere a custódia da encomenda para o entregador.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              disabled={acao}
              onClick={() => setConfirmarRecolha(false)}
              className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={acao || !podeConfirmarRecolha}
              onClick={() => void confirmarEntregaAoEntregador()}
              className="rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {acao ? 'A confirmar…' : 'Confirmar entrega'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={recusar}
        onOpenChange={aberto => {
          if (!acao) setRecusar(aberto);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar encomenda</DialogTitle>
            <DialogDescription>
              Indique o motivo para informar o cliente.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={motivo}
            onChange={evento => setMotivo(evento.target.value)}
            placeholder="Motivo da recusa"
            className="min-h-24 w-full rounded-lg border p-3 text-sm"
          />
          <DialogFooter>
            <button
              type="button"
              disabled={acao}
              onClick={() => setRecusar(false)}
              className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={acao || !motivo.trim()}
              onClick={() => void mudar('recusada', motivo)}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Recusar encomenda
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
