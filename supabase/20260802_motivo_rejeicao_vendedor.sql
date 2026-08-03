-- Regista e torna obrigatório o motivo comunicado ao rejeitar um pedido.
alter table public.vendedores
  add column if not exists motivo_rejeicao text;

-- Documentos e respetivos números informados no pedido de cadastro.
alter table public.vendedores
  add column if not exists documentos jsonb not null default '{}'::jsonb;

create or replace function public.validar_motivo_rejeicao_vendedor()
returns trigger
language plpgsql
as $$
begin
  if new.status_aprovacao = 'rejeitado'
     and coalesce(btrim(new.motivo_rejeicao), '') = '' then
    raise exception 'É obrigatório indicar o motivo da rejeição';
  end if;

  if new.status_aprovacao is distinct from 'rejeitado' then
    new.motivo_rejeicao := null;
  end if;

  return new;
end;
$$;

drop trigger if exists validar_motivo_rejeicao_vendedor on public.vendedores;
create trigger validar_motivo_rejeicao_vendedor
before insert or update of status_aprovacao, motivo_rejeicao on public.vendedores
for each row execute function public.validar_motivo_rejeicao_vendedor();
