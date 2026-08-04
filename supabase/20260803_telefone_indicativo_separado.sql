begin;
alter table public.clientes add column if not exists indicativo_telefone text;
alter table public.clientes add column if not exists telefone_nacional text;
alter table public.vendedores add column if not exists indicativo_telefone text;
alter table public.vendedores add column if not exists telefone_nacional text;
alter table public.parceiros_entrega add column if not exists indicativo_telefone text;
alter table public.parceiros_entrega add column if not exists telefone_nacional text;

update public.clientes set indicativo_telefone = '244', telefone_nacional = right(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), 9) where telefone is not null and telefone_nacional is null;
update public.vendedores set indicativo_telefone = '244', telefone_nacional = right(regexp_replace(coalesce(telefone_whatsapp, ''), '\D', '', 'g'), 9) where telefone_whatsapp is not null and telefone_nacional is null;
update public.parceiros_entrega set indicativo_telefone = '244', telefone_nacional = right(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), 9) where telefone_nacional is null;

alter table public.clientes add constraint clientes_telefone_nacional_9 check (telefone_nacional is null or telefone_nacional ~ '^\\d{9}$') not valid;
alter table public.vendedores add constraint vendedores_telefone_nacional_9 check (telefone_nacional is null or telefone_nacional ~ '^\\d{9}$') not valid;
alter table public.parceiros_entrega add constraint parceiros_telefone_nacional_9 check (telefone_nacional is null or telefone_nacional ~ '^\\d{9}$') not valid;
commit;
