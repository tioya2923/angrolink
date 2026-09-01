-- ANGROLINK — atributos físicos explícitos no catálogo e snapshots de carga.
-- Não ativa entregas, matching, tarifas ou atribuição de parceiros.

begin;

-- Os valores descrevem uma unidade comercial do anúncio. Para produtos cuja
-- unidade comercial seja "kg", o peso total é obtido diretamente pela
-- quantidade da encomenda; não há conversão implícita para as outras unidades.
alter table public.produtos
  add column if not exists peso_por_unidade_comercial_kg numeric(14,3),
  add column if not exists volume_por_unidade_comercial_m3 numeric(14,6),
  add column if not exists requer_refrigeracao boolean,
  add column if not exists requer_caixa_carga boolean,
  add column if not exists requer_paletes boolean;

alter table public.produtos
  drop constraint if exists produtos_peso_unidade_comercial_positivo,
  add constraint produtos_peso_unidade_comercial_positivo
    check (peso_por_unidade_comercial_kg is null or peso_por_unidade_comercial_kg > 0),
  drop constraint if exists produtos_kg_sem_peso_unitario_comercial,
  add constraint produtos_kg_sem_peso_unitario_comercial
    check (
      lower(btrim(coalesce(unidade, ''))) <> 'kg'
      or peso_por_unidade_comercial_kg is null
    ),
  drop constraint if exists produtos_volume_unidade_comercial_positivo,
  add constraint produtos_volume_unidade_comercial_positivo
    check (volume_por_unidade_comercial_m3 is null or volume_por_unidade_comercial_m3 > 0);

comment on column public.produtos.peso_por_unidade_comercial_kg is
  'Peso físico em kg de uma unidade comercial; null significa desconhecido. Para unidade kg, a quantidade da encomenda é o peso.';
comment on column public.produtos.volume_por_unidade_comercial_m3 is
  'Volume físico em m³ de uma unidade comercial; null significa desconhecido e nunca é inferido por peso.';
comment on column public.produtos.requer_refrigeracao is
  'true exige refrigeração; false declara que não exige; null significa requisito ainda desconhecido.';
comment on column public.produtos.requer_caixa_carga is
  'true exige veículo com caixa de carga; false declara que não exige; null significa requisito ainda desconhecido.';
comment on column public.produtos.requer_paletes is
  'true exige veículo que aceite paletes; false declara que não exige; null significa requisito ainda desconhecido.';

-- A fonte histórica de verdade fica no item da encomenda. Produtos antigos e
-- itens criados antes desta migration permanecem null: nenhum dado físico é
-- retropreenchido ou inferido.
alter table public.itens_encomenda
  add column if not exists peso_por_unidade_comercial_kg_snapshot numeric(14,3),
  add column if not exists volume_por_unidade_comercial_m3_snapshot numeric(14,6),
  add column if not exists requer_refrigeracao_snapshot boolean,
  add column if not exists requer_caixa_carga_snapshot boolean,
  add column if not exists requer_paletes_snapshot boolean;

alter table public.itens_encomenda
  drop constraint if exists itens_encomenda_peso_snapshot_positivo,
  add constraint itens_encomenda_peso_snapshot_positivo
    check (peso_por_unidade_comercial_kg_snapshot is null or peso_por_unidade_comercial_kg_snapshot > 0),
  drop constraint if exists itens_encomenda_kg_sem_peso_snapshot,
  add constraint itens_encomenda_kg_sem_peso_snapshot
    check (
      lower(btrim(unidade)) <> 'kg'
      or peso_por_unidade_comercial_kg_snapshot is null
    ),
  drop constraint if exists itens_encomenda_volume_snapshot_positivo,
  add constraint itens_encomenda_volume_snapshot_positivo
    check (volume_por_unidade_comercial_m3_snapshot is null or volume_por_unidade_comercial_m3_snapshot > 0);

