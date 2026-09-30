import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contextos/AuthContexto';

export default function ParceiroContaSuspensa() {
  const { utilizador, sincronizandoPerfilParceiro } = useAuth();
  const estado = utilizador?.estado_parceiro_entrega;
  const suspensa = estado === 'suspenso';
  const rejeitada = estado === 'rejeitado';
  const documentosPendentes = estado === 'documentos_pendentes'
    || estado === 'documentacao_expirada';
  const motivo = (suspensa ? utilizador?.motivo_suspensao : utilizador?.motivo_rejeicao)?.trim();

  if (sincronizandoPerfilParceiro) {
    return (
      <section className="mx-auto max-w-2xl painel-dashboard-form" aria-live="polite">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <ShieldAlert className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-titulo text-2xl font-bold text-foreground">
              A atualizar o estado da candidatura
            </h1>
            <p className="mt-2 font-corpo text-sm leading-6 text-muted-foreground">
              Estamos a confirmar as suas permissões no servidor.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl painel-dashboard-form">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
          <ShieldAlert className="size-6" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-titulo text-2xl font-bold text-foreground">
            {suspensa
              ? 'Conta de entregador suspensa'
              : rejeitada
                ? 'Candidatura de entregador rejeitada'
                : documentosPendentes
                  ? 'Documentos pendentes de correção'
                  : 'Candidatura de entregador em análise'}
          </h1>
          <p className="mt-2 font-corpo text-sm leading-6 text-muted-foreground">
            {documentosPendentes
              ? 'Existem documentos que precisam de correção ou de nova análise antes da aprovação.'
              : 'A sua conta não pode receber tarefas, alterar disponibilidade, veículo ou áreas de cobertura enquanto a candidatura não estiver aprovada.'}
          </p>
          {motivo && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="font-corpo text-xs font-semibold uppercase tracking-wide text-red-700">
                Motivo informado pela ANGROLINK
              </p>
              <p className="mt-1 font-corpo text-sm text-red-900">{motivo}</p>
            </div>
          )}
          <p className="mt-4 font-corpo text-sm text-muted-foreground">
            Consulte a equipa ANGROLINK caso necessite de esclarecimentos ou de uma nova análise.
          </p>
          <Link
            to="/dashboard/documentos"
            className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 font-corpo text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Ver documentos e corrigir pendências
          </Link>
        </div>
      </div>
    </section>
  );
}
