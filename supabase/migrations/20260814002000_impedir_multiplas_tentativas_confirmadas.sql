-- ANGROLINK — uma confirmação financeira por obrigação de pagamento.
-- Tentativas falhadas, expiradas, canceladas, pendentes e em processamento
-- continuam a poder coexistir para suportar novas tentativas legítimas.

begin;

create unique index if not exists tentativas_pagamento_uma_confirmada_por_pagamento_idx
  on public.tentativas_pagamento (pagamento_id)
  where estado = 'confirmada';

commit;