-- A criação de levantamento já passa exclusivamente pelo servidor. Este
-- trigger copia sempre os atributos atuais do produto para o item, evitando
-- duplicar ou fragilizar a RPC transacional existente.
create or replace function public.preencher_snapshot_logistico_item_encomenda()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_produto public.produtos%rowtype;
begin
  if new.produto_id is null then
    return new;
  end if;

  select * into v_produto
  from public.produtos
  where id = new.produto_id;

  if not found then
    raise exception 'Não foi possível obter os atributos logísticos do produto da encomenda.';
  end if;

  new.peso_por_unidade_comercial_kg_snapshot := v_produto.peso_por_unidade_comercial_kg;
  new.volume_por_unidade_comercial_m3_snapshot := v_produto.volume_por_unidade_comercial_m3;
  new.requer_refrigeracao_snapshot := v_produto.requer_refrigeracao;
  new.requer_caixa_carga_snapshot := v_produto.requer_caixa_carga;
  new.requer_paletes_snapshot := v_produto.requer_paletes;
  return new;
end;
$$;

drop trigger if exists preencher_snapshot_logistico_item on public.itens_encomenda;
create trigger preencher_snapshot_logistico_item
before insert on public.itens_encomenda
for each row execute function public.preencher_snapshot_logistico_item_encomenda();

-- Agregado interno para o futuro matching. Não recebe execução direta de
-- utilizadores: uma futura RPC logística autorizada será a única consumidora.
-- null representa desconhecido; false representa requisito explicitamente não
-- necessário. Não há inferência de densidade, litros, sacos, caixas ou paletes.
create or replace function public.calcular_requisitos_logisticos_encomenda(
  p_encomenda_id uuid
)
returns table (
  peso_total_kg numeric,
  peso_total_conhecido boolean,
  volume_total_m3 numeric,
  volume_total_conhecido boolean,
  requer_refrigeracao boolean,
  requer_caixa_carga boolean,
  requer_paletes boolean,
  requisitos_especiais_conhecidos boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with itens as (
    select
      i.quantidade,
      i.unidade,
      i.peso_por_unidade_comercial_kg_snapshot,
      i.volume_por_unidade_comercial_m3_snapshot,
      i.requer_refrigeracao_snapshot,
      i.requer_caixa_carga_snapshot,
      i.requer_paletes_snapshot,
      case
        when lower(btrim(i.unidade)) = 'kg' then i.quantidade
        when i.peso_por_unidade_comercial_kg_snapshot is not null
          then i.quantidade * i.peso_por_unidade_comercial_kg_snapshot
        else null
      end as peso_item_kg,
      case
        when i.volume_por_unidade_comercial_m3_snapshot is not null
          then i.quantidade * i.volume_por_unidade_comercial_m3_snapshot
        else null
      end as volume_item_m3
    from public.itens_encomenda i
    where i.encomenda_id = p_encomenda_id
  )
  select
    case when count(*) > 0 and count(peso_item_kg) = count(*) then sum(peso_item_kg) else null end,
    count(*) > 0 and count(peso_item_kg) = count(*),
    case when count(*) > 0 and count(volume_item_m3) = count(*) then sum(volume_item_m3) else null end,
    count(*) > 0 and count(volume_item_m3) = count(*),
    case
      when bool_or(requer_refrigeracao_snapshot is true) then true
      when count(*) = 0 or count(*) filter (where requer_refrigeracao_snapshot is null) > 0 then null
      else false
    end,
    case
      when bool_or(requer_caixa_carga_snapshot is true) then true
      when count(*) = 0 or count(*) filter (where requer_caixa_carga_snapshot is null) > 0 then null
      else false
    end,
    case
      when bool_or(requer_paletes_snapshot is true) then true
      when count(*) = 0 or count(*) filter (where requer_paletes_snapshot is null) > 0 then null
      else false
    end,
    count(*) > 0
      and count(*) filter (where requer_refrigeracao_snapshot is null) = 0
      and count(*) filter (where requer_caixa_carga_snapshot is null) = 0
      and count(*) filter (where requer_paletes_snapshot is null) = 0
  from itens;
$$;

comment on function public.calcular_requisitos_logisticos_encomenda(uuid) is
  'Agregado interno de carga. Matching automático futuro deve rejeitar peso_total_conhecido=false, volume_total_conhecido=false ou requisitos_especiais_conhecidos=false; desconhecido não significa requisito zero.';

revoke all on function public.preencher_snapshot_logistico_item_encomenda() from public, anon, authenticated;
revoke all on function public.calcular_requisitos_logisticos_encomenda(uuid) from public, anon, authenticated;

commit;
