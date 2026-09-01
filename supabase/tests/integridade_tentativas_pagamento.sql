-- Executar APÓS aplicar a migration numa base de TESTE com privilégios
-- administrativos. Todos os inserts são revertidos pelo ROLLBACK.
begin;

do $$
declare
  v_pagamento_a uuid;
  v_pagamento_b uuid;
begin
  select p.id into v_pagamento_a
  from public.pagamentos p
  where not exists (
    select 1 from public.tentativas_pagamento t
    where t.pagamento_id = p.id and t.estado = 'confirmada'
  )
  order by p.criado_em
  limit 1;

  if v_pagamento_a is null then
    raise notice 'SKIP: não há pagamento de teste sem tentativa confirmada.';
    return;
  end if;

  -- Falhada + confirmada, expirada + confirmada e duas falhadas são válidas.
  insert into public.tentativas_pagamento (pagamento_id, metodo, estado, referencia_interna, chave_idempotencia, falhado_em)
  values (v_pagamento_a, 'online', 'falhada', 'TESTE-TPT-FALHADA-1-' || replace(gen_random_uuid()::text, '-', ''), gen_random_uuid(), now());
  insert into public.tentativas_pagamento (pagamento_id, metodo, estado, referencia_interna, chave_idempotencia, expirado_em)
  values (v_pagamento_a, 'online', 'expirada', 'TESTE-TPT-EXPIRADA-' || replace(gen_random_uuid()::text, '-', ''), gen_random_uuid(), now());
  insert into public.tentativas_pagamento (pagamento_id, metodo, estado, referencia_interna, chave_idempotencia, falhado_em)
  values (v_pagamento_a, 'pagamento_no_levantamento', 'falhada', 'TESTE-TPT-FALHADA-2-' || replace(gen_random_uuid()::text, '-', ''), gen_random_uuid(), now());

  -- Primeira confirmação é permitida.
  insert into public.tentativas_pagamento (pagamento_id, metodo, estado, referencia_interna, chave_idempotencia, confirmado_em)
  values (v_pagamento_a, 'pagamento_no_levantamento', 'confirmada', 'TESTE-TPT-CONFIRMADA-1-' || replace(gen_random_uuid()::text, '-', ''), gen_random_uuid(), now());

  -- A segunda confirmação para a mesma obrigação tem de falhar no índice.
  begin
    insert into public.tentativas_pagamento (pagamento_id, metodo, estado, referencia_interna, chave_idempotencia, confirmado_em)
    values (v_pagamento_a, 'online', 'confirmada', 'TESTE-TPT-CONFIRMADA-2-' || replace(gen_random_uuid()::text, '-', ''), gen_random_uuid(), now());
    raise exception 'A segunda tentativa confirmada deveria ser bloqueada.';
  exception when unique_violation then
    null;
  end;

  -- Pagamentos diferentes podem ter, cada um, uma confirmação independente.
  select p.id into v_pagamento_b
  from public.pagamentos p
  where p.id <> v_pagamento_a
    and not exists (
      select 1 from public.tentativas_pagamento t
      where t.pagamento_id = p.id and t.estado = 'confirmada'
    )
  order by p.criado_em
  limit 1;

  if v_pagamento_b is null then
    raise notice 'SKIP parcial: não existe segundo pagamento de teste elegível.';
    return;
  end if;

  insert into public.tentativas_pagamento (pagamento_id, metodo, estado, referencia_interna, chave_idempotencia, confirmado_em)
  values (v_pagamento_b, 'online', 'confirmada', 'TESTE-TPT-CONFIRMADA-B-' || replace(gen_random_uuid()::text, '-', ''), gen_random_uuid(), now());
end;
$$;

rollback;
