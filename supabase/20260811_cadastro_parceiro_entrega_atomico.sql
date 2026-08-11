-- ANGROLINK — grava o cadastro completo de um parceiro de entregas de forma atómica.
-- Execute depois das migrações 20260803_parceiros_entrega_fundacao.sql e
-- 20260804_submeter_parceiro_entrega.sql.

begin;

-- Garante que apenas a função controlada abaixo pode colocar um pedido em análise.
create or replace function public.proteger_estado_parceiro_entrega()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Esta função só pode correr sobre parceiros_entrega. A proteção evita
  -- erros em bases onde um trigger antigo foi ligado por engano a veículos
  -- ou documentos (essas tabelas não têm a coluna estado).
  if tg_table_name <> 'parceiros_entrega' then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and current_setting('angrolink.submeter_parceiro', true) = 'true'
    and old.estado in ('rascunho', 'documentos_pendentes', 'rejeitado')
    and new.estado = 'em_analise'
    and new.disponibilidade = false then
    return new;
  end if;

  if not public.eh_admin() then
    if tg_op = 'INSERT' and (new.estado <> 'rascunho' or new.disponibilidade) then
      raise exception 'O parceiro não pode aprovar-se ou ficar disponível no cadastro';
    end if;
    if tg_op = 'UPDATE' and (
      new.user_id is distinct from old.user_id or
      new.estado is distinct from old.estado or
      new.motivo_rejeicao is distinct from old.motivo_rejeicao or
      new.motivo_suspensao is distinct from old.motivo_suspensao or
      new.aprovado_em is distinct from old.aprovado_em
    ) then
      raise exception 'O estado administrativo do parceiro só pode ser alterado por administrador';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_estado_parceiro_entrega on public.parceiros_entrega;
drop trigger if exists proteger_estado_parceiro_entrega on public.veiculos_entrega;
drop trigger if exists proteger_estado_parceiro_entrega on public.documentos_parceiro_entrega;
create trigger proteger_estado_parceiro_entrega
before insert or update on public.parceiros_entrega
for each row execute function public.proteger_estado_parceiro_entrega();

create or replace function public.criar_pedido_parceiro_entrega(
  p_dados jsonb,
  p_veiculo jsonb,
  p_documentos jsonb,
  p_area jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parceiro_id uuid;
  v_veiculo_id uuid;
  v_existente public.parceiros_entrega%rowtype;
  v_tipo_veiculo text := lower(coalesce(p_veiculo->>'tipo_veiculo', ''));
  v_total_documentos integer := coalesce(jsonb_array_length(p_documentos), 0);
  v_minimo_documentos integer := case when lower(coalesce(p_veiculo->>'tipo_veiculo', '')) = 'mota' then 4 else 6 end;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão novamente antes de enviar o pedido.';
  end if;

  if v_tipo_veiculo not in ('mota', 'carro', 'carrinha', 'camiao') then
    raise exception 'Indique um tipo de veículo válido.';
  end if;

  if v_total_documentos < v_minimo_documentos
    or exists (
      select 1
      from jsonb_array_elements(p_documentos) documento
      where nullif(trim(documento->>'tipo_documento'), '') is null
         or nullif(trim(documento->>'frente_path'), '') is null
         or nullif(trim(documento->>'verso_path'), '') is null
    ) then
    raise exception 'Envie frente e verso de todos os documentos obrigatórios.';
  end if;

  select * into v_existente
  from public.parceiros_entrega
  where user_id = auth.uid()
  for update;

  if found then
    if v_existente.estado not in ('rascunho', 'documentos_pendentes')
      and (
        exists (select 1 from public.veiculos_entrega where parceiro_id = v_existente.id)
        or exists (select 1 from public.documentos_parceiro_entrega where parceiro_id = v_existente.id)
      ) then
      raise exception 'Esta conta já tem um pedido de parceria de entregas em tratamento.';
    end if;

    -- Corrige cadastros antigos que ficaram em análise sem veículo nem
    -- documentos: não há informação a preservar e o parceiro pode reenviar.
    delete from public.parceiros_entrega where id = v_existente.id;
  end if;

  insert into public.parceiros_entrega (
    user_id, nome_completo, email, telefone, provincia, municipio, bairro,
    zona_base, foto_perfil_url, contacto_emergencia, termos_aceites_em,
    estado, disponibilidade
  ) values (
    auth.uid(),
    nullif(trim(p_dados->>'nome_completo'), ''),
    nullif(trim(p_dados->>'email'), ''),
    nullif(trim(p_dados->>'telefone'), ''),
    nullif(trim(p_dados->>'provincia'), ''),
    nullif(trim(p_dados->>'municipio'), ''),
    nullif(trim(p_dados->>'bairro'), ''),
    nullif(trim(p_dados->>'zona_base'), ''),
    nullif(trim(p_dados->>'foto_perfil_url'), ''),
    nullif(trim(p_dados->>'contacto_emergencia'), ''),
    now(), 'rascunho', false
  ) returning id into v_parceiro_id;

  insert into public.veiculos_entrega (
    parceiro_id, tipo_veiculo, marca, modelo, cor, ano, matricula,
    tipo_carrocaria, capacidade_kg, capacidade_volume_m3,
    possui_caixa_carga, aceita_paletes, possui_refrigeracao, foto_veiculo_path
  ) values (
    v_parceiro_id, v_tipo_veiculo, nullif(trim(p_veiculo->>'marca'), ''),
    nullif(trim(p_veiculo->>'modelo'), ''), nullif(trim(p_veiculo->>'cor'), ''),
    nullif(p_veiculo->>'ano', '')::integer, upper(nullif(trim(p_veiculo->>'matricula'), '')),
    nullif(trim(p_veiculo->>'tipo_carrocaria'), ''),
    nullif(p_veiculo->>'capacidade_kg', '')::numeric,
    nullif(p_veiculo->>'capacidade_volume_m3', '')::numeric,
    coalesce((p_veiculo->>'possui_caixa_carga')::boolean, false),
    coalesce((p_veiculo->>'aceita_paletes')::boolean, false),
    coalesce((p_veiculo->>'possui_refrigeracao')::boolean, false),
    nullif(trim(p_veiculo->>'foto_veiculo_path'), '')
  ) returning id into v_veiculo_id;

  insert into public.areas_cobertura_entrega (parceiro_id, provincia, municipio, bairro)
  values (
    v_parceiro_id, nullif(trim(p_area->>'provincia'), ''),
    nullif(trim(p_area->>'municipio'), ''), nullif(trim(p_area->>'bairro'), '')
  );

  insert into public.documentos_parceiro_entrega (
    parceiro_id, veiculo_id, tipo_documento, frente_path, verso_path, estado
  )
  select
    v_parceiro_id,
    case when documento->>'tipo_documento' in ('bi', 'carta_conducao') then null else v_veiculo_id end,
    documento->>'tipo_documento', documento->>'frente_path', documento->>'verso_path', 'pendente'
  from jsonb_array_elements(p_documentos) documento;

  -- Permite a transição exclusivamente dentro desta operação controlada.
  perform set_config('angrolink.submeter_parceiro', 'true', true);
  update public.parceiros_entrega
  set estado = 'em_analise', disponibilidade = false, atualizado_em = now()
  where id = v_parceiro_id;

  return v_parceiro_id;
end;
$$;

grant execute on function public.criar_pedido_parceiro_entrega(jsonb, jsonb, jsonb, jsonb) to authenticated;

commit;
