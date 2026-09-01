begin;

create or replace function public.atribuir_entregador_encomenda(
  p_encomenda_id uuid, p_parceiro_id uuid, p_veiculo_id uuid
)
returns public.atribuicoes_entrega_encomenda
language plpgsql security definer set search_path = public
as $$
declare
  v_encomenda public.encomendas%rowtype;
  v_veiculo public.veiculos_entrega%rowtype;
  v_atribuicao public.atribuicoes_entrega_encomenda%rowtype;
  v_estado text;
  v_motivos text[];
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  select * into v_encomenda from public.encomendas where id = p_encomenda_id for update;
  if not found then raise exception 'Encomenda não encontrada.'; end if;
  if v_encomenda.modalidade_recebimento <> 'entrega' then raise exception 'Apenas encomendas com entrega podem receber um entregador.'; end if;
  if v_encomenda.estado <> 'pronta_para_levantamento' then raise exception 'A encomenda precisa estar pronta para recolha antes de atribuir um entregador.'; end if;
  if exists (select 1 from public.atribuicoes_entrega_encomenda a where a.encomenda_id = p_encomenda_id and a.estado in ('atribuida', 'aceite')) then raise exception 'Esta encomenda já possui uma atribuição ativa.'; end if;
  select * into v_veiculo from public.veiculos_entrega where id = p_veiculo_id and parceiro_id = p_parceiro_id for update;
  if not found then raise exception 'O veículo indicado não pertence ao parceiro de entrega.'; end if;
  if not public.entregador_pode_receber_entregas(p_parceiro_id) then raise exception 'O parceiro de entrega já não está elegível para receber entregas.'; end if;
  if not public.veiculo_operacional_para_entregas(p_veiculo_id) then raise exception 'O veículo já não está operacional para entregas.'; end if;
  select c.estado, c.motivos into v_estado, v_motivos from public.avaliar_compatibilidade_veiculo_encomenda(p_veiculo_id, p_encomenda_id) c;
  if v_estado is distinct from 'compativel' then raise exception 'O veículo deixou de ser compatível com esta encomenda: %.', coalesce(array_to_string(v_motivos, ', '), 'sem motivo disponível'); end if;
  insert into public.atribuicoes_entrega_encomenda(encomenda_id, parceiro_entrega_id, veiculo_id, estado, atribuido_por)
  values (p_encomenda_id, p_parceiro_id, p_veiculo_id, 'atribuida', auth.uid()) returning * into v_atribuicao;
  insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados)
  values(p_encomenda_id,'entregador_atribuido',v_encomenda.estado,v_encomenda.estado,'admin',auth.uid(),jsonb_build_object('atribuicao_id',v_atribuicao.id,'parceiro_entrega_id',p_parceiro_id,'veiculo_id',p_veiculo_id));
  return v_atribuicao;
end;
$$;

create or replace function public.criar_area_cobertura_entrega(p_provincia text, p_municipio text, p_bairro text default null)
returns public.areas_cobertura_entrega language plpgsql security definer set search_path = public as $$
declare v_parceiro_id uuid; v_area public.areas_cobertura_entrega%rowtype;
begin
  select id into v_parceiro_id from public.parceiros_entrega where user_id = auth.uid();
  if v_parceiro_id is null then raise exception 'Parceiro de entrega não encontrado.'; end if;
  if not public.territorio_angola_valido(p_provincia, p_municipio) then raise exception 'Selecione uma província e um município válidos.'; end if;

  select * into v_area
  from public.areas_cobertura_entrega
  where parceiro_id = v_parceiro_id
    and provincia = btrim(p_provincia)
    and municipio = btrim(p_municipio)
    and bairro is not distinct from nullif(btrim(p_bairro), '')
  for update;

  if found then
    update public.areas_cobertura_entrega
    set ativo = true
    where id = v_area.id
    returning * into v_area;
    return v_area;
  end if;

  insert into public.areas_cobertura_entrega(parceiro_id,provincia,municipio,bairro,ativo)
  values(v_parceiro_id,btrim(p_provincia),btrim(p_municipio),nullif(btrim(p_bairro),''),true)
  returning * into v_area;
  return v_area;
end; $$;

create or replace function public.atualizar_area_cobertura_entrega(p_area_id uuid, p_provincia text, p_municipio text, p_bairro text default null, p_ativo boolean default true)
returns public.areas_cobertura_entrega language plpgsql security definer set search_path = public as $$
declare v_area public.areas_cobertura_entrega%rowtype;
begin
  if not public.territorio_angola_valido(p_provincia, p_municipio) then raise exception 'Selecione uma província e um município válidos.'; end if;
  update public.areas_cobertura_entrega a set provincia=btrim(p_provincia),municipio=btrim(p_municipio),bairro=nullif(btrim(p_bairro),''),ativo=p_ativo
  where a.id=p_area_id and exists(select 1 from public.parceiros_entrega p where p.id=a.parceiro_id and p.user_id=auth.uid()) returning * into v_area;
  if v_area is null then raise exception 'Área de cobertura não encontrada ou sem permissão.'; end if;
  return v_area;
end; $$;

create or replace function public.remover_area_cobertura_entrega(p_area_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.areas_cobertura_entrega a where a.id=p_area_id and exists(select 1 from public.parceiros_entrega p where p.id=a.parceiro_id and p.user_id=auth.uid());
  if not found then raise exception 'Área de cobertura não encontrada ou sem permissão.'; end if;
end; $$;

revoke all on function public.atribuir_entregador_encomenda(uuid,uuid,uuid), public.criar_area_cobertura_entrega(text,text,text), public.atualizar_area_cobertura_entrega(uuid,text,text,text,boolean), public.remover_area_cobertura_entrega(uuid) from public, anon;
grant execute on function public.atribuir_entregador_encomenda(uuid,uuid,uuid), public.criar_area_cobertura_entrega(text,text,text), public.atualizar_area_cobertura_entrega(uuid,text,text,text,boolean), public.remover_area_cobertura_entrega(uuid) to authenticated;
commit;
