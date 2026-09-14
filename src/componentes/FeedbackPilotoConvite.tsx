import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ContextoFeedbackPiloto } from '@/services/feedbackPiloto';

interface FeedbackPilotoConviteProps {
  contexto: ContextoFeedbackPiloto;
  encomendaId?: string | null;
  atribuicaoEntregaId?: string | null;
  concluida: boolean;
  bloqueado?: boolean;
  aoDarFeedback: () => void;
}

const descricoes: Record<ContextoFeedbackPiloto, string> = {
  cliente: 'Conta-nos como correu a tua compra.',
  vendedor: 'Conta-nos como correu a tua venda.',
  parceiro_entrega: 'Conta-nos como correu esta entrega.',
};

function chaveConvite(
  contexto: ContextoFeedbackPiloto,
  encomendaId?: string | null,
  atribuicaoEntregaId?: string | null,
): string | null {
  if (!encomendaId) return null;
  if (contexto === 'parceiro_entrega' && !atribuicaoEntregaId) return null;

  return `angrolink:feedback-convite:v1:${contexto}:${encomendaId}:${atribuicaoEntregaId ?? 'sem-atribuicao'}`;
}

export function FeedbackPilotoConvite({
  contexto,
  encomendaId,
  atribuicaoEntregaId,
  concluida,
  bloqueado = false,
  aoDarFeedback,
}: FeedbackPilotoConviteProps) {
  const chave = useMemo(
    () => chaveConvite(contexto, encomendaId, atribuicaoEntregaId),
    [atribuicaoEntregaId, contexto, encomendaId],
  );
  const chaveAvaliada = useRef<string | null>(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!chave || !concluida || bloqueado || chaveAvaliada.current === chave) return;

    chaveAvaliada.current = chave;

    try {
      if (window.localStorage.getItem(chave)) return;
      window.localStorage.setItem(chave, 'mostrado');
    } catch {
      // A indisponibilidade do armazenamento local não impede o convite desta sessão.
    }

    setAberto(true);
  }, [bloqueado, chave, concluida]);

  const abrirFeedback = () => {
    setAberto(false);
    aoDarFeedback();
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Como correu a tua experiência?</DialogTitle>
          <DialogDescription>{descricoes[contexto]}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setAberto(false)}>
            Agora não
          </Button>
          <Button type="button" onClick={abrirFeedback}>
            Dar feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
