begin;

create or replace function public.aprovar_parceiro_entrega_admin(
  p_parceiro_id uuid
)
returns public.parceiros_entrega
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parceiro public.parceiros_entrega%rowtype;
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  select *
    into v_parceiro
    from public.parceiros_entrega
   where id = p_parceiro_id
   for update;

  if not found then
    raise exception 'Entregador não encontrado.';
  end if;

  if not exists (
    select 1
      from public.documentos_parceiro_entrega d
     where d.parceiro_id = p_parceiro_id
  ) or exists (
    select 1
      from public.documentos_parceiro_entrega d
     where d.parceiro_id = p_parceiro_id
       and d.estado <> 'aprovado'
  ) then
    raise exception 'Analise e aprove todos os documentos antes de aprovar o parceiro.';
  end if;

  if not exists (
    select 1
      from public.veiculos_entrega v
     where v.parceiro_id = p_parceiro_id
  ) then
    raise exception 'O entregador precisa de pelo menos um veículo antes da aprovação.';
  end if;

  -- Bloqueia todos os veículos do parceiro antes de alterar o estado de
  -- verificação; a ordem estável evita inversões de lock em aprovações concorrentes.
  perform 1
    from public.veiculos_entrega v
   where v.parceiro_id = p_parceiro_id
   order by v.id
   for update;

  update public.veiculos_entrega
     set estado_verificacao = 'aprovado',
         motivo_rejeicao = null,
         atualizado_em = now()
   where parceiro_id = p_parceiro_id;

  update public.parceiros_entrega
     set estado = 'aprovado',
         disponibilidade = false,
         aprovado_em = coalesce(v_parceiro.aprovado_em, now()),
         motivo_rejeicao = null,
         motivo_suspensao = null,
         atualizado_em = now()
   where id = p_parceiro_id
  returning * into v_parceiro;

  return v_parceiro;
end;
$$;

revoke all on function public.aprovar_parceiro_entrega_admin(uuid) from public, anon;
grant execute on function public.aprovar_parceiro_entrega_admin(uuid) to authenticated;

commit;
