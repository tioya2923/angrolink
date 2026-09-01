import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contextos/AuthContexto';

export default function ParceiroContaSuspensa() {
  const { utilizador } = useAuth();
  const motivo = utilizador?.motivo_suspensao?.trim();

  return (
    <section className="mx-auto max-w-2xl painel-dashboard-form">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
          <ShieldAlert className="size-6" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-titulo text-2xl font-bold text-foreground">
            Conta de entregador suspensa
          </h1>
          <p className="mt-2 font-corpo text-sm leading-6 text-muted-foreground">
            A sua conta não pode receber tarefas, alterar disponibilidade, veículo ou áreas de cobertura enquanto estiver suspensa.
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
        </div>
      </div>
    </section>
  );
}
