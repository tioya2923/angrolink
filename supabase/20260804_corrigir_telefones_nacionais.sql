-- Normaliza dados antigos para a regra: indicativo separado + número nacional com 9 dígitos.
-- Não altera as colunas de contacto completas usadas atualmente pela aplicação.

begin;

-- A versão inicial usou \\d na expressão SQL e algumas instalações gravaram
-- uma barra extra na regra. [0-9] evita essa ambiguidade.
alter table public.vendedores drop constraint if exists vendedores_telefone_nacional_9;
alter table public.clientes drop constraint if exists clientes_telefone_nacional_9;
alter table public.parceiros_entrega drop constraint if exists parceiros_telefone_nacional_9;

with telefones as (
  select
    id,
    regexp_replace(coalesce(nullif(telefone_nacional, ''), telefone_whatsapp, whatsapp, ''), '\\D', '', 'g') as digitos
  from public.vendedores
)
update public.vendedores v
set
  telefone_nacional = case when length(t.digitos) >= 9 then right(t.digitos, 9) else null end,
  indicativo_telefone = case
    when length(t.digitos) > 9 then left(t.digitos, length(t.digitos) - 9)
    when nullif(regexp_replace(coalesce(v.indicativo_telefone, ''), '\\D', '', 'g'), '') is not null
      then regexp_replace(v.indicativo_telefone, '\\D', '', 'g')
    else '244'
  end
from telefones t
where t.id = v.id;

with telefones as (
  select
    id,
    regexp_replace(coalesce(nullif(telefone_nacional, ''), telefone, ''), '\\D', '', 'g') as digitos
  from public.clientes
)
update public.clientes c
set
  telefone_nacional = case when length(t.digitos) >= 9 then right(t.digitos, 9) else null end,
  indicativo_telefone = case
    when length(t.digitos) > 9 then left(t.digitos, length(t.digitos) - 9)
    when nullif(regexp_replace(coalesce(c.indicativo_telefone, ''), '\\D', '', 'g'), '') is not null
      then regexp_replace(c.indicativo_telefone, '\\D', '', 'g')
    else '244'
  end
from telefones t
where t.id = c.id;

with telefones as (
  select
    id,
    regexp_replace(coalesce(nullif(telefone_nacional, ''), telefone, ''), '\\D', '', 'g') as digitos
  from public.parceiros_entrega
)
update public.parceiros_entrega p
set
  telefone_nacional = case when length(t.digitos) >= 9 then right(t.digitos, 9) else null end,
  indicativo_telefone = case
    when length(t.digitos) > 9 then left(t.digitos, length(t.digitos) - 9)
    when nullif(regexp_replace(coalesce(p.indicativo_telefone, ''), '\\D', '', 'g'), '') is not null
      then regexp_replace(p.indicativo_telefone, '\\D', '', 'g')
    else '244'
  end
from telefones t
where t.id = p.id;

alter table public.vendedores
  add constraint vendedores_telefone_nacional_9
  check (telefone_nacional is null or telefone_nacional ~ '^[0-9]{9}$') not valid;
alter table public.clientes
  add constraint clientes_telefone_nacional_9
  check (telefone_nacional is null or telefone_nacional ~ '^[0-9]{9}$') not valid;
alter table public.parceiros_entrega
  add constraint parceiros_telefone_nacional_9
  check (telefone_nacional is null or telefone_nacional ~ '^[0-9]{9}$') not valid;

commit;
